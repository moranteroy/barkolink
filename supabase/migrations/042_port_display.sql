-- Public terminal screens expose schedules and published notices only.
create function public.port_display(p_port uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  selected_port uuid;
begin
  if p_port is not null then
    select id into selected_port from public.port where id = p_port and is_active;
    if selected_port is null then raise exception 'Port is unavailable'; end if;
  else
    select id into selected_port from public.port where is_active order by name, id limit 1;
  end if;
  return jsonb_build_object(
    'date', to_char(day_start at time zone 'Asia/Manila', 'YYYY-MM-DD'),
    'updatedAt', now(), 'portId', selected_port,
    'ports', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'city', city) order by name, id)
      from public.port where is_active), '[]'::jsonb),
    'sailings', coalesce((select jsonb_agg(jsonb_build_object(
      'code', s.code, 'departureAt', s.departure_at, 'arrivalAt', s.arrival_at, 'status', s.status,
      'origin', jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city),
      'destination', jsonb_build_object('id', d.id, 'name', d.name, 'city', d.city),
      'vessel', jsonb_build_object('name', v.name), 'operator', v.reference_metadata->>'operator'
    ) order by s.departure_at, s.code)
    from public.sailing s join public.port o on o.id = s.origin_port_id
      join public.port d on d.id = s.destination_port_id join public.vessel v on v.id = s.vessel_id
    where o.is_active and d.is_active and (
      (s.origin_port_id = selected_port and s.departure_at >= day_start and s.departure_at < day_start + interval '1 day') or
      (s.destination_port_id = selected_port and s.arrival_at >= day_start and s.arrival_at < day_start + interval '1 day')
    )), '[]'::jsonb),
    'advisories', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'message', a.message, 'priority', a.priority, 'endsAt', a.ends_at
    ) order by case a.priority when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, a.starts_at desc, a.id)
    from public.travel_advisory a where selected_port is not null and a.published
      and a.starts_at <= now() and a.ends_at > now() and (
        a.sailing_code is null or exists (select 1 from public.sailing s where s.code = a.sailing_code
          and (s.origin_port_id = selected_port or s.destination_port_id = selected_port))
      )), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.port_display(uuid) from public;
grant execute on function public.port_display(uuid) to anon, authenticated, service_role;
