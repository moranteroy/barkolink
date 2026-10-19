import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, dataExpression, usersExpression } from './test-data-database.mjs';
const file='supabase/migrations/047_preserve_authenticator_on_toggle.sql';
const sql=fs.readFileSync(file,'utf8'),sha256=crypto.createHash('sha256').update(sql).digest('hex');
const before=(await queryLive(`select to_regprocedure('public.set_account_mfa_enabled(boolean)') is not null installed,
  to_regclass('auth.mfa_factors') is not null auth_mfa_available,
  pg_get_functiondef('barkolink_private.account_mfa_required(uuid,text)'::regprocedure) definition,
  pg_get_functiondef('public.my_mfa_settings()'::regprocedure) settings_definition`))[0];
assert.equal(before.auth_mfa_available,true);
console.log(JSON.stringify({projectRef,migration:file,installed:before.installed,sha256}));
if(!before.installed && !process.argv.includes('--apply'))process.exit(0);
if(!before.installed){
  fs.mkdirSync('.backups',{recursive:true});
  fs.writeFileSync(`.backups/before-retained-authenticator-${Date.now()}.json`,JSON.stringify({projectRef,...before,sha256},null,2),{flag:'wx',mode:0o600});
  const fingerprint=`jsonb_build_object('operations',md5(${dataExpression}::text),'users',${usersExpression},'staff_policy',(select md5(to_jsonb(p)::text) from barkolink_private.mfa_policy p where singleton),'factors',(select md5(coalesce(jsonb_agg(to_jsonb(f) order by id),'[]'::jsonb)::text) from auth.mfa_factors f))`;
  await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-retained-authenticator'));
    do $$ begin if to_regprocedure('public.set_account_mfa_enabled(boolean)') is not null or pg_get_functiondef('barkolink_private.account_mfa_required(uuid,text)'::regprocedure) is distinct from '${before.definition.replaceAll("'","''")}' then raise exception 'MFA schema changed after preflight';end if;end $$;
    create temporary table mfa_047_guard on commit drop as select ${fingerprint} value;
    ${sql}
    do $$ begin if (select value from mfa_047_guard) is distinct from ${fingerprint} then raise exception 'Records or factors changed; migration rolled back';end if;end $$;
    notify pgrst,'reload schema';commit;`,false);
}
const result=(await queryLive(`select
  (select staff_required from barkolink_private.mfa_policy where singleton) staff_required,
  has_function_privilege('anon','public.my_mfa_settings()','execute') anonymous_settings,
  has_function_privilege('authenticated','public.my_mfa_settings()','execute') signed_in_settings,
  has_function_privilege('authenticated','public.admin_mfa_requirement(uuid)','execute') direct_admin_check,
  has_function_privilege('service_role','public.admin_mfa_requirement(uuid)','execute') service_admin_check,
  (select count(*)::int from auth.mfa_factors where status='verified') existing_verified_factors,
  has_function_privilege('anon','public.set_account_mfa_enabled(boolean)','execute') anonymous_toggle,
  has_function_privilege('authenticated','public.set_account_mfa_enabled(boolean)','execute') signed_in_toggle`))[0];
assert.equal(result.anonymous_toggle,false);assert.equal(result.signed_in_toggle,true);assert.equal(result.anonymous_settings,false);assert.equal(result.signed_in_settings,true);
assert.equal(result.direct_admin_check,false);assert.equal(result.service_admin_check,true);
const receipt={projectRef,migration:file,sha256,verifiedAt:new Date().toISOString(),...result};
fs.mkdirSync('.audit',{recursive:true});fs.writeFileSync('.audit/retained-authenticator-migration.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
