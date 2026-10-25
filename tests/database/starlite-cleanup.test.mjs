import {PGlite} from '@electric-sql/pglite';
import {before,beforeEach,afterEach,after,it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fleetTargetsSql,deleteNonStarliteSql} from '../../scripts/starlite-cleanup-sql.mjs';
let db;
const owner='11111111-1111-4111-8111-111111111111';
const codes=['SL-ANNAPOLIS','SL-JUPITER','SL-PACIFIC','SL-SPRINT-1','SL-SWM-STELLA-DEL-MAR'];
before(async()=>{
  db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql','utf8'));
  await db.query("insert into auth.users(id,email,raw_app_meta_data)values($1,'owner@example.invalid','{\"role\":\"PASSENGER\"}')",[owner]);
  for(const code of codes)await db.query("insert into public.vessel(code,name,passenger_capacity,reference_metadata)values($1,$1,100,'{\"operator\":\"Starlite Ferries\",\"kind\":\"test-reference\"}')",[code]);
});
beforeEach(async()=>{
  await db.exec('begin');
  for(const [code,vessel]of [['REMOVE-TRIP','MIS-001'],['KEEP-TRIP','SL-ANNAPOLIS']]){
    await db.query(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
      select $1,o.id,d.id,v.id,now()+interval '1 day',now()+interval '26 hours',120,600,480,480,300,480,600,v.passenger_capacity-1 from public.port o,public.port d,public.vessel v where o.code='CAL' and d.code='BTG' and v.code=$2`,[code,vessel]);
    const booking=(await db.query("insert into public.booking(reference,owner_uid,sailing_code,status,payment_status,payment_method,passenger_count,passenger_fare_total,total)values($1,$2,$1,'CONFIRMED','PAID','CASH',1,600,600)returning id",[code,owner])).rows[0].id;
    const passenger=(await db.query("insert into public.booking_passenger(booking_id,full_name,fare,ticket_status)values($1,'Test Traveler',600,'BOARDED')returning id",[booking])).rows[0].id;
    await db.query("insert into public.online_payment(booking_id,amount,status)values($1,60000,'PAID')",[booking]);
    await db.query("insert into public.boarding_event(passenger_id,staff_uid,event_type)values($1,'staff','BOARDED')",[passenger]);
    await db.query("insert into public.notification(owner_uid,title,message)values($1,'Trip update',$2)",[owner,`Your trip ${code} was updated.`]);
  }
  const campaign=(await db.query("insert into public.notification_campaign(id,title,message,audience,sailing_code,sent_by_uid)values(gen_random_uuid(),'Trip notice','Board at gate 2','TRIP','REMOVE-TRIP','staff')returning id")).rows[0].id;
  await db.query("insert into public.notification(owner_uid,title,message,campaign_id)values($1,'Gate update','No trip identifier in this message',$2)",[owner,campaign]);
});
afterEach(async()=>await db.exec('rollback'));after(async()=>await db?.close());
it('removes the reviewed non-Starlite graph including paid bookings, payments, tickets and campaign children while preserving Starlite and accounts',async()=>{
  const userBefore=(await db.query('select to_jsonb(u) row from public.app_user u')).rows;
  const sailingBefore=(await db.query("select to_jsonb(s) row from public.sailing s where code='KEEP-TRIP'")).rows;
  await db.exec(fleetTargetsSql+deleteNonStarliteSql);
  assert.deepEqual((await db.query('select code from public.vessel order by code')).rows.map(r=>r.code),[...codes].sort());
  assert.deepEqual((await db.query('select reference from public.booking')).rows,[{reference:'KEEP-TRIP'}]);
  assert.equal((await db.query('select count(*)::int n from public.online_payment')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.booking_passenger')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.boarding_event')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.notification')).rows[0].n,1);
  assert.deepEqual((await db.query('select to_jsonb(u) row from public.app_user u')).rows,userBefore);
  assert.deepEqual((await db.query("select to_jsonb(s) row from public.sailing s where code='KEEP-TRIP'")).rows,sailingBefore);
  assert.equal((await db.query("select count(*)::int n from public.activity_log where action='NON_STARLITE_FLEET_REMOVED'")).rows[0].n,1);
});
it('refuses an unexpected Starlite fleet before any deletion',async()=>{
  await db.exec("update public.vessel set reference_metadata='{}' where code='SL-JUPITER'");
  await db.exec('savepoint check_target');await assert.rejects(db.exec(fleetTargetsSql+deleteNonStarliteSql),/exactly the five reviewed Starlite/);await db.exec('rollback to savepoint check_target');
  assert.equal((await db.query('select count(*)::int n from public.vessel')).rows[0].n,6);
  assert.equal((await db.query('select count(*)::int n from public.booking')).rows[0].n,2);
});
it('rolls back if an unrelated retained record changes during cleanup',async()=>{
  await db.exec(fleetTargetsSql);await db.exec('savepoint cleanup');
  const tampered=deleteNonStarliteSql.replace('delete from public.boarding_event',"update public.port set name='Unexpected edit';delete from public.boarding_event");
  await assert.rejects(db.exec(tampered),/Retained Starlite or unrelated records changed/);await db.exec('rollback to savepoint cleanup');
  assert.equal((await db.query('select count(*)::int n from public.booking')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from public.vessel')).rows[0].n,6);
});
