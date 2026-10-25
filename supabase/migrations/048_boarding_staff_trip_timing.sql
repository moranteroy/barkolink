-- Boarding staff may override one departing trip at their assigned active port.
-- Operator-wide policy and departure/status administration remain Admin-only.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text)
  rename to execute_flexible_discounts_v47;

create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare trip public.sailing; assigned uuid; policy barkolink_private.sailing_status_policy;
  boarding_time timestamptz; reason text; previous_time timestamptz; effective_time timestamptz;
begin
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

revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;
revoke all on function barkolink_private.execute_flexible_discounts_v47(text,jsonb,text,text) from public,anon,authenticated;
