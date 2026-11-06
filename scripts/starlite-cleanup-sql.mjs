export const fleetTargetsSql = `
create temporary table fleet_remove_vessels on commit drop as select id,code from public.vessel where coalesce(reference_metadata->>'operator','')<>'Starlite Ferries';
create temporary table fleet_remove_trips on commit drop as select code from public.sailing where vessel_id in(select id from fleet_remove_vessels);
create temporary table fleet_remove_bookings on commit drop as select id,reference from public.booking where sailing_code in(select code from fleet_remove_trips);
create temporary table fleet_remove_passengers on commit drop as select id from public.booking_passenger where booking_id in(select id from fleet_remove_bookings);
do $$ begin
  if (select count(*) from public.vessel where id not in(select id from fleet_remove_vessels))<>5 or
    exists(select 1 from public.vessel where id not in(select id from fleet_remove_vessels) and code not in('SL-ANNAPOLIS','SL-JUPITER','SL-PACIFIC','SL-SPRINT-1','SL-SWM-STELLA-DEL-MAR')) then
    raise exception 'Expected exactly the five reviewed Starlite vessels; cleanup aborted.';end if;
  if exists(select 1 from fleet_remove_trips where code !~ '^[A-Za-z0-9_-]+$') or exists(select 1 from fleet_remove_bookings where reference !~ '^[A-Za-z0-9_-]+$') then
    raise exception 'Unreviewed record identifier format; notification cleanup aborted.';end if;
end $$;
create temporary table fleet_remove_notifications on commit drop as select n.id from public.notification n
where n.campaign_id in(select id from public.notification_campaign where sailing_code in(select code from fleet_remove_trips))
   or exists(select 1 from fleet_remove_trips t where n.title||' '||n.message ~ ('(^|[^[:alnum:]_-])'||t.code||'([^[:alnum:]_-]|$)'))
   or exists(select 1 from fleet_remove_bookings b where n.title||' '||n.message ~ ('(^|[^[:alnum:]_-])'||b.reference||'([^[:alnum:]_-]|$)'));
`;

// Hash every retained row, not just counts. Temp target IDs remain after deletion.
const guards = {
  port: 'true',
  vessel: 'id not in(select id from fleet_remove_vessels)',
  fare_settings:
    'code not in(select id::text from fleet_remove_vessels) and code not in(select code from fleet_remove_vessels)',
  sailing: 'code not in(select code from fleet_remove_trips)',
  booking: 'id not in(select id from fleet_remove_bookings)',
  booking_passenger: 'id not in(select id from fleet_remove_passengers)',
  online_payment: 'booking_id not in(select id from fleet_remove_bookings)',
  boarding_event: 'passenger_id not in(select id from fleet_remove_passengers)',
  passenger_no_show: 'passenger_id not in(select id from fleet_remove_passengers)',
  notification: 'id not in(select id from fleet_remove_notifications)',
  accommodation: 'vessel_id not in(select id from fleet_remove_vessels)',
  vessel_route: 'vessel_id not in(select id from fleet_remove_vessels)',
  travel_advisory:
    'sailing_code is null or sailing_code not in(select code from fleet_remove_trips)',
  notification_campaign:
    'sailing_code is null or sailing_code not in(select code from fleet_remove_trips)',
  voucher: 'true',
  saved_traveler: 'true',
  operation_settings: 'true',
  ferry_route: 'true',
  port_weather_cache: 'true',
};
export const retainedFleetExpression = `jsonb_build_object(${Object.entries(guards)
  .map(
    ([table, where]) =>
      `'${table}',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public.${table} x where ${where})`,
  )
  .join(',')},
  'positions',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from barkolink_private.vessel_port_observation x where vessel_id not in(select id from fleet_remove_vessels)),
  'schedules',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from barkolink_private.daily_schedule x where operator='Starlite Ferries'),
  'policies',(select coalesce(jsonb_agg(to_jsonb(x) order by operator),'[]') from barkolink_private.sailing_status_policy x where operator='Starlite Ferries'),
  'users',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by uid),'[]')::text) from public.app_user u),
  'auth',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by id),'[]')::text) from auth.users u))`;

export const deleteNonStarliteSql = `
create temporary table retained_fleet_guard on commit drop as select md5((${retainedFleetExpression})::text) fingerprint;
delete from public.boarding_event where passenger_id in(select id from fleet_remove_passengers);
delete from public.passenger_no_show where passenger_id in(select id from fleet_remove_passengers);
delete from public.online_payment where booking_id in(select id from fleet_remove_bookings);
delete from public.booking_passenger where id in(select id from fleet_remove_passengers);
delete from public.booking where id in(select id from fleet_remove_bookings);
delete from public.notification where id in(select id from fleet_remove_notifications);
delete from public.notification_campaign where sailing_code in(select code from fleet_remove_trips);
delete from public.travel_advisory where sailing_code in(select code from fleet_remove_trips);
delete from public.sailing where code in(select code from fleet_remove_trips);
delete from barkolink_private.vessel_port_observation where vessel_id in(select id from fleet_remove_vessels);
delete from public.accommodation where vessel_id in(select id from fleet_remove_vessels);
delete from public.vessel_route where vessel_id in(select id from fleet_remove_vessels);
delete from public.fare_settings where code in(select id::text from fleet_remove_vessels) or code in(select code from fleet_remove_vessels);
delete from public.vessel where id in(select id from fleet_remove_vessels);
delete from barkolink_private.daily_schedule where operator<>'Starlite Ferries';
delete from barkolink_private.sailing_status_policy where operator<>'Starlite Ferries';
do $$ begin
  if (select fingerprint from retained_fleet_guard) is distinct from md5((${retainedFleetExpression})::text) then
    raise exception 'Retained Starlite or unrelated records changed; cleanup rolled back.';end if;
  if (select count(*) from public.vessel)<>5 or exists(select 1 from public.vessel where coalesce(reference_metadata->>'operator','')<>'Starlite Ferries') then
    raise exception 'Fleet cleanup did not retain exactly five Starlite vessels.';end if;
end $$;
insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
values(null,'NON_STARLITE_FLEET_REMOVED','vessel','Starlite-only fleet',jsonb_build_object('authorization','Owner requested deletion of non-Starlite vessels and linked trip/booking/passenger/payment history',
  'removedVessels',(select count(*) from fleet_remove_vessels),'removedTrips',(select count(*) from fleet_remove_trips),
  'removedBookings',(select count(*) from fleet_remove_bookings),'removedPassengers',(select count(*) from fleet_remove_passengers)));
`;
