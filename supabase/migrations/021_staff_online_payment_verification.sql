-- Preserve payment-provider confirmation separately from staff approval.
alter table public.booking add column payment_verified_at timestamptz;
alter table public.booking add column payment_verified_by text references public.app_user(uid);
-- Previously issued tickets stay valid. New online payments require staff approval.
update public.booking b set payment_verified_at=b.paid_at
where b.payment_method='PAYMONGO_TEST' and b.payment_status='PAID'
  and exists(select 1 from public.booking_passenger p where p.booking_id=b.id and p.ticket_status in ('ISSUED','CHECKED-IN','BOARDED'));

create or replace function barkolink_private.booking_base(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(b) || jsonb_build_object(
    'paymentVerificationRequired', b.payment_method='PAYMONGO_TEST' and b.payment_status='PAID' and b.payment_verified_at is null,
    'owner', (select to_jsonb(u) from public.app_user u where u.uid=b.owner_uid),
    'sailing', (select barkolink_private.sailing_json(s) from public.sailing s where s.code=b.sailing_code))
$$;

create or replace function barkolink_private.booking_json(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select barkolink_private.booking_base(b) || jsonb_build_object(
    'paymentProviderMethod', (select provider_method from public.online_payment where booking_id=b.id and status='PAID'),
    'paymentTransactionId', (select provider_payment_id from public.online_payment where booking_id=b.id and status='PAID'),
    'bookingPassengers_on_booking', (select coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at,p.id),'[]'::jsonb) from public.booking_passenger p where p.booking_id=b.id))
$$;

create or replace function public.complete_paymongo_test(p_session text, p_payment text, p_amount integer, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment; active boolean;
begin
  select * into p from public.online_payment where session_id=p_session;
  if not found then raise exception 'Checkout was not found.'; end if;
  select * into b from public.booking where id=p.booking_id for update;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where id=p.id for update;
  if p.amount<>p_amount or b.total*100<>p_amount then raise exception 'Payment amount does not match.'; end if;
  if p.status in ('PAID','REVIEW') then return jsonb_build_object('status',p.status); end if;
  if b.payment_status<>'UNPAID' then
    update public.online_payment set status='REVIEW',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
    return '{"status":"REVIEW"}'::jsonb;
  end if;
  active := b.status in ('PENDING','CONFIRMED') and b.payment_deadline>now()
    and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
  update public.online_payment set status='PAID',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
  if active then
    update public.booking set status='CONFIRMED',payment_status='PAID',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
    -- Tickets remain PENDING until an authorized ticketing staff member verifies payment.
  else
    if b.status in ('PENDING','CONFIRMED') then
      update public.sailing set available_seats=available_seats+b.passenger_count,updated_at=now() where code=s.code;
    end if;
    update public.booking set status='CANCELLED',payment_status='REFUND_PENDING',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
  end if;
  insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,
    'Payment received',case when active then 'Your online payment was received. Awaiting staff verification before your e-ticket is issued.'
    else 'Payment arrived after the reservation closed. Contact ticketing for assistance. No ticket was issued.' end,'BOOKING');
  insert into public.activity_log(action,entity_type,entity_id,details) values('PAYMONGO_TEST_PAID','booking',b.reference,
    jsonb_build_object('amount',b.total,'sessionId',p_session,'testMode',true,'awaitingStaffVerification',active));
  return jsonb_build_object('status','PAID','ticketIssued',false);
end $$;

create function public.verify_online_payment(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor text := auth.uid()::text; b public.booking; s public.sailing; p public.online_payment;
begin
  if actor is null or not exists(select 1 from public.app_user where uid=actor and role in ('TICKETING','ADMIN')) then
    raise exception 'Ticketing access required.' using errcode='42501';
  end if;
  select * into b from public.booking where id=p_booking for update;
  if not found then raise exception 'Booking was not found.'; end if;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where booking_id=b.id for update;
  if b.payment_method<>'PAYMONGO_TEST' or b.payment_status<>'PAID' or p.id is null or p.status<>'PAID'
    or p.provider_payment_id is null or p.amount<>b.total*100 then
    raise exception 'A confirmed online payment is required.';
  end if;
  if b.status<>'CONFIRMED' or s.departure_at<=now() or s.status not in ('SCHEDULED','BOARDING') then
    raise exception 'Only an active booking before departure can be verified.';
  end if;
  if b.payment_verified_at is not null then return '{"verified":true}'::jsonb; end if;
  update public.booking set payment_verified_at=now(),payment_verified_by=actor,updated_at=now() where id=b.id;
  update public.booking_passenger set ticket_status='ISSUED',issued_at=now() where booking_id=b.id and ticket_status='PENDING';
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor,'ONLINE_PAYMENT_VERIFIED','booking',b.reference,jsonb_build_object('amount',b.total,'method',p.provider_method,'paymentId',p.provider_payment_id));
  insert into public.notification(owner_uid,title,message,category)
    values(b.owner_uid,'Payment verified','Staff verified your payment. Your e-ticket is now available.','BOOKING');
  return '{"verified":true}'::jsonb;
end $$;
revoke all on function public.verify_online_payment(uuid) from public, anon;
grant execute on function public.verify_online_payment(uuid) to authenticated;
