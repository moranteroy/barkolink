import fs from 'node:fs';
import {queryLive,projectRef} from './test-data-database.mjs';
const applied=(await queryLive("select to_regprocedure('barkolink_private.advance_sailing_statuses()') is not null as applied"))[0].applied;
console.log(JSON.stringify({projectRef,alreadyApplied:applied}));
if(!process.argv.includes('--apply'))process.exit(0);
if(applied){console.log('Sailing automation is already installed.');process.exit(0);}
const before=(await queryLive('select jsonb_agg(to_jsonb(s) order by code) as data from public.sailing s'))[0].data;
fs.mkdirSync('.backups',{recursive:true});const backupPath=`.backups/sailing-status-${Date.now()}.json`;
fs.writeFileSync(backupPath,JSON.stringify({projectRef,sailings:before},null,2));
const guard=`select md5(jsonb_build_object('bookings',(select jsonb_agg(to_jsonb(b) order by id) from public.booking b),'payments',(select jsonb_agg(to_jsonb(p) order by id) from public.online_payment p),'passengers',(select jsonb_agg(to_jsonb(p) order by id) from public.booking_passenger p),'seatsAndFares',(select jsonb_agg(jsonb_build_object('code',code,'seats',available_seats,'fare',regular_fare,'departure',departure_at,'arrival',arrival_at) order by code) from public.sailing))::text) as fingerprint`;
const migration=fs.readFileSync('supabase/migrations/036_automatic_sailing_status.sql','utf8');
const result=await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('barkolink-sailing-automation-install'));
lock table public.sailing,public.booking,public.booking_passenger,public.online_payment in share row exclusive mode;
create temporary table sailing_status_guard as ${guard};
${migration}
do $$ begin
  if to_regclass('cron.job') is null then raise exception 'pg_cron is required for background sailing automation.'; end if;
end $$;
select barkolink_private.advance_sailing_statuses() as transitioned;
do $$ declare before_value text;after_value text;begin
select fingerprint into before_value from sailing_status_guard;
${guard.replace(' as fingerprint',' into after_value')};
if before_value is distinct from after_value then raise exception 'Bookings, payments, attendance or sailing fares changed; install rolled back.';end if;
end $$;
drop table sailing_status_guard;commit;`,false);
console.log(JSON.stringify({installed:true,backupPath,results:result.filter(r=>'transitioned' in r)}));
const cron=await queryLive("select jobname,schedule,active from cron.job where jobname='barkolink-advance-sailing-statuses'");
console.log(JSON.stringify({cron}));
