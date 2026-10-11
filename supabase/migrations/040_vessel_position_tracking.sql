-- Confirmed terminal observations are separate from estimated sailing positions.
create table barkolink_private.vessel_port_observation (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references public.vessel(id),
  port_id uuid not null references public.port(id),
  observed_at timestamptz not null,
  confirmed_by_uid text not null,
  note text not null check(length(trim(note)) between 3 and 500),
  created_at timestamptz not null default now()
);
create index vessel_observation_latest on barkolink_private.vessel_port_observation(vessel_id,observed_at desc,created_at desc);
revoke all on barkolink_private.vessel_port_observation from public,anon,authenticated;

create function barkolink_private.vessel_position_at(vessel uuid, at_time timestamptz, exclude_code text default null)
returns jsonb language plpgsql stable set search_path='' as $$
declare anchor barkolink_private.vessel_port_observation; trip public.sailing; location uuid; expected boolean:=false;
begin
  select * into anchor from barkolink_private.vessel_port_observation
    where vessel_id=vessel and observed_at<=at_time order by observed_at desc,created_at desc,id desc limit 1;
  if not found then return jsonb_build_object('state','UNKNOWN','reason','Confirm the vessel port before opening bookings.'); end if;
  location:=anchor.port_id;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and code is distinct from exclude_code and departure_at>=anchor.observed_at and departure_at<=at_time
    order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','reason','The vessel itinerary has a port mismatch. Correct its trips or confirm its latest port.','tripCode',trip.code);
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','reason','A previous voyage is delayed. Confirm arrival and reschedule before opening another trip.','tripCode',trip.code);
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','reason','The vessel is assigned to another voyage at this time.','originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,'tripCode',trip.code,'arrivalAt',trip.arrival_at);
    end if;
    location:=trip.destination_port_id;expected:=true;
  end loop;
  return jsonb_build_object('state',case when expected then 'EXPECTED' else 'CONFIRMED' end,'portId',location,
    'portName',(select name from public.port where id=location),'confirmedPortName',(select name from public.port where id=anchor.port_id),
    'confirmedAt',anchor.observed_at,'confirmationNote',anchor.note);
end $$;

create function barkolink_private.vessel_departure_issue(vessel uuid, origin uuid, departure timestamptz, exclude_code text)
returns text language plpgsql stable set search_path='' as $$
declare position jsonb;
begin
  if not exists(select 1 from public.vessel where id=vessel_departure_issue.vessel and is_active) or not exists(select 1 from public.port where id=origin and is_active) then return 'The vessel or departure port is inactive.'; end if;
  -- Exclude the trip being evaluated: its own departure does not make it underway.
  position:=barkolink_private.vessel_position_at(vessel,departure,exclude_code);
  if position->>'state' not in ('EXPECTED','CONFIRMED') then return position->>'reason'; end if;
  if (position->>'portId')::uuid<>origin then return 'The vessel will be at '||coalesce(position->>'portName','another port')||' at departure. Choose a vessel that can reach the origin port.'; end if;
  return null;
end $$;

create function barkolink_private.check_vessel_port_chain() returns trigger language plpgsql set search_path='' as $$
declare issue text; next_trip public.sailing;
begin
  if new.status not in ('SCHEDULED','BOARDING') or new.departure_at<=now() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vessel_id::text,4281));
  -- Unknown position permits draft scheduling, but never a new reservation.
  if exists(select 1 from barkolink_private.vessel_port_observation where vessel_id=new.vessel_id and observed_at<=new.departure_at) then
    issue:=barkolink_private.vessel_departure_issue(new.vessel_id,new.origin_port_id,new.departure_at,new.code);
    if issue is not null then raise exception '%',issue; end if;
  select * into next_trip from public.sailing where vessel_id=new.vessel_id and code<>new.code and status<>'CANCELLED'
    and departure_at>=new.arrival_at order by departure_at,code limit 1;
  if found and next_trip.origin_port_id<>new.destination_port_id then raise exception 'This trip ends at a different port from the vessel next departure. Add its transfer voyage or choose another vessel.'; end if;
  end if;
  return new;
end $$;
create trigger vessel_port_chain before insert or update of vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,status
  on public.sailing for each row execute function barkolink_private.check_vessel_port_chain();

create function barkolink_private.check_booking_vessel_port() returns trigger language plpgsql set search_path='' as $$
declare trip public.sailing; issue text;
begin
  if new.status not in ('PENDING','CONFIRMED') then return new; end if;
  select * into trip from public.sailing where code=new.sailing_code;
  perform pg_advisory_xact_lock(hashtextextended(trip.vessel_id::text,4281));
  issue:=barkolink_private.vessel_departure_issue(trip.vessel_id,trip.origin_port_id,trip.departure_at,trip.code);
  if issue is not null then raise exception '%',issue; end if;
  return new;
end $$;
create trigger booking_vessel_port before insert on public.booking for each row execute function barkolink_private.check_booking_vessel_port();

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v39;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
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
