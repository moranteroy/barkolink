import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { queryLive, projectRef, dataExpression, usersExpression } from './test-data-database.mjs';

// Read-only by default. --apply replaces only the itinerary validation function.
async function main() {
  const migration = 'supabase/migrations/050_enforce_schedule_vessel_ports.sql';
  const sql = fs.readFileSync(migration, 'utf8');
  const sha256 = crypto.createHash('sha256').update(sql).digest('hex');
  const definitionQuery =
    "select pg_get_functiondef('barkolink_private.check_vessel_port_chain()'::regprocedure) definition";
  const before = (await queryLive(definitionQuery))[0].definition;
  console.log(
    JSON.stringify({ projectRef, migration, sha256, apply: process.argv.includes('--apply') }),
  );
  if (!process.argv.includes('--apply')) return;
  fs.mkdirSync('.backups', { recursive: true });
  const backupPath = `.backups/before-vessel-port-validation-${Date.now()}.json`;
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ projectRef, migration, sha256, definition: before }, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  const fingerprint = `select md5((${dataExpression})::text || (${usersExpression})::text) fingerprint`;
  await queryLive(
    `begin;
    set local lock_timeout='10s';set local statement_timeout='60s';
    select pg_advisory_xact_lock(hashtext('barkolink-vessel-port-validation-install'));
    lock table public.sailing,public.booking,public.app_user,auth.users in share mode;
    do $guard$ begin
      if pg_get_functiondef('barkolink_private.check_vessel_port_chain()'::regprocedure) <> '${before.replaceAll("'", "''")}' then
        raise exception 'Validation definition changed; installation aborted.';
      end if;
    end $guard$;
    create temporary table vessel_validation_guard as ${fingerprint};
    ${sql}
    do $guard$ declare initial text;current_value text;begin
      select fingerprint into initial from vessel_validation_guard;
      ${fingerprint.replace(' fingerprint', ' into current_value')};
      if initial is distinct from current_value then raise exception 'Existing records changed; migration rolled back.';end if;
    end $guard$;
    commit;`,
    false,
  );
  const installed = (await queryLive(definitionQuery))[0].definition;
  assert.match(installed, /Every later voyage must respect/);
  assert.match(installed, /or exists\(select 1 from public.sailing/);
  fs.mkdirSync('.audit', { recursive: true });
  const receipt = {
    projectRef,
    migration,
    sha256,
    backupPath,
    verifiedAt: new Date().toISOString(),
    installed: true,
    recordsUnchanged: true,
  };
  fs.writeFileSync(
    '.audit/vessel-port-validation-migration.json',
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
