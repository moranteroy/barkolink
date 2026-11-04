import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {queryLive,projectRef} from './test-data-database.mjs';

const inspectQuery=`select
 to_regprocedure('barkolink_private.execute_notifications(text,jsonb,text,text)') is not null as notifications_ready,
 to_regprocedure('barkolink_private.admin_directory(text,jsonb,text,text)') is not null as migration_061,
 to_regprocedure('barkolink_private.admin_sailing_priority(timestamptz,text,timestamptz)') is not null as migration_062,
 (select position('operational_priority asc' in pg_get_functiondef(p.oid))>0 from pg_proc p where p.oid=to_regprocedure('barkolink_private.admin_directory(text,jsonb,text,text)')) as today_first`;
async function main(){
const before=(await queryLive(inspectQuery))[0];
console.log(JSON.stringify({project:projectRef,state:before}));
if(!process.argv.includes('--apply'))process.exit(0);
if(!before.notifications_ready)throw new Error('Migration 060 is required. No migration applied.');
if(before.migration_062&&!before.today_first)throw new Error('Partial trip-order migration found. No changes applied.');
if(before.migration_062&&before.today_first){
 const verification=await verifyOrder();
 fs.mkdirSync('.audit',{recursive:true});
 fs.writeFileSync('.audit/admin-trip-order-live.json',JSON.stringify({project:projectRef,state:before,verification,verifiedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({installed:true,verification},null,2));process.exit(0);
}
const files=[...(!before.migration_061?['061_bounded_workspace_reads.sql']:[]),'062_today_first_admin_trips.sql'];
const folder=`.backups/admin-trip-order-${Date.now()}`;
fs.mkdirSync(folder,{recursive:true});
const definitions=await queryLive(`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.oid in(to_regprocedure('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'),to_regprocedure('barkolink_private.execute_notifications(text,jsonb,text,text)'),to_regprocedure('barkolink_private.admin_directory(text,jsonb,text,text)'))`);
fs.writeFileSync(`${folder}/before.json`,JSON.stringify({project:projectRef,state:before,definitions},null,2),{flag:'wx'});
const migrations=files.map(file=>({file,sql:fs.readFileSync(`supabase/migrations/${file}`,'utf8')}));
await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='45s';
 select pg_advisory_xact_lock(hashtext('barkolink-admin-trip-order'));
 ${migrations.map(item=>item.sql).join('\n')}\ncommit;`,false);
const after=(await queryLive(inspectQuery))[0];
if(!after.migration_061||!after.migration_062||!after.today_first)throw new Error('Post-deployment verification failed.');
const verification=await verifyOrder();
const receipt={project:projectRef,applied:migrations.map(item=>({file:item.file,sha256:createHash('sha256').update(item.sql).digest('hex')})),after,verification,appliedAt:new Date().toISOString()};
fs.writeFileSync(`${folder}/receipt.json`,JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify(receipt,null,2));
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});

async function verifyOrder(){
 // The management read-only role cannot execute private helpers. This query
 // uses owner access but only SELECTs the reviewed, read-only directory helper.
 return queryLive(`with admin as (select uid from public.app_user where role='ADMIN' order by uid limit 1),
 response as (select barkolink_private.admin_directory('AdminSailings','{"pageSize":30}'::jsonb,uid,'ADMIN') data from admin)
 select (now() at time zone 'Asia/Manila')::date as philippine_today,data->>'totalCount' as total_trips,
 (select jsonb_agg(jsonb_build_object('date',(s.value->>'departure_at')::timestamptz at time zone 'Asia/Manila','status',s.value->>'status','priority',barkolink_private.admin_sailing_priority((s.value->>'departure_at')::timestamptz,s.value->>'status')) order by s.position)
 from jsonb_array_elements(data->'sailings') with ordinality s(value,position) where s.position<=6) as first_trips from response`,false);
}
