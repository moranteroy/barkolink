-- Test payments are explicitly distinct from real cash collections.
alter table public.booking drop constraint booking_payment_method_check;
alter table public.booking add constraint booking_payment_method_check
  check (payment_method is null or payment_method in ('CASH','PAYMONGO_TEST'));

create table public.online_payment (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking,
  session_id text unique, checkout_url text,
  amount integer not null check (amount > 0),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','PAID','REVIEW')),
  provider_payment_id text unique, provider_method text,
  created_at timestamptz not null default now(), paid_at timestamptz
);
alter table public.online_payment enable row level security;
revoke all on public.online_payment from public, anon, authenticated;
grant all on public.online_payment to service_role;

-- Only the authenticated Edge Function may call these service-only RPCs.
create function public.prepare_paymongo_test(p_booking uuid, p_owner text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment;
begin
  select * into b from public.booking where id=p_booking for update;
  if not found or b.owner_uid <> p_owner then raise exception 'Booking was not found.'; end if;
  select * into s from public.sailing where code=b.sailing_code for update;
  if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED')
    or b.payment_deadline <= now() or s.departure_at <= now()
    or s.status not in ('SCHEDULED','BOARDING') then
    raise exception 'Only active unpaid reservations before the deadline can be paid.';
  end if;
  if exists(select 1 from public.booking_passenger where booking_id=b.id
    and fare<s.regular_fare and discount_verified_at is null) then
    raise exception 'Visit ticketing to verify discounted passengers before paying online.';
  end if;
  insert into public.online_payment(booking_id,amount) values(b.id,b.total*100)
    on conflict(booking_id) do nothing;
  select * into p from public.online_payment where booking_id=b.id;
  if p.amount <> b.total*100 then raise exception 'Fare changed. Close this checkout and pay cash at ticketing.'; end if;
  if p.status <> 'OPEN' then raise exception 'This checkout is closed. Use cash at ticketing or create a new reservation.'; end if;
  return to_jsonb(p) || jsonb_build_object('reference',b.reference);
end $$;

create function public.complete_paymongo_test(p_session text, p_payment text, p_amount integer, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment; active boolean;
begin
  -- Follow the existing booking -> sailing lock order.
  select * into p from public.online_payment where session_id=p_session;
  if not found then raise exception 'Checkout was not found.'; end if;
  select * into b from public.booking where id=p.booking_id for update;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where id=p.id for update;
  if p.amount <> p_amount or b.total*100 <> p_amount then raise exception 'Payment amount does not match.'; end if;
  if p.status in ('PAID','REVIEW') then return jsonb_build_object('status',p.status); end if;
  if b.payment_status <> 'UNPAID' then
    update public.online_payment set status='REVIEW',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
    return '{"status":"REVIEW"}'::jsonb;
  end if;
  active := b.status in ('PENDING','CONFIRMED') and b.payment_deadline>now()
    and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
  update public.online_payment set status='PAID',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
  if active then
    update public.booking set status='CONFIRMED',payment_status='PAID',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
    update public.booking_passenger set ticket_status='ISSUED',issued_at=now() where booking_id=b.id and ticket_status='PENDING';
  else
    -- Late sandbox payments never restore released seats or issue a ticket.
    if b.status in ('PENDING','CONFIRMED') then
      update public.sailing set available_seats=available_seats+b.passenger_count,updated_at=now() where code=s.code;
    end if;
    update public.booking set status='CANCELLED',payment_status='REFUND_PENDING',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
  end if;
  insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,
    'Sandbox payment confirmed',case when active then 'Test payment only; no real money moved. Your demo e-tickets are ready.'
    else 'Test payment arrived after the reservation closed. No ticket was issued and no real cash refund is due.' end,'BOOKING');
  insert into public.activity_log(action,entity_type,entity_id,details) values('PAYMONGO_TEST_PAID','booking',b.reference,
    jsonb_build_object('amount',b.total,'sessionId',p_session,'testMode',true));
  return jsonb_build_object('status','PAID','ticketIssued',active);
end $$;

-- Prevent staff from collecting cash while an online checkout can still be paid.
create function barkolink_private.guard_online_cash() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.total <> old.total or new.sailing_code <> old.sailing_code)
    and exists(select 1 from public.online_payment where booking_id=old.id and status='OPEN') then
    raise exception 'Close the online checkout before changing the fare or sailing.';
  end if;
  if new.payment_method='CASH' and new.payment_status='PAID' and old.payment_status='UNPAID'
    and exists(select 1 from public.online_payment where booking_id=old.id and status='OPEN') then
    raise exception 'Close the online checkout from the passenger payment panel before collecting cash.';
  end if;
  if old.payment_method='PAYMONGO_TEST' and new.payment_status='REFUNDED' then
    raise exception 'Sandbox payments have no real cash refund. Do not return cash for a test payment.';
  end if;
  return new;
end $$;
create trigger guard_online_cash before update on public.booking
for each row execute function barkolink_private.guard_online_cash();
revoke all on function public.prepare_paymongo_test(uuid,text), public.complete_paymongo_test(text,text,integer,text) from public, anon, authenticated;
grant execute on function public.prepare_paymongo_test(uuid,text), public.complete_paymongo_test(text,text,integer,text) to service_role;
