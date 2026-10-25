-- A saved daily schedule assigns one vessel; a database clock creates actual trips.
alter table barkolink_private.daily_schedule
  add column vessel_id uuid references public.vessel,
  add column generation_issues jsonb not null default '[]',
  add column last_generated_at timestamptz;
alter table public.sailing
  add column daily_schedule_id uuid references barkolink_private.daily_schedule,
  add column daily_service_date date,
  add column daily_departure_time text,
  add constraint daily_trip_source_complete check (
    (daily_schedule_id is null and daily_service_date is null and daily_departure_time is null) or
    (daily_schedule_id is not null and daily_service_date is not null and daily_departure_time is not null)),
  add constraint daily_trip_occurrence unique(daily_schedule_id,daily_service_date,daily_departure_time);

create function barkolink_private.generate_daily_trips() returns integer
language plpgsql security definer set search_path='' as $$
declare slot record; ship public.vessel; fares public.fare_settings; policy barkolink_private.sailing_status_policy;
  minutes integer; trip_code text; created integer:=0;
begin
  if not pg_try_advisory_xact_lock(hashtext('barkolink-generate-daily-trips')) then return 0; end if;
  update barkolink_private.daily_schedule set generation_issues='[]',last_generated_at=now() where is_active;
  -- All routes are processed together chronologically, so outbound/return pairs connect.
  for slot in
    select s.*,r.origin_port_id,r.destination_port_id,r.duration_minutes as route_minutes,
      r.is_active and o.is_active and d.is_active as route_active,
      (now() at time zone 'Asia/Manila')::date + day_offset as service_date, departure_time,
      (((now() at time zone 'Asia/Manila')::date + day_offset) + departure_time::time) at time zone 'Asia/Manila' as departure
    from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id
    join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
    cross join generate_series(0,6) day_offset cross join unnest(s.departure_times) departure_time
    where s.is_active
    order by departure,s.id
  loop
    if slot.departure<=now() or exists(select 1 from public.sailing where daily_schedule_id=slot.id
      and daily_service_date=slot.service_date and daily_departure_time=slot.departure_time) then continue; end if;
    begin
      if not slot.route_active then raise exception 'Activate the route and both ports.'; end if;
      if slot.vessel_id is null then raise exception 'Assign a vessel in Edit schedule to start automatic trips.'; end if;
      select * into ship from public.vessel where id=slot.vessel_id for update;
      if not found or not ship.is_active or ship.passenger_capacity is null then raise exception 'Choose an active vessel with passenger capacity.'; end if;
      if ship.reference_metadata->>'operator' is distinct from slot.operator or not exists(
        select 1 from public.vessel_route where vessel_id=ship.id and route_id=slot.route_id) then
        raise exception 'Assign a vessel that serves this operator and route.';
      end if;
      minutes:=coalesce(slot.route_minutes,slot.duration_minutes);
      if minutes is null or minutes<=0 then raise exception 'Set the route duration before generating trips.'; end if;
      select * into fares from public.fare_settings where code=ship.id::text;
      if not found then raise exception 'Save fare settings for the assigned vessel.'; end if;
      select * into policy from barkolink_private.sailing_status_policy where operator=slot.operator;
      if not found or policy.boarding_lead_minutes is null then raise exception 'Set the operator-confirmed boarding policy.'; end if;
      -- Link a matching manual trip rather than duplicate it. Cancelled occurrences stay cancelled.
      if exists(select 1 from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
        and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null) then
        update public.sailing set daily_schedule_id=slot.id,daily_service_date=slot.service_date,daily_departure_time=slot.departure_time
          where code=(select code from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
            and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null order by code limit 1);
        continue;
      end if;
      trip_code:='DLY'||to_char(slot.service_date,'YYYYMMDD')||'-'||upper(substr(md5(slot.id::text||slot.departure_time),1,12));
      insert into public.sailing(code,vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,duration_minutes,
        regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,boarding_at,boarding_time_source,
        daily_schedule_id,daily_service_date,daily_departure_time)
      values(trip_code,ship.id,slot.origin_port_id,slot.destination_port_id,slot.departure,slot.departure+make_interval(mins=>minutes),minutes,
        fares.regular_fare,greatest(1,round(fares.regular_fare*(100-fares.student_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.senior_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.child_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pwd_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pregnant_discount)::numeric/100)::integer),ship.passenger_capacity,
        slot.departure-make_interval(mins=>policy.boarding_lead_minutes),policy.boarding_time_source,
        slot.id,slot.service_date,slot.departure_time);
      created:=created+1;
    exception when others then
      -- One blocked departure must not prevent other vessels from being scheduled.
      update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(
        jsonb_build_object('departureAt',slot.departure,'reason',sqlerrm))
        where id=slot.id and jsonb_array_length(generation_issues)<10;
    end;
  end loop;
  return created;
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v50;
create function barkolink_private.execute_daily_automation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; schedule_id uuid; selected_vessel uuid;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    raise exception 'Unknown daily schedule operation.';
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation='AdminSaveDailySchedule' then
    selected_vessel:=nullif(args->>'vesselId','')::uuid;
    if coalesce((args->>'isActive')::boolean,false) and selected_vessel is null then raise exception 'Assign a vessel before activating automatic daily trips.'; end if;
    if selected_vessel is not null and not exists(select 1 from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
      where v.id=selected_vessel and v.is_active and v.reference_metadata->>'operator'=args->>'operator'
      and vr.route_id=(args->>'routeId')::uuid) then raise exception 'Choose an active vessel assigned to this operator and route.'; end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
    select id into schedule_id from barkolink_private.daily_schedule where operator=trim(args->>'operator') and route_id=(args->>'routeId')::uuid;
    update barkolink_private.daily_schedule set vessel_id=selected_vessel where id=schedule_id;
  elsif operation='AdminSetDailyScheduleActive' then
    if (args->>'isActive')::boolean and exists(select 1 from barkolink_private.daily_schedule where id=(args->>'id')::uuid and vessel_id is null) then
      raise exception 'Assign a vessel in Edit schedule before resuming automatic trips.';
    end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
  end if;
  if operation<>'AdminDailySchedules' then perform barkolink_private.generate_daily_trips(); end if;
  result:=barkolink_private.execute_flexible_discounts_v50('AdminDailySchedules','{}',actor_uid,actor_role);
  return result || jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(item||jsonb_build_object('vesselId',s.vessel_id,'vesselName',v.name,
      'generationIssues',s.generation_issues,'lastGeneratedAt',s.last_generated_at,
      'generatedCount',(select count(*) from public.sailing t where t.daily_schedule_id=s.id and t.departure_at>now() and t.status<>'CANCELLED')) order by position),'[]')
      from jsonb_array_elements(result->'schedules') with ordinality entries(item,position)
      join barkolink_private.daily_schedule s on s.id=(item->>'id')::uuid left join public.vessel v on v.id=s.vessel_id),
    'vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator',
      'routeIds',(select coalesce(jsonb_agg(vr.route_id),'[]') from public.vessel_route vr where vr.vessel_id=v.id)) order by v.name),'[]')
      from public.vessel v where v.is_active and v.passenger_capacity is not null));
end $$;
-- Keep the existing non-daily dispatch depth and Boarding authorization unchanged.
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare trip public.sailing; assigned uuid; policy barkolink_private.sailing_status_policy;
  boarding_time timestamptz; reason text; previous_time timestamptz; effective_time timestamptz;
begin
  if operation in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    return barkolink_private.execute_daily_automation(operation,args,actor_uid,actor_role);
  end if;
  if operation not in ('BoardingSailingTiming','BoardingSetSailingTiming') then
    return barkolink_private.execute_flexible_discounts_v47(operation,args,actor_uid,actor_role);
  end if;
  if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('BOARDING','ADMIN') then
    raise exception 'Boarding staff access required.' using errcode='42501';
  end if;
  if actor_role='BOARDING' then
    -- Hold the assignment until the read/save finishes, before locking the trip.
    select assigned_port_id into assigned from public.app_user where uid=actor_uid and role='BOARDING' for share;
    if assigned is null or not exists(select 1 from public.port where id=assigned and is_active) then
      raise exception 'No active port is assigned to your staff account. Ask an administrator to assign your port.' using errcode='42501';
    end if;
  end if;
  select * into trip from public.sailing where code=args->>'sailingCode' for update;
  if not found then raise exception 'Sailing was not found.'; end if;
  if actor_role='BOARDING' and trip.origin_port_id is distinct from assigned then
    raise exception 'This record is outside your assigned port.' using errcode='42501';
  end if;
  select p.* into policy from barkolink_private.sailing_status_policy p
    join public.vessel v on v.reference_metadata->>'operator'=p.operator where v.id=trip.vessel_id;
  previous_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  if operation='BoardingSetSailingTiming' then
    if trip.status not in ('SCHEDULED','BOARDING') or trip.departure_at<=now() then
      raise exception 'Adjust boarding time only for scheduled or boarding trips before departure.';
    end if;
    -- A stale dialog must not overwrite an Admin reschedule or another staff edit.
    if nullif(args->>'expectedUpdatedAt','') is null or
      (args->>'expectedUpdatedAt')::timestamptz is distinct from trip.updated_at then
      raise exception 'This trip changed. Reload its boarding details and try again.' using errcode='40001';
    end if;
    boarding_time:=nullif(args->>'boardingAt','')::timestamptz;
    reason:=nullif(trim(args->>'reason'),'');
    if boarding_time is null or not isfinite(boarding_time) or boarding_time>=trip.departure_at or
      boarding_time<trip.departure_at-interval '7 days' then
      raise exception 'Set boarding between 1 minute and 7 days before departure.';
    end if;
    if boarding_time>trip.departure_at-interval '1 minute' then
      raise exception 'Set boarding at least 1 minute before departure.';
    end if;
    if reason is null or length(reason) not between 5 and 500 then
      raise exception 'Enter a reason of 5 to 500 characters for the boarding time change.';
    end if;
    if trip.status='BOARDING' and boarding_time>now() then
      raise exception 'Boarding has already started. Ask an administrator to delay or reschedule the trip instead.';
    end if;
    update public.sailing set boarding_at=boarding_time,boarding_time_source=reason,updated_at=clock_timestamp()
      where code=trip.code returning * into trip;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'BOARDING_TIME_UPDATED','sailing',trip.code,jsonb_build_object(
        'boardingAt',jsonb_build_object('before',previous_time,'after',boarding_time),
        'departureAt',trip.departure_at,'reason',reason));
  end if;
  effective_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  return jsonb_build_object('timing',jsonb_build_object(
    'sailingCode',trip.code,'departureAt',trip.departure_at,'boardingAt',trip.boarding_at,
    'effectiveBoardingAt',effective_time,'boardingTimeSource',coalesce(trip.boarding_time_source,policy.boarding_time_source),
    'usesOperatorDefault',trip.boarding_at is null,'updatedAt',trip.updated_at,'status',trip.status,
    'canEdit',trip.status in ('SCHEDULED','BOARDING') and trip.departure_at>now()));
end $$;

revoke all on all functions in schema barkolink_private from public,anon,authenticated;

do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-generate-daily-trips','* * * * *','select barkolink_private.generate_daily_trips();')$schedule$;
  end if;
end $$;
