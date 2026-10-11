import fs from 'node:fs';
import crypto from 'node:crypto';
import {queryLive,projectRef,dataTables,usersExpression} from './test-data-database.mjs';
import {demonstrationSql,demonstrationChecks,batchId} from './demonstration-data.mjs';

const rows=table=>`(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${table} t)`;
const backupSql=`select jsonb_build_object(${[...dataTables,'vessel_route'].map(t=>`'${t}',${rows('public.'+t)}`).join(',')},'daily_schedule',${rows('barkolink_private.daily_schedule')},'sailing_status_policy',${rows('barkolink_private.sailing_status_policy')}) as data,${usersExpression} as users,now() as captured_at`;
if(!process.argv.includes('--apply')){
 console.log('Ready: corridor restriction, legacy fee repair, sixty departures and realistic demonstration bookings. Run with --apply to add them.');
 process.exit(0);
}
const alreadyInstalled=(await queryLive("select to_regclass('barkolink_private.demonstration_batch') is not null as installed"))[0].installed;
if(alreadyInstalled && (await queryLive(`select exists(select 1 from barkolink_private.demonstration_batch where id='${batchId}') as done`))[0].done){
 console.log('Demonstration batch is already present; no duplicate records added.');process.exit(0);
}
fs.mkdirSync('.backups',{recursive:true});
const backup=(await queryLive(backupSql))[0];
const file=`.backups/before-corridor-demonstration-${Date.now()}.json`;
fs.writeFileSync(file,JSON.stringify({projectRef,...backup}),{flag:'wx',mode:0o600});
const digest=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(`${file}.sha256`,digest,{flag:'wx'});
console.log(`Verified database backup saved to ${file}.`);

const migration=fs.readFileSync('supabase/migrations/039_batangas_calapan_service_area.sql','utf8');
await queryLive(`begin;
set local lock_timeout='10s';set local statement_timeout='55s';
select pg_advisory_xact_lock(hashtext('barkolink-corridor-demonstration'));
lock table public.booking,public.booking_passenger,public.sailing,public.voucher,public.app_user in share row exclusive mode;
lock table auth.users in share mode;
create temporary table original_user_ids on commit drop as select uid from public.app_user;
create temporary table demonstration_history_guard on commit drop as select
 ${rows('public.sailing')} as sailings,${rows('public.booking_passenger')} as tickets,
 (select jsonb_agg(to_jsonb(b)-'passenger_fare_total'-'service_fee'-'updated_at' order by id) from public.booking b) as bookings,
 ${rows('public.voucher')} as vouchers,
 (select jsonb_agg(to_jsonb(u) order by uid) from public.app_user u) as app_users,
 (select md5(coalesce(jsonb_agg(to_jsonb(u) order by id),'[]'::jsonb)::text) from auth.users u) as auth_users;
${migration}
do $$ begin
 if exists(select 1 from public.booking b where b.passenger_count<>(select count(*) from public.booking_passenger p where p.booking_id=b.id)
 or b.passenger_fare_total<>coalesce((select sum(p.fare) from public.booking_passenger p where p.booking_id=b.id),0)+b.accommodation_surcharge*b.passenger_count) then raise exception 'Unresolved legacy booking inconsistency'; end if;
end $$;
create temporary table original_booking_ids on commit drop as select id from public.booking;
create temporary table original_ticket_ids on commit drop as select id from public.booking_passenger;
create temporary table original_sailing_codes on commit drop as select code from public.sailing;
create temporary table original_voucher_ids on commit drop as select id from public.voucher;
${demonstrationSql()}
${demonstrationChecks}
do $$ declare original record; begin
 select * into original from demonstration_history_guard;
 if original.sailings is distinct from (select jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text) from public.sailing s join original_sailing_codes o using(code))
 or original.tickets is distinct from (select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from public.booking_passenger p join original_ticket_ids o using(id))
 or original.bookings is distinct from (select jsonb_agg(to_jsonb(b)-'passenger_fare_total'-'service_fee'-'updated_at' order by b.id) from public.booking b join original_booking_ids o using(id))
 or original.vouchers is distinct from (select coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text),'[]'::jsonb) from public.voucher v join original_voucher_ids o using(id))
 or original.app_users is distinct from (select jsonb_agg(to_jsonb(u) order by u.uid) from public.app_user u join original_user_ids o using(uid))
 or original.auth_users is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(u) order by id),'[]'::jsonb)::text) from auth.users u)
 then raise exception 'Existing account, booking, payment, QR or trip changed; entire batch rolled back'; end if;
end $$;
commit;`,false);
console.log('Applied corridor configuration and additive demonstration dataset. Original accounts, totals and QR credentials preserved.');
const counts=(await queryLive(`select
 (select count(*)::int from public.port where is_active) active_ports,
 (select count(*)::int from public.vessel where is_active) active_vessels,
 (select count(*)::int from public.ferry_route where is_active) active_routes,
 (select count(*)::int from public.sailing) sailings,
 (select count(*)::int from public.booking) bookings,
 (select count(*)::int from public.booking_passenger) passengers,
 (select manifest->'sailings' from barkolink_private.demonstration_batch where id='${batchId}') new_sailings`))[0];
console.log(JSON.stringify(counts));
