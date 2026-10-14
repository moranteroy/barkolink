import fs from 'node:fs';
import crypto from 'node:crypto';
import { queryLive, projectRef, snapshotQuery, dataExpression, usersExpression, dataTables } from './test-data-database.mjs';

// Never cascade into trip, booking, payment or passenger history.
const targets = `
create temporary table cleanup_routes as select r.id from public.ferry_route r
join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
where not r.is_active and (o.code not in ('BTG','CAL') or d.code not in ('BTG','CAL'));
create temporary table cleanup_vessels as select v.id from public.vessel v where not v.is_active
and not exists(select 1 from public.sailing s where s.vessel_id=v.id)
and not exists(select 1 from public.accommodation a join public.booking b on b.accommodation_id=a.id where a.vessel_id=v.id);
`;
const protectedTables = dataTables.filter(t => !['port','vessel','ferry_route','vessel_route','accommodation','port_weather_cache'].includes(t));
const protectedExpression = `jsonb_build_object('users',${usersExpression},${protectedTables.map(t => `'${t}',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public.${t} x)`).join(',')})`;
if (!process.argv.includes('--apply')) {
  console.log('Preview only. Use --apply to remove unreferenced inactive catalog records; booked history is retained.');
  process.exit(0);
}
// Capture the backup and its PostgreSQL fingerprint in the same statement.
const snapshot = (await queryLive(snapshotQuery.replace('select ',`select md5((${dataExpression})::text) as data_hash, `)))[0];
const digest = {data_hash:snapshot.data_hash,users:snapshot.users};
fs.mkdirSync('.backups',{recursive:true});
const backupPath = `.backups/inactive-catalog-cleanup-${Date.now()}.json`;
fs.writeFileSync(backupPath,JSON.stringify({projectRef,...snapshot},null,2));
const backupSha256 = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
const userLiteral = JSON.stringify(digest.users).replaceAll("'", "''");
await queryLive(`begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('barkolink-reference-catalog'));
lock table ${dataTables.map(t=>`public.${t}`).join(',')},public.app_user,auth.users,barkolink_private.daily_schedule,barkolink_private.vessel_port_observation in share row exclusive mode;
do $$ begin
if md5((${dataExpression})::text) is distinct from '${digest.data_hash}' or ${usersExpression} is distinct from '${userLiteral}'::jsonb then raise exception 'Database changed since backup; cleanup aborted'; end if;
end $$;
create temporary table cleanup_history_guard as select md5((${protectedExpression})::text) as fingerprint;
${targets}
delete from barkolink_private.daily_schedule where route_id in (select id from cleanup_routes);
delete from public.ferry_route where id in (select id from cleanup_routes);
delete from barkolink_private.vessel_port_observation where vessel_id in (select id from cleanup_vessels);
delete from public.accommodation where vessel_id in (select id from cleanup_vessels);
delete from public.vessel where id in (select id from cleanup_vessels);
delete from public.port p where not p.is_active and p.code not in ('BTG','CAL')
and not exists(select 1 from public.sailing s where s.origin_port_id=p.id or s.destination_port_id=p.id)
and not exists(select 1 from public.app_user u where u.assigned_port_id=p.id)
and not exists(select 1 from public.ferry_route r where r.origin_port_id=p.id or r.destination_port_id=p.id)
and not exists(select 1 from barkolink_private.vessel_port_observation x where x.port_id=p.id);
do $$ begin
if (select fingerprint from cleanup_history_guard) is distinct from md5((${protectedExpression})::text) then raise exception 'Protected history changed; cleanup rolled back'; end if;
end $$;
commit;`,false);
const after = (await queryLive(`select
(select count(*) from public.port) as ports,
(select count(*) from public.vessel) as vessels,
(select count(*) from public.ferry_route) as routes,
(select count(*) from barkolink_private.daily_schedule) as schedules,
(select jsonb_agg(jsonb_build_object('code',code,'name',name,'active',is_active) order by code) from public.port) as retained_ports,
(select jsonb_agg(jsonb_build_object('code',code,'name',name) order by code) from public.vessel where not is_active) as retained_inactive_vessels`))[0];
const counts = name => snapshot.data[name]?.length || 0;
console.log(JSON.stringify({projectRef,backupPath,backupSha256,deleted:{ports:counts('port')-after.ports,vessels:counts('vessel')-after.vessels,routes:counts('ferry_route')-after.routes,schedules:counts('private.daily_schedule')-after.schedules},after,protectedHistory:'unchanged'},null,2));
