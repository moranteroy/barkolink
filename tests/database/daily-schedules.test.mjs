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
let routeId, scheduleId;
it('adds and edits a persisted daily schedule without creating actual sailings',async()=>{
  routeId=(await db.query("insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes) select 'BTG-CAL',o.id,d.id,120 from public.port o,public.port d where o.code='BTG' and d.code='CAL' returning id")).rows[0].id;
  await db.exec(`update public.vessel set reference_metadata='{"kind":"test-reference","operator":"FastCat"}' where code='MIS-001';`);
  await db.query("insert into public.vessel_route(vessel_id,route_id) select id,$1 from public.vessel where code='MIS-001'",[routeId]);
  const saved=await call('AdminSaveDailySchedule',{operator:'FastCat',routeId,departureTimes:['09:00','01:00'],durationMinutes:120,isActive:true});
  scheduleId=saved.schedules[0].id;assert.deepEqual(saved.schedules[0].departureTimes,['01:00','09:00']);
  assert.equal(saved.schedules[0].routeActive,true);assert.equal((await db.query('select count(*)::int n from public.sailing')).rows[0].n,0);
  const edited=await call('AdminSaveDailySchedule',{id:scheduleId,operator:'FastCat',routeId,departureTimes:['23:00'],durationMinutes:90,isActive:true});
  assert.equal(edited.schedules.length,1);assert.deepEqual(edited.schedules[0].departureTimes,['23:00']);assert.equal(edited.schedules[0].durationMinutes,90);
});
it('pauses and resumes only the template and blocks inactive ports or routes',async()=>{
  const paused=await call('AdminSetDailyScheduleActive',{id:scheduleId,isActive:false});assert.equal(paused.schedules[0].isActive,false);
  await db.query('update public.ferry_route set is_active=false where id=$1',[routeId]);
  await assert.rejects(call('AdminSetDailyScheduleActive',{id:scheduleId,isActive:true}),/Activate the route/);
  await db.query('update public.ferry_route set is_active=true where id=$1',[routeId]);
  await db.exec("update public.port set is_active=false where code='CAL'");
  await assert.rejects(call('AdminSetDailyScheduleActive',{id:scheduleId,isActive:true}),/Activate the route/);
  await db.exec("update public.port set is_active=true where code='CAL'");
  assert.equal((await call('AdminSetDailyScheduleActive',{id:scheduleId,isActive:true})).schedules[0].isActive,true);
  assert.equal((await db.query('select count(*)::int n from public.sailing')).rows[0].n,0);
});
it('validates unique times, duration, served routes and duplicate operator schedules',async()=>{
  const args={operator:'FastCat',routeId,departureTimes:['09:00'],durationMinutes:120,isActive:true};
  for(const departureTimes of [[],['24:00'],['09:00','09:00'],['7:00'],[null]])await assert.rejects(call('AdminSaveDailySchedule',{...args,id:scheduleId,departureTimes}),/unique departure times/);
  await assert.rejects(call('AdminSaveDailySchedule',{...args,id:scheduleId,durationMinutes:0}),/check constraint/);
  await assert.rejects(call('AdminSaveDailySchedule',{...args,id:scheduleId,operator:'Unknown operator'}),/route served/);
  await assert.rejects(call('AdminSaveDailySchedule',args),/unique constraint/);
  assert.deepEqual((await call('AdminDailySchedules')).schedules[0].departureTimes,['23:00']);
});
it('denies passenger writes and direct table access, and audits admin changes',async()=>{
  await assert.rejects(call('AdminDailySchedules',{},passenger),/Administrator access/);
  await assert.rejects(call('AdminSetDailyScheduleActive',{id:scheduleId,isActive:false},passenger),/Administrator access/);
  await db.exec('set role authenticated');try{await assert.rejects(db.query('select * from barkolink_private.daily_schedule'),/permission denied/);}finally{await db.exec('reset role');}
  assert.ok((await db.query("select count(*)::int n from public.activity_log where entity_type='daily_schedule'")).rows[0].n>=4);
});
