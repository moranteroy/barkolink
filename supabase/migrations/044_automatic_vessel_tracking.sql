-- Display-only estimates may start from a saved itinerary. Booking eligibility
-- continues to use vessel_position_at and its confirmed starting observation.
create function barkolink_private.vessel_display_position_at(vessel uuid, at_time timestamptz)
returns jsonb language plpgsql stable set search_path='' as $$
declare position jsonb; trip public.sailing; location uuid; last_trip public.sailing;
begin
  position:=barkolink_private.vessel_position_at(vessel,at_time);
  if position->>'state'<>'UNKNOWN' then
    return position || jsonb_build_object('basis',case when position->>'state'='CONFIRMED' then 'TERMINAL' else 'SCHEDULE' end);
  end if;
  select * into trip from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    order by departure_at,code limit 1;
  if not found then
    return jsonb_build_object('state','UNKNOWN','reason','No saved voyage or confirmed port is available.');
  end if;
  location:=trip.origin_port_id;
  last_trip:=trip;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and departure_at<=at_time order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','basis','SCHEDULE','tripCode',trip.code,
        'reason','Scheduled voyages have a port mismatch. Review the itinerary or confirm the current port.');
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','basis','SCHEDULE','tripCode',trip.code,
        'reason','The voyage is delayed. Confirm the current port or correct its schedule.');
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','basis','SCHEDULE','tripCode',trip.code,
        'originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,
        'departureAt',trip.departure_at,'arrivalAt',trip.arrival_at,
        'reason','Estimated from scheduled departure and arrival; actual departure is not confirmed.');
    end if;
    location:=trip.destination_port_id;
    last_trip:=trip;
  end loop;
  return jsonb_build_object('state','EXPECTED','basis','SCHEDULE','portId',location,
    'portName',(select name from public.port where id=location),
    'tripCode',coalesce(last_trip.code,trip.code),
    'reason','Estimated from saved voyages. Confirm the actual port with the terminal.');
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text)
  rename to execute_flexible_discounts_v43;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  -- Delegate identity, permissions, confirmations, and all booking checks unchanged.
  result:=barkolink_private.execute_flexible_discounts_v43(operation,args,actor_uid,actor_role);
  if operation in ('AdminVesselPositions','AdminConfirmVesselPort') then
    result:=jsonb_set(result,'{vessels}',coalesce((select jsonb_agg(
      jsonb_set(item,'{position}',barkolink_private.vessel_display_position_at((item->>'id')::uuid,now()))
      order by item->>'name',item->>'id') from jsonb_array_elements(result->'vessels') item),'[]'::jsonb));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
