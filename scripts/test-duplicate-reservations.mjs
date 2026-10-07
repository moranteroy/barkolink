import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { admin, sql } from './paymongo-sandbox.mjs';
const frontend=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(line=>/^\w+=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1).trim().replace(/^['"]|['"]$/g,'')]}));
const keys=await admin('/api-keys');
const service=createClient(frontend.VITE_SUPABASE_URL,keys.find(key=>key.name==='service_role').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(frontend.VITE_SUPABASE_URL,frontend.VITE_SUPABASE_PUBLISHABLE_KEY || frontend.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const tag=`DUP-${Date.now()}`,email=`${tag.toLowerCase()}@example.invalid`,password=randomBytes(24).toString('hex');
const literal=value=>`'${value.replaceAll("'","''")}'`;
let uid;
try{
  const account=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fullName:'[TEST] Duplicate Booking'},app_metadata:{role:'PASSENGER'}});
  if(account.error)throw account.error; uid=account.data.user.id;
  const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;
  await sql(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    select ${literal(tag)},a.id,b.id,v.id,'2098-10-08T08:00:00Z','2098-10-08T09:00:00Z',60,600,480,480,300,480,600,2
    from public.port a cross join public.port b cross join public.vessel v where a.id<>b.id and a.is_active and b.is_active and v.is_active
    and not exists(select 1 from public.sailing s where s.vessel_id=v.id and s.departure_at<'2098-10-08T09:00:00Z' and s.arrival_at>'2098-10-08T08:00:00Z') limit 1`,false);
  const trip=(await service.from('sailing').select('vessel_id').eq('code',tag).single()).data;
  assert.ok(trip,'An isolated sailing must be available.');
  const accommodation=(await service.from('accommodation').select('id').eq('vessel_id',trip.vessel_id).eq('is_active',true).order('surcharge').limit(1)).data?.[0];
  const args={sailingCode:tag,accommodationId:accommodation?.id,passenger1Name:'Duplicate Passenger',passenger1Type:'REGULAR',passenger1BirthDate:'1990-01-01',passenger1Sex:'Female',passenger1Phone:'09171234567',passenger1Nationality:'Filipino'};
  const results=await Promise.all(['A','B'].map(suffix=>client.rpc('barkolink_execute',{operation:'ReserveSailing1',args:{...args,reference:`${tag}-${suffix}`}})));
  assert.equal(results.filter(result=>!result.error).length,1);
  assert.match(results.find(result=>result.error).error.message,/Duplicate booking/);
  const rows=(await service.from('booking').select('id,reference').eq('owner_uid',uid)).data;
  assert.equal(rows.length,1);
  assert.equal((await service.from('sailing').select('available_seats').eq('code',tag).single()).data.available_seats,1);
  const retry=await client.rpc('barkolink_execute',{operation:'ReserveSailing1',args:{...args,reference:rows[0].reference}});
  assert.equal(retry.error,null);
  const same=await client.rpc('barkolink_execute',{operation:'ReserveSailing1',args:{...args,reference:`${tag}-C`,passenger1Name:' DUPLICATE   PASSENGER '}});
  assert.match(same.error?.message || '',/Duplicate booking/);
  console.log('Concurrent submissions: one booking, one seat consumed, duplicate blocked, same-reference retry preserved.');
}finally{
  if(uid){
    await sql(`begin;
      delete from public.booking_passenger where booking_id in(select id from public.booking where owner_uid=${literal(uid)});
      delete from public.notification where owner_uid=${literal(uid)};
      delete from public.activity_log where actor_uid=${literal(uid)} or entity_id like ${literal(`${tag}%`)};
      delete from public.booking where owner_uid=${literal(uid)};
      delete from public.sailing where code=${literal(tag)};
      delete from public.app_user where uid=${literal(uid)};
      commit`,false);
    const removed=await service.auth.admin.deleteUser(uid);if(removed.error)throw removed.error;
    console.log('Isolated duplicate-booking test records cleaned up.');
  }
}
