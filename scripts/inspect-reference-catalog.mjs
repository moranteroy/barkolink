import { queryLive } from './test-data-database.mjs';

if(process.argv.includes('--sailing-automation')) {
  const rows=await queryLive(`select jsonb_build_object(
    'job',(select jsonb_build_object('active',active,'schedule',schedule) from cron.job where jobname='barkolink-advance-sailing-statuses'),
    'latestRun',(select jsonb_build_object('status',status,'message',return_message) from cron.job_run_details where jobid=(select jobid from cron.job where jobname='barkolink-advance-sailing-statuses') order by start_time desc limit 1),
    'configuredOperators',(select count(*) from barkolink_private.sailing_status_policy),
    'confirmedTripBoardingTimes',(select count(*) from public.sailing where boarding_at is not null)) as data`);
  console.log(JSON.stringify(rows[0].data));process.exit(0);
}

if(process.argv.includes('--summary')) {
  const rows=await queryLive(`select jsonb_build_object(
    'activePorts',(select jsonb_agg(code order by code) from public.port where is_active),
    'activeOutsideArea',(select count(*) from public.port where is_active and coalesce(region,'') not in ('Batangas','Oriental Mindoro','Occidental Mindoro')),
    'referenceVessels',(select count(*) from public.vessel where reference_metadata->>'kind'='verified-reference'),
    'operators',(select jsonb_agg(distinct reference_metadata->>'operator') from public.vessel where reference_metadata->>'kind'='verified-reference'),
    'publishedTimetables',(select coalesce(sum(jsonb_array_length(reference_metadata->'schedules')),0) from public.ferry_route),
    'routeClassProfiles',(select coalesce(sum(jsonb_array_length(reference_metadata->'accommodationProfiles')),0) from public.ferry_route),
    'sailings',(select count(*) from public.sailing),
    'inactiveRouteViolations',(select count(*) from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id where r.is_active and (not o.is_active or not d.is_active))) as data`);
  console.log(JSON.stringify(rows[0].data));process.exit(0);
}

if (process.argv.includes('--verify-rpc')) {
  // The management API's read-only classifier rejects these VOLATILE dispatcher functions.
  // Only the known AdminVessels/AdminRoutes read branches are called; expiry is not invoked.
  const result = await queryLive(`select jsonb_build_object(
    'vessels',(barkolink_private.camel(barkolink_private.execute_flexible_discounts('AdminVessels','{}',(select uid from public.app_user where role='ADMIN' limit 1),'ADMIN')))->'vessels',
    'routes',(barkolink_private.camel(barkolink_private.execute_flexible_discounts('AdminRoutes','{}',(select uid from public.app_user where role='ADMIN' limit 1),'ADMIN')))->'routes') as data`, false);
  const data = result[0].data;
  const vessel = data.vessels.find(v => v.code === 'SL-ANNAPOLIS');
  console.log(JSON.stringify({ vessel: vessel.name, capacity: vessel.passengerCapacity,
    operator: vessel.referenceMetadata.operator, routes: vessel.routes.map(r => r.code),
    assignedReferences: data.vessels.filter(v => v.referenceMetadata?.kind === 'verified-reference' && v.routes.length).length,
    batangasCalapanVessels: data.routes.find(r => r.code === 'BTG-CAL').vessels.length }));
  process.exit(0);
}

// Catalog fields only. Do not print accounts, contacts, bookings or tokens.
const rows = await queryLive(`select jsonb_build_object(
  'ports', (select jsonb_agg(to_jsonb(p) order by p.code) from public.port p),
  'vessels', (select jsonb_agg(to_jsonb(v) order by v.code) from public.vessel v),
  'routes', (select jsonb_agg(jsonb_build_object('code', r.code, 'origin', a.code, 'destination', b.code, 'durationMinutes', r.duration_minutes, 'active', r.is_active) order by r.code)
    from public.ferry_route r join public.port a on a.id=r.origin_port_id join public.port b on b.id=r.destination_port_id),
  'sailingAssignments', (select jsonb_agg(to_jsonb(x)) from (
    select v.code as vessel, a.code as origin, b.code as destination, count(*) as sailings, max(s.available_seats) as max_available,
      max((select count(*) from public.booking z where z.sailing_code=s.code)) as max_bookings
    from public.sailing s join public.vessel v on v.id=s.vessel_id join public.port a on a.id=s.origin_port_id join public.port b on b.id=s.destination_port_id
    group by v.code,a.code,b.code order by v.code,a.code,b.code) x),
  'classes', (select jsonb_agg(jsonb_build_object('vessel',v.code,'name',a.name,'capacity',a.capacity,'active',a.is_active) order by v.code,a.name)
    from public.accommodation a join public.vessel v on v.id=a.vessel_id)
) as catalog`);
console.log(JSON.stringify(rows[0].catalog, null, 2));
