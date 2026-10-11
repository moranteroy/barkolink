import { PGlite } from '@electric-sql/pglite';
import { before, beforeEach, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const admin='33333333-3333-4333-8333-333333333333',passenger='11111111-1111-4111-8111-111111111111';
before(async()=>{
  db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql','utf8'));
  await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'admin@example.invalid','{\"role\":\"ADMIN\"}'),($2,'passenger@example.invalid','{\"role\":\"PASSENGER\"}')",[admin,passenger]);
});
beforeEach(async()=>{await db.exec("delete from public.booking_passenger;delete from public.booking;delete from public.voucher;delete from public.notification;delete from public.sailing;delete from barkolink_private.vessel_port_observation;delete from public.vessel where code like 'AUTO-%';delete from barkolink_private.sailing_status_policy;");await db.query("select set_config('request.jwt.claim.sub','',false)");});
after(async()=>await db?.close());
async function sailing(code,{departure='30 minutes',arrival='2 hours',boarding=null,status='SCHEDULED'}={}){
  const vessel=(await db.query("insert into public.vessel(code,name,passenger_capacity,reference_metadata) values($1,$1,100,'{\"kind\":\"test-reference\",\"operator\":\"FastCat\"}') returning id",[code])).rows[0].id;
  await db.query(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,boarding_at,boarding_time_source,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    select $1,o.id,d.id,$2,now()+$3::interval,now()+$4::interval,case when $5::text is null then null else now()+$5::interval end,case when $5::text is null then null else 'Confirmed test terminal instruction' end,90,600,480,480,300,480,600,100,$6 from public.port o,public.port d where o.code='BTG' and d.code='CAL'`,[code,vessel,departure,arrival,boarding,status]);
}
const advance=async()=> (await db.query('select barkolink_private.advance_sailing_statuses() as n')).rows[0].n;
const status=async code=>(await db.query('select status from public.sailing where code=$1',[code])).rows[0].status;
async function call(operation,args={},uid=admin){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');try{return(await db.query('select public.barkolink_execute($1,$2::jsonb) as data',[operation,JSON.stringify(args)])).rows[0].data;}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}}
it('does not infer boarding from check-in deadlines or a one-hour default',async()=>{
  await sailing('AUTO-UNKNOWN');await sailing('AUTO-FUTURE',{boarding:'10 minutes'});await sailing('AUTO-READY',{boarding:'-1 second'});
  assert.equal(await advance(),1);assert.equal(await status('AUTO-UNKNOWN'),'SCHEDULED');assert.equal(await status('AUTO-FUTURE'),'SCHEDULED');assert.equal(await status('AUTO-READY'),'BOARDING');assert.equal(await advance(),0);
});
it('completes elapsed trips and catches up after downtime without touching manual exceptions',async()=>{
  for(const state of ['SCHEDULED','BOARDING','DELAYED','CANCELLED','COMPLETED'])await sailing(`AUTO-${state}`,{departure:'-2 hours',arrival:'-1 second',status:state});
  assert.equal(await advance(),2);assert.equal(await status('AUTO-SCHEDULED'),'COMPLETED');assert.equal(await status('AUTO-BOARDING'),'COMPLETED');assert.equal(await status('AUTO-DELAYED'),'DELAYED');assert.equal(await status('AUTO-CANCELLED'),'CANCELLED');assert.equal(await advance(),0);
});
it('requires confirmed policy sources, honors configurable timing, and gives trip overrides priority',async()=>{
  await sailing('AUTO-POLICY');await sailing('AUTO-OVERRIDE',{boarding:'10 minutes'});
  await assert.rejects(call('AdminSaveSailingStatusPolicy',{operator:'FastCat',boardingLeadMinutes:45,autoComplete:true}),/check constraint/);
  await call('AdminSaveSailingStatusPolicy',{operator:'FastCat',boardingLeadMinutes:45,boardingTimeSource:'Confirmed test operator instruction',autoComplete:true});
  assert.equal(await advance(),1);assert.equal(await status('AUTO-POLICY'),'BOARDING');assert.equal(await status('AUTO-OVERRIDE'),'SCHEDULED');
  const policies=(await call('AdminSailingStatusPolicies')).policies;assert.equal(policies[0].boardingLeadMinutes,45);
  await call('AdminSaveSailingStatusPolicy',{operator:'FastCat',boardingLeadMinutes:null,boardingTimeSource:null,autoComplete:false});
  await sailing('AUTO-NO-COMPLETE',{departure:'-2 hours',arrival:'-1 second',status:'BOARDING'});
  assert.equal(await advance(),0);assert.equal(await status('AUTO-NO-COMPLETE'),'BOARDING');
});
it('lets an administrator pause Boarding and resume a rescheduled trip without automatic overwrites',async()=>{
  await sailing('AUTO-MANUAL',{boarding:'-1 second'});await advance();
  await call('AdminUpdateSailingStatus',{code:'AUTO-MANUAL',status:'DELAYED'});assert.equal(await advance(),0);
  await call('AdminRescheduleSailing',{code:'AUTO-MANUAL',departureAt:new Date(Date.now()+86400000).toISOString(),arrivalAt:new Date(Date.now()+90000000).toISOString(),durationMinutes:60});
  assert.equal((await db.query("select boarding_at from public.sailing where code='AUTO-MANUAL'")).rows[0].boarding_at,null);
  await call('AdminUpdateSailingStatus',{code:'AUTO-MANUAL',status:'SCHEDULED'});assert.equal(await advance(),0);assert.equal(await status('AUTO-MANUAL'),'SCHEDULED');
});
it('rejects invalid confirmed boarding timestamps and denies passengers direct automation/settings access',async()=>{
  await sailing('AUTO-GUARD');
  await assert.rejects(db.exec("update public.sailing set boarding_at=departure_at,boarding_time_source='test' where code='AUTO-GUARD'"),/check constraint/);
  await assert.rejects(db.exec("update public.sailing set boarding_at=departure_at-interval '30 minutes' where code='AUTO-GUARD'"),/check constraint/);
  await assert.rejects(call('AdminSailingStatusPolicies',{},passenger),/Administrator/);
  await assert.rejects(call('AdminSaveSailingStatusPolicy',{operator:'FastCat',autoComplete:true},passenger),/Administrator/);
  await db.exec('set role authenticated');try{await assert.rejects(db.exec('select barkolink_private.advance_sailing_statuses()'),/permission denied/);}finally{await db.exec('reset role');}
});
it('preserves bookings and payments, sends transitions once, and awards boarded completion rewards',async()=>{
  for(let i=1;i<=5;i++){
    const code=`AUTO-LOYALTY-${i}`;await sailing(code,{departure:'-2 hours',arrival:'-1 second',status:i===5?'BOARDING':'COMPLETED'});
    await db.query("insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note) select vessel_id,origin_port_id,departure_at-interval '1 second',$1,'Recorded terminal observation for historical fixture.' from public.sailing where code=$2",[admin,code]);
    const booking=(await db.query(`insert into public.booking(reference,owner_uid,sailing_code,status,payment_status,payment_method,passenger_count,passenger_fare_total,service_fee,total) values($1,$2,$1,'CONFIRMED','PAID','CASH',1,600,0,600) returning id`,[code,passenger])).rows[0].id;
    await db.query("insert into public.booking_passenger(booking_id,full_name,fare,ticket_status) values($1,'Test Passenger',600,'BOARDED')",[booking]);
  }
  const before=(await db.query('select jsonb_agg(to_jsonb(b) order by reference) as data from public.booking b')).rows[0].data;
  assert.equal(await advance(),1);assert.equal(await advance(),0);
  assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(b) order by reference) as data from public.booking b')).rows[0].data,before);
  assert.equal((await db.query('select count(*)::int as n from public.voucher')).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int as n from public.notification where title='Scheduled arrival reached'")).rows[0].n,1);
  assert.equal((await db.query("select actor_role from public.activity_log where entity_id='AUTO-LOYALTY-5' and details->'status'->>'after'='COMPLETED' order by created_at desc limit 1")).rows[0].actor_role,'SYSTEM');
});

it('generates voucher codes with letters and numbers without granting direct passenger access',async()=>{
  const rows=(await db.query('select barkolink_private.new_voucher_code() as code from generate_series(1,100)')).rows;
  assert.equal(new Set(rows.map(r=>r.code)).size,100);
  for(const {code} of rows){assert.match(code,/^VCH-[A-HJ-NP-Z2-9]{16}$/);assert.match(code.slice(4),/[A-Z]/);assert.match(code.slice(4),/[2-9]/);}
  await db.exec('set role authenticated');
  try{await assert.rejects(db.query('select barkolink_private.new_voucher_code()'),/permission denied/);}finally{await db.exec('reset role');}
});
