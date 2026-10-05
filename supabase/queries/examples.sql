-- Run these in Supabase SQL Editor after applying migrations.

-- Upcoming trips: joins and filtering.
select s.code, origin.name as origin, destination.name as destination,
       v.name as vessel, s.departure_at, s.regular_fare, s.available_seats
from public.sailing s
join public.port origin on origin.id = s.origin_port_id
join public.port destination on destination.id = s.destination_port_id
join public.vessel v on v.id = s.vessel_id
where s.status = 'SCHEDULED' and s.departure_at > now() and s.available_seats > 0
order by s.departure_at;

-- Passenger manifest: confirmed and paid bookings.
select s.code, b.reference, p.full_name, p.passenger_type, p.sex, p.ticket_status
from public.booking_passenger p
join public.booking b on b.id = p.booking_id
join public.sailing s on s.code = b.sailing_code
where b.status = 'CONFIRMED' and b.payment_status = 'PAID'
order by s.departure_at, p.full_name;

-- Revenue by trip: aggregates and GROUP BY.
select s.code, count(b.id) as booking_count,
       coalesce(sum(b.total) filter (where b.payment_status = 'PAID'), 0) as collected_revenue,
       coalesce(sum(b.total) filter (where b.payment_status = 'UNPAID' and b.status <> 'CANCELLED'), 0) as pending_revenue
from public.sailing s left join public.booking b on b.sailing_code = s.code
group by s.code order by s.code;

-- Boarding history.
select p.full_name, e.event_type, e.staff_uid, e.created_at
from public.boarding_event e join public.booking_passenger p on p.id = e.passenger_id
order by e.created_at desc;

-- Public API call. Authenticated operations automatically use the session's UID.
select public.barkolink_execute('BrowseSailings', '{}'::jsonb);
