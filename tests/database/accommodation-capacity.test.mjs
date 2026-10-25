import {PGlite} from '@electric-sql/pglite';
import {before,after,it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db,vesselId;
const actor='11111111-1111-4111-8111-111111111111';
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  await db.query(`insert into public.app_user(uid,email,full_name,role) values($1,'capacity@example.invalid','Capacity Admin','ADMIN')`,[actor]);
  vesselId=(await db.query("insert into public.vessel(code,name,passenger_capacity) values('CAP-100','Capacity fixture',100) returning id")).rows[0].id;
});
after(async()=>await db?.close());
const save=async(name,capacity,extra={})=>(await db.query(`select barkolink_private.execute_accommodation('AdminSaveAccommodation',$1::jsonb,$2,'ADMIN') result`,[JSON.stringify({vesselId,name,capacity,description:'',surcharge:0,isActive:true,...extra}),actor])).rows[0].result.id;
let economy,tourist,business;
it('rejects 110 seats and accepts exactly 100 through the database dispatcher',async()=>{
  economy=await save('Economy',50);tourist=await save('Tourist Class',30);
  await assert.rejects(save('Business Class',30),/must fit within the vessel capacity/);
  assert.equal((await db.query('select sum(capacity)::int n from public.accommodation where is_active')).rows[0].n,80);
  business=await save('Business Class',20);
  assert.equal((await db.query('select sum(capacity)::int n from public.accommodation where is_active')).rows[0].n,100);
});
it('excludes the edited class from its own allocation while rejecting an oversized edit',async()=>{
  await save('Economy',50,{id:economy});
  await assert.rejects(save('Economy',51,{id:economy}),/must fit within the vessel capacity/);
  assert.equal((await db.query('select capacity from public.accommodation where id=$1',[economy])).rows[0].capacity,50);
});
it('does not count inactive classes but rechecks the limit when they are enabled',async()=>{
  await save('Business Class',30,{id:business,isActive:false});
  await assert.rejects(save('Business Class',30,{id:business,isActive:true}),/must fit within the vessel capacity/);
  assert.equal((await db.query('select is_active from public.accommodation where id=$1',[business])).rows[0].is_active,false);
  await save('Business Class',20,{id:business,isActive:true});
});
it('also rejects lowering the vessel capacity below allocated classes through the API',async()=>{
  await assert.rejects(db.query("select barkolink_private.execute_accommodation('AdminUpdateVessel',$1::jsonb,$2,'ADMIN')",[JSON.stringify({id:vesselId,name:'Capacity fixture',capacity:90,isActive:true}),actor]),/cannot be below its allocated accommodation seats/);
  assert.equal((await db.query('select passenger_capacity from public.vessel where id=$1',[vesselId])).rows[0].passenger_capacity,100);
});
it('allows a safe capacity change with no active sailings, then blocks changes while a sailing is active',async()=>{
  const update=capacity=>db.query("select barkolink_private.execute_accommodation('AdminUpdateVessel',$1::jsonb,$2,'ADMIN')",[JSON.stringify({id:vesselId,name:'Capacity fixture',capacity,isActive:true}),actor]);
  await update(120);
  assert.equal((await db.query('select passenger_capacity from public.vessel where id=$1',[vesselId])).rows[0].passenger_capacity,120);
  await db.query("insert into public.port(code,name,city) values('CAP-A','Origin','Origin'),('CAP-B','Destination','Destination')");
  await db.query(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    select 'CAP-ACTIVE',o.id,d.id,$1,now()+interval '1 day',now()+interval '26 hours',120,600,480,480,300,480,600,120 from public.port o,public.port d where o.code='CAP-A' and d.code='CAP-B'`,[vesselId]);
  await assert.rejects(update(130),/no active sailings/);
});
