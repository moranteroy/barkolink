import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {queryLive,projectRef} from './test-data-database.mjs';

const target='barkolink_private.execute_flexible_discounts_v31(text,jsonb,text,text)';
const inspect=`select to_regprocedure('barkolink_private.loyalty_milestone_usage(text)') is not null as usage_helper,
  position('loyalty_milestone_usage(actor_uid)' in pg_get_functiondef('${target}'::regprocedure))>0 as response_extended`;
const fingerprint=`select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb)::text) from public.booking b`;
const vouchers=`select md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb)::text) from public.voucher v`;
async function main(){
  const before=(await queryLive(inspect))[0];
  console.log(JSON.stringify({project:projectRef,state:before}));
  if(!process.argv.includes('--apply'))return;
  if(before.usage_helper!==before.response_extended)throw new Error('Partial milestone migration detected. No changes applied.');
  if(!before.usage_helper){
    const folder=`.backups/loyalty-milestone-usage-${Date.now()}`;
    fs.mkdirSync(folder,{recursive:true});
    const definitions=await queryLive(`select pg_get_functiondef('${target}'::regprocedure) definition`);
    fs.writeFileSync(`${folder}/before.json`,JSON.stringify({project:projectRef,before,definitions},null,2),{flag:'wx'});
    const sql=fs.readFileSync('supabase/migrations/063_loyalty_milestone_usage.sql','utf8');
    await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='30s';
      select pg_advisory_xact_lock(hashtext('barkolink-loyalty-milestone-usage'));
      create temporary table milestone_before on commit drop as select (${fingerprint}) booking_hash,(${vouchers}) voucher_hash;
      ${sql}
      do $$begin if exists(select 1 from milestone_before where booking_hash is distinct from (${fingerprint}) or voucher_hash is distinct from (${vouchers}))
      then raise exception 'Operational data changed. Rolling back.';end if;end $$;commit;`,false);
    fs.writeFileSync(`${folder}/receipt.json`,JSON.stringify({project:projectRef,sha256:createHash('sha256').update(sql).digest('hex'),appliedAt:new Date().toISOString()},null,2),{flag:'wx'});
  }
  const after=(await queryLive(inspect))[0];
  if(!after.usage_helper||!after.response_extended)throw new Error('Milestone response verification failed.');
  // SELECT-only helper verification; do not call MyLoyalty (it can issue rewards).
  const checks=await queryLive(`select
    not has_function_privilege('authenticated','barkolink_private.loyalty_milestone_usage(text)','execute') as helper_private,
    (select bool_and(jsonb_array_length(barkolink_private.loyalty_milestone_usage(uid))=3) from public.app_user where role='PASSENGER') as three_milestones_per_passenger`,false);
  if(!checks[0].helper_private||checks[0].three_milestones_per_passenger===false)throw new Error('Post-deployment check failed.');
  console.log(JSON.stringify({installed:true,state:after,checks:checks[0]}));
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
