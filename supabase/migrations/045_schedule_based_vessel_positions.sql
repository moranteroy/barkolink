-- Routine tracking and booking availability follow the saved itinerary.
-- A manual port observation is an optional correction, never an automatic arrival.
create or replace function barkolink_private.vessel_position_at(vessel uuid, at_time timestamptz, exclude_code text default null)
returns jsonb language plpgsql stable set search_path='' as $$
declare anchor barkolink_private.vessel_port_observation; trip public.sailing;
  location uuid; expected boolean:=false; observed boolean; since_time timestamptz; latest_code text;
begin
  select * into anchor from barkolink_private.vessel_port_observation
    where vessel_id=vessel and observed_at<=at_time order by observed_at desc,created_at desc,id desc limit 1;
  observed:=found;
  if observed then
    location:=anchor.port_id;since_time:=anchor.observed_at;
  else
    -- The excluded trip still supplies its origin if it is the first voyage;
    -- it must not count as already underway when checking its own departure.
    select * into trip from public.sailing where vessel_id=vessel and status<>'CANCELLED'
      order by departure_at,code limit 1;
    if not found then return jsonb_build_object('state','UNKNOWN','reason','Add a saved trip to establish the vessel itinerary.'); end if;
    location:=trip.origin_port_id;since_time:='-infinity';expected:=true;latest_code:=trip.code;
  end if;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and code is distinct from exclude_code and departure_at>=since_time and departure_at<=at_time
    order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','reason','The vessel itinerary has a port mismatch. Correct its trips or record a location correction.','tripCode',trip.code);
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','reason','A previous voyage is delayed. Update the voyage schedule before opening a dependent departure.','tripCode',trip.code);
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','basis','SCHEDULE','reason','The vessel is assigned to another voyage at this time (schedule estimate).',
        'originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,'tripCode',trip.code,'arrivalAt',trip.arrival_at);
    end if;
    location:=trip.destination_port_id;expected:=true;latest_code:=trip.code;
  end loop;
  return jsonb_strip_nulls(jsonb_build_object('state',case when expected then 'EXPECTED' else 'CONFIRMED' end,
    'basis',case when expected then 'SCHEDULE' else 'TERMINAL' end,
    'portId',location,'portName',(select name from public.port where id=location),
    'tripCode',latest_code,
    'confirmedPortName',case when observed then (select name from public.port where id=anchor.port_id) end,
    'confirmedAt',case when observed then anchor.observed_at end,
    'confirmationNote',case when observed then anchor.note end));
end $$;
revoke all on function barkolink_private.vessel_position_at(uuid,timestamptz,text) from public,anon,authenticated;
