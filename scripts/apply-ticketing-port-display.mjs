import assert from 'node:assert/strict';
import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

const installed = (
  await queryLive(`select
  to_regprocedure('barkolink_private.port_display_unscoped(uuid)') is not null as installed`)
)[0].installed;
if (!installed) {
  const migration = fs.readFileSync('supabase/migrations/066_ticketing_port_display.sql', 'utf8');
  await queryLive(
    `begin;
    set local lock_timeout='10s';
    set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-ticketing-port-display'));
    ${migration}
    notify pgrst, 'reload schema';
    commit;`,
    false,
  );
}
const result = (
  await queryLive(`select
  has_function_privilege('anon','public.port_display(uuid)','EXECUTE') as public_tv,
  has_function_privilege('authenticated','public.port_display(uuid)','EXECUTE') as signed_in_tv,
  has_function_privilege('authenticated','barkolink_private.port_display_unscoped(uuid)','EXECUTE') as bypass_allowed,
  has_function_privilege('anon','barkolink_private.port_display_unscoped(uuid)','EXECUTE') as anonymous_bypass_allowed`)
)[0];
assert.equal(result.public_tv, true);
assert.equal(result.signed_in_tv, true);
assert.equal(result.bypass_allowed, false);
assert.equal(result.anonymous_bypass_allowed, false);
console.log(
  'Ticketing TV port restriction installed; public TV and admin feed preserved, unscoped bypass denied.',
);
