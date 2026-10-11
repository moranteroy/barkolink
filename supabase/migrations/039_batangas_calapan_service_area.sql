-- Preserve ticket history while restricting new operations to this corridor.
update public.port set is_active=(code in ('BTG','CAL'));
update public.ferry_route r set is_active=(o.code in ('BTG','CAL') and d.code in ('BTG','CAL'))
from public.port o,public.port d where o.id=r.origin_port_id and d.id=r.destination_port_id;
update public.vessel v set is_active=false where not exists(
  select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id
  where vr.vessel_id=v.id and r.is_active
);
-- Retain pauses set by the administrator on schedules inside the corridor.
update barkolink_private.daily_schedule s set is_active=false,updated_at=now()
where is_active and not exists(select 1 from public.ferry_route r where r.id=s.route_id and r.is_active);

-- Legacy bookings put the cabin surcharge in service_fee. Reclassify it without
-- changing the amount charged, payment state, passenger fares or QR credentials.
update public.booking b set
  passenger_fare_total=b.passenger_fare_total+b.accommodation_surcharge*b.passenger_count,
  service_fee=b.service_fee-b.accommodation_surcharge*b.passenger_count,
  updated_at=now()
where b.accommodation_surcharge>0
  and b.passenger_fare_total=(select sum(p.fare) from public.booking_passenger p where p.booking_id=b.id)
  and b.service_fee>=b.accommodation_surcharge*b.passenger_count;
