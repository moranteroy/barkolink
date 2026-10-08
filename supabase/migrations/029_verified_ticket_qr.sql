alter table public.booking_passenger add column qr_verification_token text not null
  default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));

create function barkolink_private.ticket_qr_payload(p public.booking_passenger) returns text
language sql stable set search_path='' as $$
  select jsonb_build_object('BarkoLink','Ticket v2','Name',p.full_name,
    'Date',to_char(s.departure_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI')||' Philippine time',
    'Vessel',v.name,'Route',o.name||' to '||d.name,'Booking',b.reference,
    'Ticket',p.ticket_code::text,'Verification',p.qr_verification_token)::text
  from public.booking b join public.sailing s on s.code=b.sailing_code
  join public.vessel v on v.id=s.vessel_id join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id
  where b.id=p.booking_id and b.status='CONFIRMED' and b.payment_status='PAID'
    and (b.payment_method is distinct from 'PAYMONGO_TEST' or b.payment_verified_at is not null)
    and p.ticket_status in ('ISSUED','CHECKED_IN','BOARDED');
$$;
create or replace function barkolink_private.passenger_json(p public.booking_passenger) returns jsonb
language sql stable set search_path='' as $$
  select (to_jsonb(p)-'qr_verification_token')||jsonb_build_object('ticket_qr_payload',barkolink_private.ticket_qr_payload(p),
    'booking',(select barkolink_private.booking_base(b) from public.booking b where b.id=p.booking_id));
$$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v28;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare raw text; ticket_code_value text; payload jsonb; p public.booking_passenger; b public.booking; s public.sailing;
begin
  if operation='VerifyTicketQr' then
    if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('ADMIN','TICKETING','BOARDING') then
      raise exception 'Staff access required to verify tickets.' using errcode='42501';
    end if;
    raw:=trim(args->>'payload');
    if raw is null or length(raw)>4096 or length(raw)=0 then raise exception 'Enter a valid BarkoLink ticket QR or ticket code.'; end if;
    if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      -- Previously printed tickets and staff-entered codes still undergo live payment and sailing checks.
      ticket_code_value:=lower(raw);
    else
      begin payload:=raw::jsonb; exception when invalid_text_representation then raise exception 'This is not a valid BarkoLink ticket QR.'; end;
      if jsonb_typeof(payload)<>'object' or payload->>'BarkoLink' is distinct from 'Ticket v2' then raise exception 'This is not a valid BarkoLink ticket QR.'; end if;
      ticket_code_value:=payload->>'Ticket';
    end if;
    select * into p from public.booking_passenger where ticket_code::text=ticket_code_value;
    if not found then raise exception 'Ticket was not found. This QR cannot be used to travel.'; end if;
    select * into b from public.booking where id=p.booking_id;
    select * into s from public.sailing where code=b.sailing_code;
    if nullif(args->>'sailingCode','') is null or s.code is distinct from args->>'sailingCode' then raise exception 'This ticket belongs to a different sailing.'; end if;
    if b.status<>'CONFIRMED' or b.payment_status<>'PAID'
      or (b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null)
      or p.ticket_status not in ('ISSUED','CHECKED_IN','BOARDED') then raise exception 'This ticket is unpaid, cancelled, or not issued. Do not admit this passenger.'; end if;
    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then raise exception 'This sailing is not open for check-in or boarding.'; end if;
    if payload is not null and payload is distinct from barkolink_private.ticket_qr_payload(p)::jsonb then
      raise exception 'QR verification failed: ticket details were changed or the trip was updated. Ask the passenger to open their current BarkoLink ticket.';
    end if;
    return jsonb_build_object('passenger',barkolink_private.passenger_json(p),'already_boarded',p.ticket_status='BOARDED','legacy_code',payload is null);
  end if;
  return barkolink_private.execute_flexible_discounts_v28(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
