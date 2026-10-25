-- Rotate eligible vessels instead of assigning every route departure to one ship.
alter table barkolink_private.daily_schedule add column assignment_mode text not null default 'FIXED'
  check(assignment_mode in ('FIXED','FLEET'));

create or replace function barkolink_private.generate_daily_trips() returns integer
language plpgsql security definer set search_path='' as $$
declare slot record; ship public.vessel; fares public.fare_settings; policy barkolink_private.sailing_status_policy;
  minutes integer; trip_code text; created integer:=0; chosen boolean; attempts jsonb; matched_code text;
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
      if slot.assignment_mode='FIXED' and slot.vessel_id is null then raise exception 'Assign a vessel in Edit schedule to start automatic trips.'; end if;
      minutes:=coalesce(slot.route_minutes,slot.duration_minutes);
      if minutes is null or minutes<=0 then raise exception 'Set the route duration before generating trips.'; end if;
      select * into policy from barkolink_private.sailing_status_policy where operator=slot.operator;
      if not found or policy.boarding_lead_minutes is null then raise exception 'Set the operator-confirmed boarding policy.'; end if;
      chosen:=false;attempts:='[]';
      for ship in
        select v.* from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
        where vr.route_id=slot.route_id and v.is_active and v.passenger_capacity is not null
          and v.reference_metadata->>'operator'=slot.operator
          and (slot.assignment_mode='FLEET' or v.id=slot.vessel_id)
        order by
          case when exists(select 1 from public.sailing t where t.vessel_id=v.id and t.departure_at=slot.departure
            and t.origin_port_id=slot.origin_port_id and t.destination_port_id=slot.destination_port_id and t.daily_schedule_id is null) then 0 else 1 end,
          (select count(*) from public.sailing t where t.vessel_id=v.id and t.departure_at>=now() and t.status<>'CANCELLED'),v.id
        for update of v
      loop
        begin
          select * into fares from public.fare_settings where code=ship.id::text;
          if not found then raise exception 'Save fare settings for this vessel.'; end if;
          select code into matched_code from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
            and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null order by code limit 1;
          if found then
            update public.sailing set daily_schedule_id=slot.id,daily_service_date=slot.service_date,daily_departure_time=slot.departure_time where code=matched_code;
            chosen:=true;exit;
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
          created:=created+1;chosen:=true;exit;
        exception when others then
          attempts:=attempts||jsonb_build_array(jsonb_build_object('vessel',ship.name,'reason',sqlerrm));
        end;
      end loop;
      if not chosen then
        update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(jsonb_build_object(
          'departureAt',slot.departure,
          'reason',case when jsonb_array_length(attempts)=0 then 'No active vessel is assigned to this operator and route.'
            when slot.assignment_mode='FIXED' then attempts->0->>'reason'
            else 'No vessel is available at the departure port for this time. Review vessel locations and conflicting trips.' end,
          'vesselIssues',attempts)) where id=slot.id and jsonb_array_length(generation_issues)<10;
      end if;
    exception when others then
      -- One blocked departure must not prevent other vessels from being scheduled.
      update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(
        jsonb_build_object('departureAt',slot.departure,'reason',sqlerrm))
        where id=slot.id and jsonb_array_length(generation_issues)<10;
    end;
  end loop;
  return created;
end $$;

create or replace function barkolink_private.execute_daily_automation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; schedule_id uuid; selected_vessel uuid; selected_mode text;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    raise exception 'Unknown daily schedule operation.';
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation='AdminSaveDailySchedule' then
    selected_mode:=coalesce(nullif(args->>'assignmentMode',''),case when nullif(args->>'vesselId','') is not null then 'FIXED' end,
      (select assignment_mode from barkolink_private.daily_schedule where id=nullif(args->>'id','')::uuid),'FLEET');
    if selected_mode not in ('FIXED','FLEET') then raise exception 'Choose automatic fleet rotation or a fixed vessel.'; end if;
    selected_vessel:=case when selected_mode='FIXED' then nullif(args->>'vesselId','')::uuid end;
    if selected_mode='FIXED' and coalesce((args->>'isActive')::boolean,false) and selected_vessel is null then raise exception 'Assign a vessel before activating automatic daily trips.'; end if;
    if selected_vessel is not null and not exists(select 1 from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
      where v.id=selected_vessel and v.is_active and v.reference_metadata->>'operator'=args->>'operator'
      and vr.route_id=(args->>'routeId')::uuid) then raise exception 'Choose an active vessel assigned to this operator and route.'; end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
    select id into schedule_id from barkolink_private.daily_schedule where operator=trim(args->>'operator') and route_id=(args->>'routeId')::uuid;
    update barkolink_private.daily_schedule set vessel_id=selected_vessel,assignment_mode=selected_mode where id=schedule_id;
  elsif operation='AdminSetDailyScheduleActive' then
    if (args->>'isActive')::boolean and exists(select 1 from barkolink_private.daily_schedule where id=(args->>'id')::uuid and vessel_id is null and assignment_mode='FIXED') then
      raise exception 'Assign a vessel in Edit schedule before resuming automatic trips.';
    end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
  end if;
  if operation<>'AdminDailySchedules' then perform barkolink_private.generate_daily_trips(); end if;
  result:=barkolink_private.execute_flexible_discounts_v50('AdminDailySchedules','{}',actor_uid,actor_role);
  return result || jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(item||jsonb_build_object('vesselId',s.vessel_id,'vesselName',v.name,'assignmentMode',s.assignment_mode,
      'fleetCount',(select count(*) from public.vessel fv join public.vessel_route vr on vr.vessel_id=fv.id
        where vr.route_id=s.route_id and fv.is_active and fv.passenger_capacity is not null and fv.reference_metadata->>'operator'=s.operator),
      'generationIssues',s.generation_issues,'lastGeneratedAt',s.last_generated_at,
      'generatedCount',(select count(*) from public.sailing t where t.daily_schedule_id=s.id and t.departure_at>now() and t.status<>'CANCELLED')) order by position),'[]')
      from jsonb_array_elements(result->'schedules') with ordinality entries(item,position)
      join barkolink_private.daily_schedule s on s.id=(item->>'id')::uuid left join public.vessel v on v.id=s.vessel_id),
    'vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator',
      'routeIds',(select coalesce(jsonb_agg(vr.route_id),'[]') from public.vessel_route vr where vr.vessel_id=v.id)) order by v.name),'[]')
      from public.vessel v where v.is_active and v.passenger_capacity is not null));
end $$;

revoke all on all functions in schema barkolink_private from public,anon,authenticated;
