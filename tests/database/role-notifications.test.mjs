import {PGlite} from '@electric-sql/pglite';
import {beforeEach,afterEach,it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const ids={admin:'33333333-3333-4333-8333-333333333333',passenger:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222',ticketing:'44444444-4444-4444-8444-444444444444',boarding:'55555555-5555-4555-8555-555555555555',remote:'66666666-6666-4666-8666-666666666666',unassigned:'77777777-7777-4777-8777-777777777777'};
const origin='76a29980-5c27-4c4b-9ead-cae943202001',destination='76a29980-5c27-4c4b-9ead-cae943202002',ship='76a29980-5c27-4c4b-9ead-cae943203001';
const roles={admin:'ADMIN',passenger:'PASSENGER',other:'PASSENGER',ticketing:'TICKETING',boarding:'BOARDING',remote:'TICKETING',unassigned:'BOARDING'};
beforeEach(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 select set_config('request.jwt.claims','{"aal":"aal2"}',false);`);
 for(const file of fs.readdirSync('supabase/migrations').filter(f=>/^\d.*sql$/.test(f)).sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql','utf8'));
 for(const [key,uid] of Object.entries(ids))await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,jsonb_build_object('role',$3::text))",[uid,key+'@example.invalid',roles[key]]);
 await db.query('update public.app_user set assigned_port_id=$1 where uid in($2,$3)',[origin,ids.ticketing,ids.boarding]);
 await db.query('update public.app_user set assigned_port_id=$1 where uid=$2',[destination,ids.remote]);
 await db.query(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
 values('NOTICE-TRIP',$1,$2,$3,now()+interval '2 days',now()+interval '2 days 2 hours',120,600,480,480,300,480,600,200)`,[origin,destination,ship]);
});
afterEach(async()=>await db?.close());
async function call(key,op,args={}){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[key]||'']);await db.exec('set role authenticated');
 try{return(await db.query('select public.barkolink_execute($1,$2::jsonb) data',[op,JSON.stringify(args)])).rows[0].data;}finally{await db.exec('reset role');}
}
async function inbox(key){return(await call(key,'MyNotifications')).notifications;}
async function booking(){
 return(await db.query(`insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,booking_channel,payment_deadline)
 values('BKG-NOTICE', $1,'NOTICE-TRIP','PENDING',1,600,600,'ONLINE',now()+interval '1 day') returning id`,[ids.passenger])).rows[0].id;
}
it('delivers new booking alerts only to admin and staff assigned to its departure port',async()=>{
 await booking();
 for(const key of ['admin','ticketing','boarding']){
  const notes=await inbox(key);assert.equal(notes.length,1);assert.equal(notes[0].title,'New booking received');assert.equal(notes[0].bookingReference,'BKG-NOTICE');assert.ok(notes[0].message.includes('Awaiting passenger payment'));
 }
 for(const key of ['passenger','other','remote','unassigned'])assert.equal((await inbox(key)).length,0);
});
it('routes online verification to ticketing and verified-ticket updates to boarding without duplicates',async()=>{
 const id=await booking();
 await db.query("update public.booking set payment_status='PAID',payment_method='PAYMONGO_TEST',status='CONFIRMED' where id=$1",[id]);
 assert.ok((await inbox('ticketing')).some(n=>n.title==='Online payment needs verification'));
 assert.equal((await inbox('boarding')).some(n=>n.title==='Online payment needs verification'),false);
 await db.query('update public.booking set payment_verified_at=now() where id=$1',[id]);
 await db.query('update public.booking set payment_verified_at=payment_verified_at where id=$1',[id]);
 assert.equal((await inbox('boarding')).filter(n=>n.title==='Passenger tickets ready').length,1);
 assert.equal((await inbox('ticketing')).some(n=>n.title==='Passenger tickets ready'),false);
 assert.equal((await inbox('passenger')).some(n=>n.title==='Online payment needs verification'),false);
 assert.equal((await inbox('remote')).length,0);
});
it('notifies the booking owner and relevant staff about cancellation and attendance only once',async()=>{
 const id=await booking();
 const p=(await db.query("insert into public.booking_passenger(booking_id,full_name,fare) values($1,'Booked Traveler',600) returning id",[id])).rows[0].id;
 await db.query("update public.booking_passenger set ticket_status='CHECKED_IN' where id=$1",[p]);
 await db.query("update public.booking_passenger set ticket_status='BOARDED' where id=$1",[p]);
 await db.query("update public.booking_passenger set ticket_status='BOARDED' where id=$1",[p]);
 assert.equal((await inbox('passenger')).filter(n=>n.title==='Passenger boarded').length,1);
 assert.equal((await inbox('other')).length,0);
 await db.query("update public.booking set status='CANCELLED' where id=$1",[id]);
 assert.equal((await inbox('passenger')).filter(n=>n.title==='Reservation cancelled').length,1);
 assert.ok((await inbox('ticketing')).some(n=>n.title==='Reservation cancelled'));
});
it('filters staff notices after a port or role change and blocks reads of another account notice',async()=>{
 await booking();const note=(await inbox('ticketing'))[0];
 await assert.rejects(call('passenger','MarkNotificationRead',{id:note.id}),/not found/);
 await db.query('update public.app_user set assigned_port_id=$1 where uid=$2',[destination,ids.ticketing]);
 assert.equal((await inbox('ticketing')).length,0);
 await assert.rejects(call('ticketing','MarkNotificationRead',{id:note.id}),/not found/);
 await call('ticketing','MyMarkAllNotificationsRead');
 assert.equal((await db.query('select read_at from public.notification where id=$1',[note.id])).rows[0].read_at,null);
 await db.query("update public.app_user set role='PASSENGER' where uid=$1",[ids.boarding]);
 await db.query("update auth.users set raw_app_meta_data=jsonb_build_object('role','PASSENGER') where id=$1",[ids.boarding]);
 assert.equal((await inbox('boarding')).length,0);
});
it('sends broadcasts only to the chosen audience and retries once without duplicate delivery',async()=>{
 await assert.rejects(call('passenger','AdminSendNotification',{title:'Forbidden',message:'Forbidden announcement',audience:'ALL',requestId:crypto.randomUUID()}),/Administrator|Staff access/);
 for(const audience of ['STAFF','PASSENGERS','TRIP','ALL']){
  if(audience==='TRIP')await booking();
  const args={title:'Notice for '+audience,message:'Audience test announcement',audience,requestId:crypto.randomUUID(),...(audience==='TRIP'?{sailingCode:'NOTICE-TRIP'}:{})};
  const sent=await call('admin','AdminSendNotification',args);assert.deepEqual(await call('admin','AdminSendNotification',args),sent);
  const expected=audience==='STAFF'?['admin','ticketing','boarding','remote','unassigned']:audience==='PASSENGERS'?['passenger','other']:audience==='TRIP'?['passenger']:Object.keys(ids);
  for(const key of Object.keys(ids))assert.equal((await inbox(key)).filter(n=>n.title===args.title).length,expected.includes(key)?1:0,`${audience} -> ${key}`);
 }
});
it('rejects legacy staff broadcasts for a passenger and scopes sailing changes to departure staff',async()=>{
 const campaign=crypto.randomUUID();
 await db.query("insert into public.notification_campaign(id,title,message,audience,sent_by_uid) values($1,'Staff only','Staff operational message','STAFF',$2)",[campaign,ids.admin]);
 await db.query("insert into public.notification(owner_uid,title,message,campaign_id) values($1,'Staff only','Staff operational message',$2)",[ids.passenger,campaign]);
 assert.equal((await inbox('passenger')).length,0);
 await db.exec("update public.sailing set status='DELAYED' where code='NOTICE-TRIP'");
 for(const key of ['admin','ticketing','boarding'])assert.ok((await inbox(key)).some(n=>n.category==='TRIPS'&&n.title==='Sailing delayed'));
 for(const key of ['passenger','other','remote','unassigned'])assert.equal((await inbox(key)).length,0);
 const access=(await db.query("select has_table_privilege('authenticated','public.notification','SELECT') direct_read,has_function_privilege('authenticated','barkolink_private.notify_booking_staff(public.booking,text,text,text,text[])','EXECUTE') can_send")).rows[0];
 assert.deepEqual(access,{direct_read:false,can_send:false});
});

it('delivers only published active advisories to eligible passengers, including scheduled delivery',async()=>{
 await booking();
 const create=async(title,extra={})=>(await db.query(`insert into public.travel_advisory(title,message,category,priority,starts_at,ends_at,published,sailing_code)
 values($1,'Follow terminal safety instructions.','SAFETY','HIGH',$2,$3,$4,$5) returning id`,[title,extra.start||new Date(Date.now()-3600000).toISOString(),new Date(Date.now()+86400000).toISOString(),extra.published??false,extra.trip||null])).rows[0].id;
 const draft=await create('Draft safety notice');assert.equal((await inbox('passenger')).some(n=>n.title.includes('Draft safety notice')),false);
 await db.query('update public.travel_advisory set published=true,sailing_code=$2 where id=$1',[draft,'NOTICE-TRIP']);
 assert.equal((await inbox('passenger')).filter(n=>n.title==='Travel advisory: Draft safety notice').length,1);
 assert.equal((await inbox('other')).length,0);
 assert.equal((await inbox('ticketing')).some(n=>n.title.startsWith('Travel advisory:')),false);
 const scheduled=await create('Tomorrow safety update',{published:true,start:new Date(Date.now()+3600000).toISOString()});
 assert.equal((await inbox('passenger')).some(n=>n.title.includes('Tomorrow safety update')),false);
 // Simulate the scheduled window becoming active without a publishing action.
 await db.exec('alter table public.travel_advisory disable trigger advisory_notification_delivery');
 await db.query("update public.travel_advisory set starts_at=now()-interval '1 hour' where id=$1",[scheduled]);
 await db.exec('alter table public.travel_advisory enable trigger advisory_notification_delivery');
 await inbox('passenger');await inbox('other');
 for(const key of ['passenger','other'])assert.equal((await inbox(key)).filter(n=>n.title==='Travel advisory: Tomorrow safety update').length,1);
});
it('rolls back generated notifications with a failed booking transaction',async()=>{
 await db.exec('begin');await booking();await db.exec('rollback');
 for(const key of ['admin','ticketing','boarding','passenger'])assert.equal((await inbox(key)).length,0);
});
