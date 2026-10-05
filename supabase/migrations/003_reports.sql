-- PostgreSQL report aggregation: joins, lateral queries, counts and sums.
create function barkolink_private.reports(args jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare start_at timestamptz := (args->>'startAt')::timestamptz; end_at timestamptz := (args->>'endAt')::timestamptz; result jsonb;
begin
  if start_at is null or end_at is null or end_at <= start_at or end_at - start_at > interval '366 days' then
    raise exception 'Choose a report range of up to 366 days.';
  end if;
  select jsonb_build_object('sailings', coalesce(jsonb_agg(to_jsonb(report)), '[]')) into result from (
SELECT s.code, s.departure_at AS "departureAt", s.status,
      s.origin_port_id::text AS "originId", o.name AS origin,
      s.destination_port_id::text AS "destinationId", d.name AS destination,
      s.vessel_id::text AS "vesselId", v.name AS vessel, v.passenger_capacity AS capacity,
      GREATEST(0, v.passenger_capacity - s.available_seats) AS "reservedSeats",
      b."bookingCount", b."paidBookings", b."pendingBookings", b."cancelledBookings",
      b."collectedRevenue", b."pendingRevenue", b."onlineBookings", b."walkInBookings",
      b."activePassengers", p."paidPassengers", p."checkedIn", p.boarded,
      p.regular, p.student, p.senior, p.child, p.pwd
    FROM public.sailing s
    JOIN public.port o ON o.id = s.origin_port_id
    JOIN public.port d ON d.id = s.destination_port_id
    JOIN public.vessel v ON v.id = s.vessel_id
    CROSS JOIN LATERAL (
      SELECT count(*) AS "bookingCount",
        count(*) FILTER (WHERE payment_status = 'PAID' AND status IN ('PENDING', 'CONFIRMED')) AS "paidBookings",
        count(*) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')) AS "pendingBookings",
        count(*) FILTER (WHERE status = 'CANCELLED') AS "cancelledBookings",
        COALESCE(sum(total) FILTER (WHERE payment_status = 'PAID'), 0) AS "collectedRevenue",
        COALESCE(sum(total) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')), 0) AS "pendingRevenue",
        count(*) FILTER (WHERE booking_channel = 'ONLINE') AS "onlineBookings",
        count(*) FILTER (WHERE booking_channel = 'WALK_IN') AS "walkInBookings",
        COALESCE(sum(passenger_count) FILTER (WHERE status IN ('PENDING', 'CONFIRMED')), 0) AS "activePassengers"
      FROM public.booking WHERE sailing_code = s.code
    ) b
    CROSS JOIN LATERAL (
      SELECT count(*) AS "paidPassengers",
        count(*) FILTER (WHERE bp.ticket_status IN ('CHECKED_IN', 'BOARDED')) AS "checkedIn",
        count(*) FILTER (WHERE bp.ticket_status = 'BOARDED') AS boarded,
        count(*) FILTER (WHERE bp.passenger_type = 'REGULAR') AS regular,
        count(*) FILTER (WHERE bp.passenger_type = 'STUDENT') AS student,
        count(*) FILTER (WHERE bp.passenger_type = 'SENIOR') AS senior,
        count(*) FILTER (WHERE bp.passenger_type = 'CHILD') AS child,
        count(*) FILTER (WHERE bp.passenger_type = 'PWD') AS pwd
      FROM public.booking_passenger bp JOIN public.booking pb ON pb.id = bp.booking_id
      WHERE pb.sailing_code = s.code AND pb.status = 'CONFIRMED' AND pb.payment_status = 'PAID'
    ) p
    WHERE s.departure_at >= start_at AND s.departure_at < end_at
      AND end_at > start_at AND end_at - start_at <= interval '366 days'
    ORDER BY s.departure_at, s.code
  ) report;
  return result;
end $$;
revoke all on function barkolink_private.reports(jsonb) from public, anon, authenticated;
