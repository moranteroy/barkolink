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

after(async()=>await db?.close());
async function call(operation,args={},uid=admin){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');try{return(await db.query('select public.barkolink_execute($1,$2::jsonb) as data',[operation,JSON.stringify(args)])).rows[0].data;}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}}

let vessel,btg,cal;
async function issue(origin,offset=4,exclude=null){return (await db.query("select barkolink_private.vessel_departure_issue($1,$2,now()+make_interval(hours=>$3),$4) issue",[vessel,origin,offset,exclude])).rows[0].issue;}
async function trip(code,origin,dest,dep,arr){await db.query(`insert into public.sailing(code,vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,duration_minutes,available_seats,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare) values($1,$2,$3,$4,now()+make_interval(hours=>$5),now()+make_interval(hours=>$6),60*($6-$5),200,600,480,480,300,480,600)`,[code,vessel,origin,dest,dep,arr]);}
beforeEach(async()=>{await db.exec('delete from public.booking;delete from public.sailing;delete from barkolink_private.vessel_port_observation;');vessel=(await db.query("select id from public.vessel where code='MIS-001'")).rows[0].id;btg=(await db.query("select id from public.port where code='BTG'")).rows[0].id;cal=(await db.query("select id from public.port where code='CAL'")).rows[0].id;});
async function confirm(port=btg){return call('AdminConfirmVesselPort',{vesselId:vessel,portId:port,observedAt:new Date(Date.now()-60000).toISOString(),note:'Terminal confirms vessel moored at port.'});}
it('requires a confirmed port and checks origin instead of passenger location',async()=>{
 assert.match(await issue(cal),/Confirm the vessel port/);
 await confirm();assert.equal(await issue(btg),null);assert.match(await issue(cal),/Batangas/);
 const positions=await call('AdminVesselPositions');assert.equal(positions.vessels[0].position.state,'CONFIRMED');
 const availability=await call('AdminVesselAvailability',{originPortId:cal,departureAt:new Date(Date.now()+4*3600000).toISOString()});assert.match(availability.vessels[0].issue,/Batangas/);
});
it('allows a future return voyage after an incoming voyage but rejects overlapping or disconnected trips',async()=>{
 await confirm();await trip('OUT',btg,cal,1,3);await trip('RETURN',cal,btg,4,6);
 assert.equal(await issue(cal,4,'RETURN'),null);
 assert.match(await issue(cal,2),/another voyage/);
 await assert.rejects(trip('WRONG',cal,btg,7,9),/will be at|next departure/);
 assert.equal((await db.query("select barkolink_private.vessel_position_at($1,now()+interval '3 hours') p",[vessel])).rows[0].p.state,'EXPECTED');
});
it('blocks booking even when bypassing the visible sailing list',async()=>{
 await trip('RETURN',cal,btg,4,6);await confirm();
 await assert.rejects(db.query(`insert into public.booking(reference,owner_uid,sailing_code,passenger_count,passenger_fare_total,total) values('BKG-X',$1,'RETURN',1,600,600)`,[passenger]),/will be at Batangas/);
 const list=await call('BrowseSailings');assert.equal(list.sailings.length,0);
 await confirm(cal);
 await db.query(`insert into public.booking(reference,owner_uid,sailing_code,passenger_count,passenger_fare_total,total) values('BKG-X',$1,'RETURN',1,600,600)`,[passenger]);
 assert.equal((await call('BrowseSailings')).sailings.length,1);
});
it('does not treat delayed or cancelled incoming voyages as confirmed arrival',async()=>{
 await confirm();await trip('OUT',btg,cal,1,3);await trip('RETURN',cal,btg,4,6);
 await db.exec("update public.sailing set status='DELAYED' where code='OUT'");assert.match(await issue(cal,4,'RETURN'),/delayed/);
 await db.exec("update public.sailing set status='CANCELLED' where code='OUT'");assert.match(await issue(cal,4,'RETURN'),/Batangas/);
});
it('protects existing later trips when inserting a transfer',async()=>{
 await trip('LATER',cal,btg,5,7);await confirm(cal);
 await assert.rejects(trip('BROKEN',cal,btg,1,3),/next departure/);
});
it('limits location updates to administrators and validates confirmation timestamps and notes',async()=>{
 await assert.rejects(call('AdminVesselPositions',{},passenger),/Administrator/);
 await assert.rejects(call('AdminConfirmVesselPort',{vesselId:vessel,portId:btg,observedAt:new Date(Date.now()+3600000).toISOString(),note:'Confirmed'}),/last 24 hours/);
 await assert.rejects(call('AdminConfirmVesselPort',{vesselId:vessel,portId:btg,observedAt:new Date().toISOString(),note:' '}),/check constraint/);
 await confirm();assert.equal((await db.query("select count(*)::int n from public.activity_log where action='VESSEL_PORT_CONFIRMED'")).rows[0].n>=1,true);
});
