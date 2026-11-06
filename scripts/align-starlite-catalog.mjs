import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { queryLive, projectRef } from './test-data-database.mjs';

const snapshotSql = `select jsonb_build_object(
 'vessels',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.vessel v where reference_metadata->>'operator'='Starlite Ferries'),
 'classes',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.accommodation a join public.vessel v on v.id=a.vessel_id where v.reference_metadata->>'operator'='Starlite Ferries'),
 'bookings',(select count(*) from public.booking),
 'passengers',(select count(*) from public.booking_passenger),
 'payments',(select count(*) from public.online_payment)) snapshot`;
const rows = await queryLive(snapshotSql);
const before = rows[0].snapshot;
console.log(
  JSON.stringify({
    vessels: before.vessels.map((v) => ({ code: v.code, name: v.name })),
    unsupportedClasses: before.classes
      .filter((a) => !['Economy', 'Tourist Class', 'Business Class'].includes(a.name))
      .map((a) => ({ id: a.id, name: a.name })),
  }),
);
if (process.argv.includes('--apply')) {
  fs.mkdirSync('.backups', { recursive: true });
  const backupPath = `.backups/before-starlite-catalog-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ projectRef, ...before }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex');
  assert.deepEqual(JSON.parse(fs.readFileSync(backupPath, 'utf8')).classes, before.classes);
  const migration = 'supabase/migrations/049_starlite_accommodation_catalog.sql';
  const expected = JSON.stringify(before).replaceAll("'", "''");
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='45s';
    lock table public.vessel,public.accommodation,public.booking in share row exclusive mode;
    do $$ declare current_snapshot jsonb;begin ${snapshotSql.replace(' snapshot', ' into current_snapshot')};
      if current_snapshot is distinct from '${expected}'::jsonb then raise exception 'Catalog changed after backup; changes aborted.';end if;end $$;
    ${fs.readFileSync(migration, 'utf8')}
    commit;`,
    false,
  );
  const after = (await queryLive(snapshotSql))[0].snapshot;
  for (const field of ['bookings', 'passengers', 'payments'])
    assert.equal(after[field], before[field]);
  fs.mkdirSync('.audit', { recursive: true });
  const receipt = {
    projectRef,
    backupPath,
    fingerprint,
    migration,
    removedClasses: before.classes.length - after.classes.length,
    vesselCodes: after.vessels.map((v) => v.code),
    bookingsUnchanged: true,
    verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync('.audit/starlite-catalog-alignment.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
