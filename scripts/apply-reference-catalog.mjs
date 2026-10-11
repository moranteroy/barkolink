import fs from 'node:fs';
import { queryLive, projectRef } from './test-data-database.mjs';
import { catalog, referenceCatalogSql } from './reference-catalog.mjs';
const migration=fs.readFileSync('supabase/migrations/034_verified_ferry_catalog.sql','utf8');
const applied=(await queryLive("select to_regclass('public.vessel_route') is not null as applied"))[0].applied;
const portsGuardApplied=(await queryLive("select exists(select 1 from pg_trigger where tgname='active_sailing_ports' and tgrelid='public.sailing'::regclass) as applied"))[0].applied;
const portsGuardMigration=fs.readFileSync('supabase/migrations/035_active_sailing_ports.sql','utf8');
const guard=`select md5(jsonb_build_object('users',(select jsonb_agg(to_jsonb(u) order by uid) from public.app_user u),
  'auth',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
  'bookings',(select jsonb_agg(to_jsonb(b) order by id) from public.booking b),
  'passengers',(select jsonb_agg(to_jsonb(p) order by id) from public.booking_passenger p),
  'sailings',(select jsonb_agg(to_jsonb(s) order by code) from public.sailing s),
  'fares',(select jsonb_agg(to_jsonb(f) order by code) from public.fare_settings f),
  'accommodation',(select jsonb_agg(to_jsonb(a) order by id) from public.accommodation a),
  'payments',(select jsonb_agg(to_jsonb(p) order by id) from public.online_payment p))::text) as fingerprint`;
console.log(JSON.stringify({projectRef,ports:catalog.ports.length,routes:catalog.routes.length,vessels:catalog.vessels.length,capacityConfirmed:catalog.vessels.filter(v=>v.isActive).length,migrationRequired:!applied}));
if(!process.argv.includes('--apply')){console.log('Preview only. Use --apply to import the reviewed catalog.');process.exit(0);}
fs.mkdirSync('.backups',{recursive:true});
const backup=(await queryLive(`select jsonb_build_object('ports',(select jsonb_agg(to_jsonb(p)) from public.port p),'vessels',(select jsonb_agg(to_jsonb(v)) from public.vessel v),
  'routes',(select jsonb_agg(to_jsonb(r)) from public.ferry_route r)${applied?",'assignments',(select jsonb_agg(to_jsonb(v)) from public.vessel_route v)":''}) as data`))[0].data;
const backupPath=`.backups/reference-catalog-${Date.now()}.json`;
fs.writeFileSync(backupPath,JSON.stringify({projectRef,createdAt:new Date().toISOString(),data:backup},null,2));
const query=`begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('barkolink-reference-catalog'));
lock table public.port,public.vessel,public.ferry_route,public.sailing,public.booking,public.booking_passenger,public.app_user,auth.users,public.fare_settings,public.accommodation,public.online_payment in share row exclusive mode;
create temporary table reference_guard as ${guard};
${applied?'':migration}
${portsGuardApplied?'':portsGuardMigration}
${referenceCatalogSql()}
do $$ declare before_value text;after_value text;begin
select fingerprint into before_value from reference_guard;
${guard.replace(' as fingerprint',' into after_value')};
if before_value is distinct from after_value then raise exception 'Operational data changed; reference import rolled back.';end if;
end $$;
drop table reference_guard;
commit;`;
await queryLive(query,false);
console.log(`Imported verified references. Operational fingerprints unchanged. Catalog backup: ${backupPath}`);
