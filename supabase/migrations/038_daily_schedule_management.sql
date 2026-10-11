create function barkolink_private.valid_daily_times(times text[]) returns boolean language sql immutable set search_path='' as $$
  select coalesce(cardinality(times) between 1 and 48
    and (select bool_and(t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') from unnest(times) t)
    and cardinality(times)=(select count(distinct t) from unnest(times) t),false);
$$;
create table barkolink_private.daily_schedule (
  id uuid primary key default gen_random_uuid(),
  operator text not null check(length(trim(operator)) between 1 and 100),
  route_id uuid not null references public.ferry_route(id),
  departure_times text[] not null check(barkolink_private.valid_daily_times(departure_times)),
  duration_minutes integer check(duration_minutes between 1 and 10080),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(operator,route_id)
);
revoke all on barkolink_private.daily_schedule from public,anon,authenticated;
insert into barkolink_private.daily_schedule(operator,route_id,departure_times,duration_minutes,is_active)
select item->>'operator',r.id,array(select jsonb_array_elements_text(item->'departureTimes') order by 1),
  (item->>'durationMinutes')::integer,r.is_active and o.is_active and d.is_active
from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
cross join lateral jsonb_array_elements(coalesce(r.reference_metadata->'schedules','[]')) item
where item->>'operator' is not null and jsonb_typeof(item->'departureTimes')='array'
on conflict(operator,route_id) do nothing;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v37;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare record_id uuid; route_id_value uuid; operator_value text; times_value text[]; active_value boolean; result jsonb;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    return barkolink_private.execute_flexible_discounts_v37(operation,args,actor_uid,actor_role);
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation in ('AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    if jsonb_typeof(args->'isActive') is distinct from 'boolean' then raise exception 'Choose Active or Paused.'; end if;
    active_value:=(args->>'isActive')::boolean;record_id:=nullif(args->>'id','')::uuid;
    if operation='AdminSaveDailySchedule' then
      route_id_value:=(args->>'routeId')::uuid;operator_value:=trim(args->>'operator');
      if jsonb_typeof(args->'departureTimes') is distinct from 'array' then raise exception 'Enter daily departure times.'; end if;
      times_value:=array(select jsonb_array_elements_text(args->'departureTimes') order by 1);
      if not barkolink_private.valid_daily_times(times_value) then raise exception 'Enter 1 to 48 unique departure times in HH:MM format.'; end if;
      if not exists(select 1 from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id
        where vr.route_id=route_id_value and v.reference_metadata->>'operator'=operator_value) then
        raise exception 'Choose a route served by this operator.';
      end if;
    else
      select route_id,operator into route_id_value,operator_value from barkolink_private.daily_schedule where id=record_id for update;
      if not found then raise exception 'Daily schedule was not found.'; end if;
    end if;
    if active_value and not exists(select 1 from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
      where r.id=route_id_value and r.is_active and o.is_active and d.is_active) then raise exception 'Activate the route and both ports before resuming this daily schedule.'; end if;
    if operation='AdminSetDailyScheduleActive' then
      update barkolink_private.daily_schedule set is_active=active_value,updated_at=now() where id=record_id;
    elsif record_id is null then
      insert into barkolink_private.daily_schedule(operator,route_id,departure_times,duration_minutes,is_active)
        values(operator_value,route_id_value,times_value,nullif(args->>'durationMinutes','')::integer,active_value) returning id into record_id;
    else
      update barkolink_private.daily_schedule set operator=operator_value,route_id=route_id_value,departure_times=times_value,
        duration_minutes=nullif(args->>'durationMinutes','')::integer,is_active=active_value,updated_at=now() where id=record_id;
      if not found then raise exception 'Daily schedule was not found.'; end if;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'UPDATE','daily_schedule',record_id::text,jsonb_build_object('operator',operator_value,'is_active',active_value));
  end if;
  select jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'operator',s.operator,'routeId',r.id,'routeCode',r.code,
      'origin',o.name,'destination',d.name,'departureTimes',s.departure_times,'durationMinutes',s.duration_minutes,
      'isActive',s.is_active,'routeActive',r.is_active and o.is_active and d.is_active) order by (s.is_active and r.is_active and o.is_active and d.is_active) desc,s.operator,r.code),'[]')
      from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id),
    'routes',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'origin',o.name,'destination',d.name,'isActive',r.is_active and o.is_active and d.is_active,
      'operators',(select coalesce(jsonb_agg(distinct v.reference_metadata->>'operator'),'[]') from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id
        where vr.route_id=r.id and v.reference_metadata->>'operator' is not null)) order by r.code),'[]')
      from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id)) into result;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
