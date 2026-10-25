-- Validate connected itineraries even without a manual terminal observation.
create or replace function barkolink_private.check_vessel_port_chain()
returns trigger language plpgsql set search_path='' as $$
declare issue text; next_trip public.sailing;
begin
  if new.status not in ('SCHEDULED','BOARDING') or new.departure_at<=now() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vessel_id::text,4281));
  -- The first saved voyage can establish an itinerary's starting port.
  -- Every later voyage must respect the preceding voyage or terminal observation.
  if exists(select 1 from barkolink_private.vessel_port_observation
      where vessel_id=new.vessel_id and observed_at<=new.departure_at)
    or exists(select 1 from public.sailing where vessel_id=new.vessel_id
      and code<>new.code and status<>'CANCELLED' and departure_at<=new.departure_at) then
    issue:=barkolink_private.vessel_departure_issue(new.vessel_id,new.origin_port_id,new.departure_at,new.code);
    if issue is not null then raise exception '%',issue; end if;
  end if;
  select * into next_trip from public.sailing where vessel_id=new.vessel_id
    and code<>new.code and status<>'CANCELLED' and departure_at>=new.arrival_at
    order by departure_at,code limit 1;
  if found and next_trip.origin_port_id<>new.destination_port_id then
    raise exception 'This trip ends at a different port from the vessel next departure. Add its transfer voyage or choose another vessel.';
  end if;
  return new;
end $$;
revoke all on function barkolink_private.check_vessel_port_chain() from public,anon,authenticated;
