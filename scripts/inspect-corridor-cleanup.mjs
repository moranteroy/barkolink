import { queryLive, projectRef } from './test-data-database.mjs';
const inventory = await queryLive(`select
  (select count(*) from public.port) as ports,
  (select count(*) from public.vessel) as vessels,
  (select count(*) from public.ferry_route) as routes,
  (select count(*) from barkolink_private.daily_schedule) as schedules,
  (select count(*) from public.sailing s join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id where o.code not in ('BTG','CAL') or d.code not in ('BTG','CAL')) as outside_sailings,
  (select count(*) from public.sailing s join public.vessel v on v.id=s.vessel_id where not v.is_active) as inactive_vessel_sailings,
  (select count(*) from public.app_user u join public.port p on p.id=u.assigned_port_id where p.code not in ('BTG','CAL')) as outside_staff_assignments`);
const dependencies = await queryLive(`select conrelid::regclass::text as child, confrelid::regclass::text as parent, pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and confrelid in ('public.port'::regclass,'public.vessel'::regclass,'public.ferry_route'::regclass,'public.accommodation'::regclass) order by 2,1`);
const inactive = await queryLive(`select code,name from public.vessel where not is_active order by code`);
const affectedTrips = await queryLive(`select s.code,o.code as origin,d.code as destination,v.code as vessel,s.status,(select count(*) from public.booking b where b.sailing_code=s.code) as bookings from public.sailing s join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id join public.vessel v on v.id=s.vessel_id where o.code not in ('BTG','CAL') or d.code not in ('BTG','CAL') or not v.is_active order by s.code`);
console.log(JSON.stringify({projectRef, inventory, dependencies, inactiveCount:inactive.length, affectedTrips},null,2));
