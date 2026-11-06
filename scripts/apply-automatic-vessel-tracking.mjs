import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, dataExpression, usersExpression } from './test-data-database.mjs';

const migrationPath = 'supabase/migrations/044_automatic_vessel_tracking.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const digest = crypto.createHash('sha256').update(migration).digest('hex');
const fingerprint = `jsonb_build_object('operations',md5(${dataExpression}::text),'users',${usersExpression})`;
const before = (
  await queryLive(`select
  to_regprocedure('barkolink_private.vessel_display_position_at(uuid,timestamptz)') is not null as installed,
  to_regprocedure('barkolink_private.execute_flexible_discounts_v43(text,jsonb,text,text)') is not null as previous_version,
  to_regprocedure('barkolink_private.vessel_position_at(uuid,timestamptz,text)') is not null as prerequisite,
  pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure) as dispatcher,
  pg_get_functiondef('barkolink_private.vessel_position_at(uuid,timestamptz,text)'::regprocedure) as booking_position,
  pg_get_functiondef('barkolink_private.vessel_departure_issue(uuid,uuid,timestamptz,text)'::regprocedure) as booking_check,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_ledger`)
)[0];
assert.equal(before.prerequisite, true, 'Tracking prerequisite is missing.');
console.log(
  JSON.stringify({
    projectRef,
    migration: migrationPath,
    installed: before.installed,
    previousVersion: before.previous_version,
    migrationLedger: before.migration_ledger,
    sha256: digest,
  }),
);

if (!before.installed && !process.argv.includes('--apply')) {
  console.log('Read-only preflight passed. Use --apply to install the reviewed migration.');
  process.exit(0);
}

if (!before.installed) {
  assert.equal(
    before.previous_version,
    false,
    'Unexpected dispatcher version; refusing to replace it.',
  );
  fs.mkdirSync('.backups', { recursive: true });
  fs.writeFileSync(
    `.backups/before-automatic-vessel-tracking-${Date.now()}.json`,
    JSON.stringify({ projectRef, ...before, migrationSha256: digest }, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  const expectedDispatcher = before.dispatcher.replaceAll("'", "''");
  await queryLive(
    `begin;
    set local lock_timeout='10s'; set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-automatic-vessel-tracking-install'));
    do $$ begin
      if to_regprocedure('barkolink_private.vessel_display_position_at(uuid,timestamptz)') is not null
        or pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure) is distinct from '${expectedDispatcher}' then
        raise exception 'Tracking schema changed after preflight; retry inspection.';
      end if;
    end $$;
    create temporary table tracking_044_guard on commit drop as select ${fingerprint} as value;
    ${migration}
    do $$ begin
      if (select value from tracking_044_guard) is distinct from ${fingerprint} then
        raise exception 'Operational records changed; rolling back migration.';
      end if;
    end $$;
    notify pgrst, 'reload schema';
    commit;`,
    false,
  );
  console.log(
    'Applied migration 044 in one transaction; operational records and accounts preserved.',
  );
}

const result = (
  await queryLive(
    `select
  pg_get_functiondef('barkolink_private.vessel_position_at(uuid,timestamptz,text)'::regprocedure) as booking_position,
  pg_get_functiondef('barkolink_private.vessel_departure_issue(uuid,uuid,timestamptz,text)'::regprocedure) as booking_check,
  has_function_privilege('anon','barkolink_private.vessel_display_position_at(uuid,timestamptz)','execute') as anonymous_access,
  has_function_privilege('authenticated','barkolink_private.vessel_display_position_at(uuid,timestamptz)','execute') as direct_client_access,
  (select count(*)::int from public.vessel where is_active) as active_vessels,
  (select count(*)::int from barkolink_private.vessel_port_observation) as confirmed_observations,
  (select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from
    (select barkolink_private.vessel_display_position_at(id,now())->>'state' as state,count(*)::int as n
      from public.vessel where is_active group by 1) states) as estimated_states`,
    false,
  )
)[0];
assert.equal(result.booking_position, before.booking_position);
assert.equal(result.booking_check, before.booking_check);
assert.equal(result.anonymous_access, false);
assert.equal(result.direct_client_access, false);
const { booking_position, booking_check, ...summary } = result;
const receipt = {
  projectRef,
  migration: migrationPath,
  sha256: digest,
  verifiedAt: new Date().toISOString(),
  bookingChecksUnchanged: true,
  ...summary,
};
fs.mkdirSync('.audit', { recursive: true });
fs.writeFileSync(
  '.audit/automatic-vessel-tracking-migration.json',
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt));
