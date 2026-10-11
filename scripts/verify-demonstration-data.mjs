import assert from 'node:assert/strict';
import fs from 'node:fs';
import {queryLive} from './test-data-database.mjs';
import {batchId} from './demonstration-data.mjs';

const integrity=(await queryLive(`select
 (select count(*)::int from public.port where is_active) active_ports,
 (select count(*)::int from public.ferry_route where is_active) active_routes,
 (select count(*)::int from public.vessel where is_active) active_vessels,
 (select count(*)::int from public.vessel v where is_active and not exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id where vr.vessel_id=v.id and r.is_active)) unsupported_active_vessels,
 (select count(*)::int from public.booking b where b.passenger_count<>(select count(*) from public.booking_passenger p where p.booking_id=b.id)
 or b.passenger_fare_total<>coalesce((select sum(p.fare) from public.booking_passenger p where p.booking_id=b.id),0)+b.accommodation_surcharge*b.passenger_count
 or b.total<>b.passenger_fare_total+b.service_fee-b.voucher_discount) invalid_bookings,
 (select count(*)::int from public.sailing s join public.vessel v on v.id=s.vessel_id where s.available_seats<>v.passenger_capacity-coalesce((select sum(passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0)) invalid_seats,
 (select count(*)::int from public.vessel v where (select sum(capacity) from public.accommodation a where a.vessel_id=v.id and a.is_active)>v.passenger_capacity) invalid_cabins,
 (select count(*)::int from public.booking_passenger where length(qr_verification_token)<32) invalid_qr_credentials`))[0];
assert.equal(integrity.active_ports,2);assert.equal(integrity.active_routes,2);
for(const key of ['unsupported_active_vessels','invalid_bookings','invalid_seats','invalid_cabins','invalid_qr_credentials'])assert.equal(integrity[key],0,key);
const transitions=await queryLive(`select s.code,m.item->>'scenario' scenario,s.status,
 (select count(*)::int from public.activity_log a where a.entity_type='sailing' and a.entity_id=s.code and a.action='UPDATE' and a.details ? 'status' and a.actor_role='SYSTEM') automatic_updates
 from barkolink_private.demonstration_batch b cross join lateral jsonb_array_elements(b.manifest->'sailings') m(item)
 join public.sailing s on s.code=m.item->>'code' where b.id='${batchId}'
 and m.item->>'scenario' in ('automatic-boarding','automatic-completion','delayed','cancelled') order by scenario`);
const expected={'automatic-boarding':'BOARDING','automatic-completion':'COMPLETED',delayed:'DELAYED',cancelled:'CANCELLED'};
assert.equal(transitions.length,4);
for(const t of transitions){assert.equal(t.status,expected[t.scenario],`${t.scenario}: wait until the next scheduler tick after its configured time`);assert.equal(t.automatic_updates,t.scenario.startsWith('automatic-')?1:0);}
const duplicates=(await queryLive(`select count(*)::int n from (
 select n.owner_uid,n.title,s.code,count(*) from public.notification n
 join public.sailing s on position('Trip '||s.code||' ' in n.message)=1
 where n.title in ('Boarding time reached','Scheduled arrival reached') and s.code in
 (select item->>'code' from barkolink_private.demonstration_batch b cross join lateral jsonb_array_elements(b.manifest->'sailings') item where b.id='${batchId}')
 group by n.owner_uid,n.title,s.code having count(*)>1)t`))[0].n;
assert.equal(duplicates,0,'Duplicate automatic notifications');
const cron=await queryLive(`select j.active,j.schedule,d.status,d.start_time,d.end_time from cron.job j
 left join lateral(select status,start_time,end_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1)d on true
 where j.jobname='barkolink-advance-sailing-statuses'`);
assert.equal(cron[0]?.active,true);assert.equal(cron[0]?.status,'succeeded');
const counts=(await queryLive(`select (select count(*)::int from public.sailing) trips,(select count(*)::int from public.booking) bookings,(select count(*)::int from public.booking_passenger) passengers`))[0];
const receipt={checkedAt:new Date().toISOString(),integrity,counts,transitions,duplicateNotifications:duplicates,cron};
fs.mkdirSync('.audit',{recursive:true});fs.writeFileSync('.audit/demonstration-verification.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
