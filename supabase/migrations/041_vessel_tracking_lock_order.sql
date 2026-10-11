-- Acquire the vessel advisory lock in the booking trigger after the existing sailing-row lock.
-- A pre-lock in ReserveSailing could deadlock with automatic status updates holding that row.
create or replace function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; target_vessel uuid; target_port uuid; observed timestamptz; note_value text;
begin
  if operation in ('AdminVesselPositions','AdminConfirmVesselPort','AdminVesselAvailability') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVesselAvailability' then
      return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'issue',
        barkolink_private.vessel_departure_issue(v.id,(args->>'originPortId')::uuid,(args->>'departureAt')::timestamptz,nullif(args->>'excludeCode','')))), '[]') from public.vessel v where v.is_active));
    end if;
    if operation='AdminConfirmVesselPort' then
      target_vessel:=(args->>'vesselId')::uuid;target_port:=(args->>'portId')::uuid;observed:=(args->>'observedAt')::timestamptz;note_value:=trim(args->>'note');
      if observed is null or observed>now() or observed<now()-interval '24 hours' then raise exception 'Confirm a port observation within the last 24 hours.'; end if;
      if not exists(select 1 from public.port where id=target_port and is_active) then raise exception 'Choose an active port.'; end if;
      if not exists(select 1 from public.vessel where id=target_vessel and is_active) then raise exception 'Choose an active vessel.'; end if;
      perform pg_advisory_xact_lock(hashtextextended(target_vessel::text,4281));
      if exists(select 1 from barkolink_private.vessel_port_observation where vessel_id=target_vessel and observed_at>observed) then raise exception 'A newer port observation exists. Confirm the current location.'; end if;
      insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note) values(target_vessel,target_port,observed,actor_uid,note_value);
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'VESSEL_PORT_CONFIRMED','vessel',target_vessel::text,jsonb_build_object('port_id',target_port,'observed_at',observed,'note',note_value));
    end if;
    return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator','position',barkolink_private.vessel_position_at(v.id,now())) order by v.name),'[]') from public.vessel v where v.is_active),
      'ports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.port where is_active));
  end if;
  if operation='BrowseSailings' then
    return jsonb_build_object('sailings',(select coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at),'[]') from
      (select * from public.sailing where status='SCHEDULED' and departure_at>now() and
        barkolink_private.vessel_departure_issue(vessel_id,origin_port_id,departure_at,code) is null order by departure_at limit 50) s));
  end if;
  result:=barkolink_private.execute_flexible_discounts_v39(operation,args,actor_uid,actor_role);
  if operation='TicketingSailings' then
    result:=jsonb_set(result,'{sailings}',coalesce((select jsonb_agg(s) from jsonb_array_elements(result->'sailings') s join public.sailing t on t.code=s->>'code'
      where barkolink_private.vessel_departure_issue(t.vessel_id,t.origin_port_id,t.departure_at,t.code) is null),'[]'));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
