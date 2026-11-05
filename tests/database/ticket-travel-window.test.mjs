import {PGlite} from '@electric-sql/pglite';
import {before,after,beforeEach,afterEach,it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

let db;
const passenger='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    select set_config('request.jwt.claims','{"aal":"aal2"}',false);`);
  for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql','utf8'));
  for(const [uid,role] of [[passenger,'PASSENGER'],[other,'PASSENGER'],[admin,'ADMIN']])await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,jsonb_build_object('role',$3::text))",[uid,uid+'@example.invalid',role]);
  await db.exec(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
    regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    values('LOYALTY-USE','76a29980-5c27-4c4b-9ead-cae943202001','76a29980-5c27-4c4b-9ead-cae943202002','76a29980-5c27-4c4b-9ead-cae943203001',now()+interval '2 days',now()+interval '2 days 2 hours',120,600,480,480,300,480,600,200)`);
});
after(async()=>await db?.close());
beforeEach(async()=>await db.exec('begin'));
afterEach(async()=>await db.exec('rollback'));
async function call(uid,operation='MyBookings',args={},role='authenticated') {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
  await db.exec('savepoint milestone_call');
  await db.exec(`set local role ${role}`);
  try{return(await db.query('select public.barkolink_execute($1,$2::jsonb) data',[operation,JSON.stringify(args)])).rows[0].data;}
  catch(error){await db.exec('rollback to savepoint milestone_call');throw error;}
  finally{await db.exec('reset role;release savepoint milestone_call');}
}
async function ticket(status='ISSUED') {
  await db.exec("update public.sailing set status='BOARDING' where code='LOYALTY-USE'");
  const booking=(await db.query(`insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,payment_status,payment_method)
    values('GATE-TEST',$1,'LOYALTY-USE','CONFIRMED',1,600,600,'PAID','CASH') returning id`,[passenger])).rows[0];
  return (await db.query("insert into public.booking_passenger(booking_id,full_name,fare,ticket_status) values($1,'Gate Traveler',600,$2) returning *",[booking.id,status])).rows[0];
}
const action=(person,operation,uid=admin)=>call(uid,operation,{passengerId:person.id});
const scan=(person,uid=admin)=>call(uid,'VerifyTicketQr',{payload:person.ticket_code,sailingCode:'LOYALTY-USE'});
it('verifying a QR does not consume a ticket and duplicate attendance is rejected',async()=>{
  const person=await ticket();await scan(person);await scan(person);
  assert.equal((await db.query('select ticket_status from public.booking_passenger where id=$1',[person.id])).rows[0].ticket_status,'ISSUED');
  await action(person,'CheckInTicket');await assert.rejects(action(person,'CheckInTicket'),/Only issued/);
  await scan(person);await action(person,'BoardTicket');await assert.rejects(action(person,'BoardTicket'),/Check in first/);
  const rescan=await scan(person);assert.equal(rescan.alreadyBoarded,true);
  const events=(await db.query('select event_type from public.boarding_event where passenger_id=$1 order by created_at,event_type',[person.id])).rows;
  assert.equal(events.length,2);assert.deepEqual(new Set(events.map(e=>e.event_type)),new Set(['CHECKED_IN','BOARDED']));
});
it('rejects QR verification and both mutations after arrival even with stale BOARDING status',async()=>{
  const person=await ticket();
  await db.exec("update public.sailing set departure_at=now()-interval '3 hours',arrival_at=now() where code='LOYALTY-USE'");
  await assert.rejects(scan(person),/travel period has ended/);
  await assert.rejects(action(person,'CheckInTicket'),/travel period has ended/);
  await db.query("update public.booking_passenger set ticket_status='CHECKED_IN' where id=$1",[person.id]);
  await assert.rejects(action(person,'BoardTicket'),/travel period has ended/);
  assert.equal((await db.query('select count(*)::int n from public.boarding_event')).rows[0].n,0);
});
it('rejects unverified online payment even if a passenger row incorrectly says issued',async()=>{
  const person=await ticket();
  await db.query("update public.booking set payment_method='PAYMONGO_TEST',payment_verified_at=null where id=$1",[person.booking_id]);
  await assert.rejects(action(person,'CheckInTicket'),/verification is required/);
  await assert.rejects(scan(person),/unpaid, cancelled, or not issued/);
});
it('rejects unpaid, cancelled and completed-trip tickets at the database boundary',async()=>{
  const person=await ticket();
  await db.query("update public.booking set payment_status='UNPAID' where id=$1",[person.booking_id]);
  await assert.rejects(action(person,'CheckInTicket'),/Payment must be completed/);
  await db.query("update public.booking set payment_status='PAID',status='CANCELLED' where id=$1",[person.booking_id]);
  await assert.rejects(action(person,'CheckInTicket'),/Payment must be completed/);
  await db.query("update public.booking set status='CONFIRMED' where id=$1",[person.booking_id]);
  await db.exec("update public.sailing set status='COMPLETED' where code='LOYALTY-USE'");
  await assert.rejects(action(person,'CheckInTicket'),/Only issued/);await assert.rejects(scan(person),/not open/);
});
it('preserves owner-only historical booking access and blocks passenger gate mutations',async()=>{
  const person=await ticket('BOARDED');
  await db.exec("update public.sailing set departure_at=now()-interval '3 hours',arrival_at=now()-interval '1 hour',status='COMPLETED' where code='LOYALTY-USE'");
  // Exercise the existing owner-filtered core read separately: the full legacy
  // read dispatcher exceeds PGlite WASM stack depth on this Windows runtime.
  const read=async uid=>(await db.query("select barkolink_private.execute('MyBookings','{}'::jsonb,$1,'PASSENGER') data",[uid])).rows[0].data;
  const records=await read(passenger);assert.equal(records.bookings.length,1);
  assert.equal(records.bookings[0].bookingPassengers_on_booking[0].ticket_status,'BOARDED');
  assert.equal((await read(other)).bookings.length,0);
  await assert.rejects(action(person,'CheckInTicket',passenger),/Boarding|Staff/);
  await assert.rejects(scan(person,passenger),/Staff/);
});
