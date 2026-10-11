import {PGlite} from '@electric-sql/pglite';
import {before,after,it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {referenceCatalogSql} from '../../scripts/reference-catalog.mjs';
import {demonstrationSql,demonstrationChecks} from '../../scripts/demonstration-data.mjs';
let db;
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 // Load the historical demonstration batch before installing the new booking guard.
 for(const file of fs.readdirSync('supabase/migrations').filter(file=>!file.startsWith('040_') && !file.startsWith('041_')).sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`insert into auth.users(id,email,raw_app_meta_data) values('33333333-3333-4333-8333-333333333333','admin@example.invalid','{"role":"ADMIN"}'),('11111111-1111-4111-8111-111111111111','passenger@example.invalid','{"role":"PASSENGER"}');`);
 await db.exec(referenceCatalogSql());
 await db.exec(`begin;${demonstrationSql()}${demonstrationChecks}commit;`);
 await db.exec(fs.readFileSync('supabase/migrations/040_vessel_position_tracking.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/041_vessel_tracking_lock_order.sql','utf8'));
});
after(async()=>await db?.close());
const manifest=async()=>(await db.query("select manifest from barkolink_private.demonstration_batch")).rows[0].manifest;
it('adds realistic references, varied workflows and consistent seat, cabin and booking totals',async()=>{
 assert.equal((await db.query('select count(*)::int n from public.sailing')).rows[0].n,60);
 assert.ok((await db.query('select count(*)::int n from public.booking')).rows[0].n>700);
 assert.ok((await db.query('select count(*)::int n from public.booking_passenger')).rows[0].n>1700);
 for(const {code}of(await db.query('select code from public.sailing')).rows)assert.match(code,/^TRP\d{4}-\d{7,}$/);
 for(const {reference}of(await db.query('select reference from public.booking')).rows)assert.match(reference,/^BKG\d{4}-\d{16}$/);
 assert.equal((await db.query('select count(distinct status)::int n from public.sailing')).rows[0].n,5);
 assert.equal((await db.query('select count(distinct payment_status)::int n from public.booking')).rows[0].n,4);
 assert.equal((await db.query('select count(distinct ticket_status)::int n from public.booking_passenger')).rows[0].n,4);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int n from public.port where is_active')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int n from public.ferry_route where is_active')).rows[0].n,2);
});
it('honors the automatic transitions and manual exceptions on the same generated dataset',async()=>{
 const {sailings}=await manifest();
 const boarding=sailings.find(s=>s.scenario==='automatic-boarding').code;
 const completion=sailings.find(s=>s.scenario==='automatic-completion').code;
 await db.query('update public.sailing set boarding_at=now()-interval \'1 second\' where code=$1',[boarding]);
 await db.query('update public.sailing set departure_at=now()-interval \'91 minutes\',arrival_at=now()-interval \'1 minute\' where code=$1',[completion]);
 const statusesBefore=(await db.query("select jsonb_agg(to_jsonb(s)) data from public.sailing s where status in ('DELAYED','CANCELLED')")).rows[0].data;
 await db.query('select barkolink_private.advance_sailing_statuses()');
 assert.equal((await db.query('select status from public.sailing where code=$1',[boarding])).rows[0].status,'BOARDING');
 assert.equal((await db.query('select status from public.sailing where code=$1',[completion])).rows[0].status,'COMPLETED');
 assert.deepEqual((await db.query("select jsonb_agg(to_jsonb(s)) data from public.sailing s where status in ('DELAYED','CANCELLED')")).rows[0].data,statusesBefore);
 const notices=(await db.query('select count(*)::int n from public.notification')).rows[0].n;
 assert.equal((await db.query('select barkolink_private.advance_sailing_statuses() n')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.notification')).rows[0].n,notices);
});
it('reclassifies a legacy cabin fee without changing the charged total, payment state or QR credentials',async()=>{
 const data=await manifest();
 const booking=(await db.query(`insert into public.booking(reference,owner_uid,sailing_code,status,payment_status,passenger_count,passenger_fare_total,service_fee,total,accommodation_surcharge)
 values('LEGACY-CLASS-FEE',$1,$2,'CANCELLED','UNPAID',1,600,100,700,100) returning id,total,payment_status`,[data.newUsers[0],data.sailings[0].code])).rows[0];
 await db.query("insert into public.booking_passenger(booking_id,full_name,fare) values($1,'Legacy Passenger',600)",[booking.id]);
 const ticket=(await db.query('select to_jsonb(p) data from public.booking_passenger p where booking_id=$1',[booking.id])).rows[0].data;
 await db.exec(fs.readFileSync('supabase/migrations/039_batangas_calapan_service_area.sql','utf8'));
 const repaired=(await db.query('select passenger_fare_total,service_fee,total,payment_status from public.booking where id=$1',[booking.id])).rows[0];
 assert.equal(repaired.passenger_fare_total,700);assert.equal(repaired.service_fee,0);
 assert.equal(repaired.total,booking.total);assert.equal(repaired.payment_status,booking.payment_status);
 assert.deepEqual((await db.query('select to_jsonb(p) data from public.booking_passenger p where booking_id=$1',[booking.id])).rows[0].data,ticket);
});
it('cannot append the same batch twice or expose its private manifest to app roles',async()=>{
 await assert.rejects(db.exec(`begin;${demonstrationSql()}commit;`),/already exists/);await db.exec('rollback');
 await db.exec('set role authenticated');
 try{await assert.rejects(db.query('select * from barkolink_private.demonstration_batch'),/permission denied/);}finally{await db.exec('reset role');}
});
