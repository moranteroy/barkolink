import { PGlite } from '@electric-sql/pglite';
import { before, after, it, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalog, referenceCatalogSql } from '../../scripts/reference-catalog.mjs';
let db;
const admin='33333333-3333-4333-8333-333333333333';
describe('Verified nationwide ferry reference catalog', () => {
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.query(`insert into auth.users(id,email,raw_app_meta_data) values($1,'catalog-admin@example.invalid','{"role":"ADMIN"}')`,[admin]);
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql','utf8'));
  await db.exec(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    select 'PRESERVED',p.id,d.id,v.id,now()+interval '1 day',now()+interval '2 days',1440,600,480,480,300,480,600,198 from public.port p,public.port d,public.vessel v where p.code='BTG' and d.code='CAL' and v.code='MIS-001'`);
});
after(async()=>{await db?.close()});
it('imports the nationwide network idempotently without modifying operational rows or users',async()=>{
  const preserved=async()=>(await db.query(`select jsonb_build_object('sailings',(select jsonb_agg(to_jsonb(s)) from public.sailing s),'users',(select jsonb_agg(to_jsonb(u)) from public.app_user u),'auth',(select jsonb_agg(to_jsonb(a)) from auth.users a),'fares',(select jsonb_agg(to_jsonb(f)) from public.fare_settings f)) as data`)).rows[0].data;
  const before=await preserved();
  await db.exec(referenceCatalogSql());
  assert.deepEqual(await preserved(),before);
  const counts=async()=>(await db.query(`select (select count(*) from public.port) as ports,(select count(*) from public.vessel) as vessels,(select count(*) from public.ferry_route) as routes,(select count(*) from public.vessel_route) as assignments`)).rows[0];
  const first=await counts();
  await db.exec(referenceCatalogSql());
  assert.deepEqual(await counts(),first);
  assert.equal(Number(first.ports),catalog.ports.length);
  assert.equal(Number(first.vessels),catalog.vessels.length+1);
  assert.equal(Number(first.routes),catalog.routes.length);
  assert.deepEqual(await preserved(),before);
  assert.equal((await db.query("select is_active from public.vessel where code='MIS-001'")).rows[0].is_active,false);
});
it('does not invent capacities, duration estimates, fares or new sailing schedules',async()=>{
  const data=(await db.query("select code,passenger_capacity,is_active from public.vessel where reference_metadata->>'kind'='verified-reference'")).rows;
  for(const v of catalog.vessels){const row=data.find(r=>r.code===v.code);assert.equal(row.passenger_capacity,v.passengerCapacity);assert.equal(row.is_active,v.isActive)}
  assert.equal((await db.query('select count(*)::int as n from public.sailing')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.ferry_route where duration_minutes is not null')).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from public.vessel where is_active and passenger_capacity is null")).rows[0].n,0);
  assert.equal((await db.query("select bool_and(is_active) as served from public.ferry_route where code in ('ZAM-JOL','JOL-ZAM')")).rows[0].served,false);
});
it('exposes vessel routes and source metadata to admins while denying other roles',async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await db.exec('set role authenticated');
  try{
    const vessels=(await db.query("select public.barkolink_execute('AdminVessels','{}') as data")).rows[0].data.vessels;
    const annapolis=vessels.find(v=>v.code==='SL-ANNAPOLIS');
    assert.ok(annapolis.routes.some(r=>r.code==='BTG-CAL'));
    assert.equal(annapolis.referenceMetadata.operator,'Starlite Ferries');
    const routes=(await db.query("select public.barkolink_execute('AdminRoutes','{}') as data")).rows[0].data.routes;
    assert.ok(routes.find(r=>r.code==='BTG-CAL').vessels.some(v=>v.name==='MV Starlite Annapolis'));
    await assert.rejects(db.query('select * from public.vessel_route'),/permission denied/);
  }finally{await db.exec('reset role')}
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(db.query("select public.barkolink_execute('AdminVessels','{}')"),/Administrator/);
});
it('limits active ports, routes and vessels to Batangas-Calapan, retaining published references',async()=>{
  assert.equal((await db.query('select count(*)::int as n from public.port where is_active')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.ferry_route where is_active')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.vessel v where is_active and not exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id where vr.vessel_id=v.id and r.is_active)')).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from public.port where is_active and coalesce(region,'') not in ('Batangas','Oriental Mindoro','Occidental Mindoro')")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id where r.is_active and (not o.is_active or not d.is_active)")).rows[0].n,0);
  const data=(await db.query("select reference_metadata as data from public.ferry_route where code='BTG-CAL'")).rows[0].data;
  assert.ok(data.schedules.find(s=>s.operator==='FastCat').departureTimes.includes('09:00'));
  assert.ok(data.accommodationProfiles.find(p=>p.operator==='FastCat').classes.includes('Premium Economy'));
  assert.equal(data.accommodationProfiles[0].capacity,null);
  const v=(await db.query("select reference_metadata as data,is_active from public.vessel where code='OJ-3'")).rows[0];
  assert.equal(v.is_active,false);assert.match(v.data.serviceNote,/maintenance/);
  await assert.rejects(db.exec("insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats) select 'OUT-OF-SCOPE',o.id,d.id,v.id,now()+interval '1 day',now()+interval '2 days',1440,600,480,480,300,480,600,198 from public.port o,public.port d,public.vessel v where o.code='BTG' and d.code='CAT' and v.code='MIS-001'"),/active origin/);
});
it('rejects unsupported vessel assignments and protects verified endpoint identities',async()=>{
  const insert=`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    select $1,p.id,d.id,v.id,now()+interval '1 day',now()+interval '2 days',1440,600,480,480,300,480,600,v.passenger_capacity from public.port p,public.port d,public.vessel v where p.code='BTG' and d.code=$2 and v.code='SL-ANNAPOLIS'`;
  await assert.rejects(db.query(insert,['WRONG-VESSEL','PGA']),/verified route|active origin/);
  await db.query(insert,['VERIFIED','CAL']);
  await assert.rejects(db.exec("update public.ferry_route set destination_port_id=(select id from public.port where code='PGA') where code='BTG-CAL'"),/separate route/);
  await db.exec("update public.sailing set status='DELAYED' where code='PRESERVED'");
  assert.equal((await db.query("select status from public.sailing where code='PRESERVED'")).rows[0].status,'DELAYED');
});
it('seeds daily templates once and retains admin edits and pauses on reimport',async()=>{
  assert.equal((await db.query('select count(*)::int n from barkolink_private.daily_schedule')).rows[0].n,10);
  await db.exec("update barkolink_private.daily_schedule set is_active=false,departure_times=array['07:30'],duration_minutes=180 where id=(select id from barkolink_private.daily_schedule limit 1)");
  const before=(await db.query('select jsonb_agg(to_jsonb(s) order by id) data from barkolink_private.daily_schedule s')).rows[0].data;
  await db.exec(referenceCatalogSql());
  assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(s) order by id) data from barkolink_private.daily_schedule s')).rows[0].data,before);
});

});
