import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, dataExpression, usersExpression } from './test-data-database.mjs';

// Default: metadata inspection only. --apply installs tested function definitions;
// it never adjusts a real trip, grants a new role, or changes an operator policy.
async function main() {
const file = 'supabase/migrations/048_boarding_staff_trip_timing.sql';
const sql = fs.readFileSync(file, 'utf8');
const sha256 = crypto.createHash('sha256').update(sql).digest('hex');
const inspect = `select to_regprocedure('barkolink_private.execute_flexible_discounts_v47(text,jsonb,text,text)') is not null installed,
  pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure) definition,
  to_regclass('barkolink_private.sailing_status_policy') is not null policy_available`;
const before = (await queryLive(inspect))[0];
assert.equal(before.policy_available, true, 'Existing sailing-status setup is required.');
console.log(JSON.stringify({projectRef, migration:file, installed:before.installed, sha256}));
if (!process.argv.includes('--apply')) process.exit(0);
if (!before.installed) {
  fs.mkdirSync('.backups', {recursive:true});
  const backupPath = `.backups/before-boarding-staff-timing-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({projectRef,sha256,definition:before.definition},null,2), {flag:'wx',mode:0o600});
  const fingerprint = `select md5((${dataExpression})::text || (${usersExpression})::text ||
    coalesce((select jsonb_agg(to_jsonb(p) order by operator)::text from barkolink_private.sailing_status_policy p),'[]')) fingerprint`;
  await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='60s';
    select pg_advisory_xact_lock(hashtext('barkolink-boarding-staff-timing-install'));
    lock table public.sailing,public.booking,public.booking_passenger,public.online_payment,public.activity_log,
      public.app_user,auth.users,barkolink_private.sailing_status_policy in share mode;
    create temporary table boarding_timing_guard as ${fingerprint};
    ${sql}
    do $$ declare initial text;current_value text;begin
      select fingerprint into initial from boarding_timing_guard;
      ${fingerprint.replace(' fingerprint',' into current_value')};
      if initial is distinct from current_value then raise exception 'Existing records changed; migration rolled back.';end if;
    end $$;
    notify pgrst,'reload schema';commit;`, false);
  console.log(JSON.stringify({installed:true,backupPath}));
}
const result = (await queryLive(`select
  position('BoardingSetSailingTiming' in pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure))>0 operation_available,
  has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts(text,jsonb,text,text)','execute') direct_staff_access,
  has_function_privilege('anon','barkolink_private.execute_flexible_discounts(text,jsonb,text,text)','execute') direct_anonymous_access,
  has_function_privilege('authenticated','barkolink_private.execute_flexible_discounts_v47(text,jsonb,text,text)','execute') legacy_bypass_access`))[0];
assert.equal(result.operation_available,true);assert.equal(result.direct_staff_access,false);
assert.equal(result.direct_anonymous_access,false);assert.equal(result.legacy_bypass_access,false);
fs.mkdirSync('.audit',{recursive:true});
const receipt={projectRef,migration:file,sha256,verifiedAt:new Date().toISOString(),...result};
fs.writeFileSync('.audit/boarding-staff-timing-migration.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
