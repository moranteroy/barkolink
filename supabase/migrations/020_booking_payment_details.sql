-- Return the verified provider method alongside the existing booking fields.
-- Payment status is still controlled by the service-only confirmation RPC.
create or replace function barkolink_private.booking_json(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select barkolink_private.booking_base(b) || jsonb_build_object(
    'paymentProviderMethod', (select p.provider_method from public.online_payment p
      where p.booking_id=b.id and p.status='PAID'),
    'bookingPassengers_on_booking',
    (select coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at, p.id), '[]'::jsonb)
     from public.booking_passenger p where p.booking_id = b.id))
$$;
