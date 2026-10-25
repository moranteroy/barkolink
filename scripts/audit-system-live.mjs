import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

// Aggregate-only, read-only diagnostics. Never change accounts or operational data.
const checks = await queryLive(`
select 'seat_inventory' as check_name, count(*)::int as issues from public.sailing s join public.vessel v on v.id=s.vessel_id
where s.available_seats < 0 or s.available_seats > v.passenger_capacity
union all
select 'seat_reservations',count(*)::int from public.sailing s join public.vessel v on v.id=s.vessel_id
where v.passenger_capacity is not null and s.available_seats <> v.passenger_capacity - coalesce((
  select sum(b.passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')
),0)
union all
select 'class_capacity',count(*)::int from public.vessel v where (
 select coalesce(sum(a.capacity),0) from public.accommodation a where a.vessel_id=v.id and a.is_active
) > v.passenger_capacity
union all
select 'booking_passenger_count',count(*)::int from public.booking b where b.passenger_count <> (
 select count(*) from public.booking_passenger p where p.booking_id=b.id
)
union all
select 'staff_active_port',count(*)::int from public.app_user u left join public.port p on p.id=u.assigned_port_id
where u.role in ('TICKETING','BOARDING') and (p.id is null or not p.is_active)
union all
select 'account_role_sync',count(*)::int from public.app_user u join auth.users a on a.id::text=u.uid
where u.role is distinct from coalesce(a.raw_app_meta_data->>'role','PASSENGER')
union all
select 'invalid_trip_times',count(*)::int from public.sailing where arrival_at<=departure_at
`);
const inventory = await queryLive(`select role,count(*)::int as accounts from public.app_user where role<>'WALK_IN' group by role order by role`);
const result = { checkedAt: new Date().toISOString(), checks, roles: inventory, readOnly: true };
fs.mkdirSync('.audit', { recursive: true });
fs.writeFileSync('.audit/system-live-integrity.json', JSON.stringify(result, null, 2));
for (const check of checks) console.log(`${check.check_name}: ${check.issues} issues`);
console.log('Account roles:', inventory.map(item => `${item.role}=${item.accounts}`).join(', '));
if (checks.some(check => check.issues > 0)) process.exitCode = 1;
