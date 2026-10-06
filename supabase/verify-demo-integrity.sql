do $$ begin
  if exists(select 1 from public.booking b where b.passenger_count<>(select count(*) from public.booking_passenger p where p.booking_id=b.id)
    or b.passenger_fare_total<>(select sum(p.fare)+b.accommodation_surcharge*b.passenger_count from public.booking_passenger p where p.booking_id=b.id)
    or b.total<>b.passenger_fare_total+b.service_fee) then raise exception 'Booking totals or passenger counts are inconsistent'; end if;
  if exists(select 1 from public.sailing s join public.vessel v on v.id=s.vessel_id
    where s.available_seats<>v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0)) then raise exception 'Seat counts are inconsistent'; end if;
  if exists(select 1 from public.accommodation a join public.vessel v on v.id=a.vessel_id where a.is_active
    and (select sum(c.capacity) from public.accommodation c where c.vessel_id=a.vessel_id and c.is_active)>v.passenger_capacity) then raise exception 'Class allocations exceed vessel capacity'; end if;
  if exists(select 1 from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.sailing s on s.code=b.sailing_code
    where p.fare<>barkolink_private.fare(s,p.passenger_type) or (b.payment_status='PAID' and p.fare<s.regular_fare and p.discount_verified_at is null)) then raise exception 'Discount fare or verification is inconsistent'; end if;
  if (select available_seats from public.sailing where code='TRP2026-1006004')<>0 then raise exception 'Sold-out fixture is not full'; end if;
  if (select count(*) from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.sailing_code='TRP2026-1006005')<>36 then raise exception 'Pagination fixture is incomplete'; end if;
end $$;