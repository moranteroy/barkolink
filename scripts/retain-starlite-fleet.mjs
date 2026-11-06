import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {
  queryLive,
  projectRef,
  dataExpression,
  usersExpression,
  dataTables,
} from './test-data-database.mjs';
import { fleetTargetsSql, deleteNonStarliteSql } from './starlite-cleanup-sql.mjs';

async function main() {
  const policyRows = `(select coalesce(jsonb_agg(to_jsonb(p) order by operator),'[]') from barkolink_private.sailing_status_policy p)`;
  const fingerprint = `md5((${dataExpression})::text || (${usersExpression})::text || (${policyRows})::text)`;
  const snapshot = (
    await queryLive(
      `select ${dataExpression} data,${usersExpression} users,${policyRows} policies,${fingerprint} fingerprint,now() captured_at`,
    )
  )[0];
  const retained = snapshot.data.vessel.filter(
    (v) => v.reference_metadata?.operator === 'Starlite Ferries',
  );
  const targetVessels = snapshot.data.vessel.filter(
    (v) => v.reference_metadata?.operator !== 'Starlite Ferries',
  );
  const targetIds = new Set(targetVessels.map((v) => v.id));
  const targetTrips = new Set(
    snapshot.data.sailing.filter((s) => targetIds.has(s.vessel_id)).map((s) => s.code),
  );
  const targetBookings = new Set(
    snapshot.data.booking.filter((b) => targetTrips.has(b.sailing_code)).map((b) => b.id),
  );
  assert.deepEqual(
    retained.map((v) => v.code).sort(),
    ['SL-ANNAPOLIS', 'SL-JUPITER', 'SL-PACIFIC', 'SL-SPRINT-1', 'SL-STELLA-DEL-MAR'].sort(),
  );
  console.log(
    JSON.stringify({
      projectRef,
      retained: retained.map((v) => ({ code: v.code, name: v.name })),
      remove: {
        vessels: targetIds.size,
        trips: targetTrips.size,
        bookings: targetBookings.size,
        passengers: snapshot.data.booking_passenger.filter((p) => targetBookings.has(p.booking_id))
          .length,
        payments: snapshot.data.online_payment.filter((p) => targetBookings.has(p.booking_id))
          .length,
      },
    }),
  );
  if (!process.argv.includes('--apply')) return;
  if (!targetVessels.length) {
    console.log('Only the five Starlite vessels remain.');
    return;
  }
  fs.mkdirSync('.backups', { recursive: true });
  const backupPath = `.backups/before-starlite-only-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ projectRef, ...snapshot }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const backupSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(backupPath))
    .digest('hex');
  const verify = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(verify.fingerprint, snapshot.fingerprint);
  assert.equal(verify.data.vessel.length, snapshot.data.vessel.length);
  assert.match(snapshot.fingerprint, /^[a-f0-9]{32}$/);
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='90s';
    select pg_advisory_xact_lock(hashtext('barkolink-reference-catalog'));
    lock table ${dataTables.map((t) => `public.${t}`).join(',')},public.app_user,auth.users,barkolink_private.daily_schedule,barkolink_private.vessel_port_observation,barkolink_private.sailing_status_policy in share row exclusive mode;
    do $$ begin if ${fingerprint} is distinct from '${snapshot.fingerprint}' then raise exception 'Records changed after backup; cleanup aborted.';end if;end $$;
    ${fleetTargetsSql}
    ${deleteNonStarliteSql}
    commit;`,
    false,
  );
  const after = (
    await queryLive(
      `select (select count(*)::int from public.vessel) vessels,(select count(*)::int from public.sailing) trips,(select count(*)::int from public.booking) bookings,(select count(*)::int from public.booking_passenger) passengers,(select count(*)::int from public.online_payment) payments`,
    )
  )[0];
  const receipt = {
    projectRef,
    backupPath,
    backupSha256,
    retained: retained.map((v) => v.name),
    after,
    verifiedAt: new Date().toISOString(),
    retainedRecords: 'unchanged',
  };
  fs.mkdirSync('.audit', { recursive: true });
  fs.writeFileSync('.audit/starlite-only-cleanup.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
