import fs from 'node:fs';
import assert from 'node:assert/strict';
import { queryLive, projectRef } from './test-data-database.mjs';

const snapshotSql = `select jsonb_build_object(
  'classes',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.accommodation a),
  'vessels',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from public.vessel v),
  'bookings',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]')::text) from public.booking b),
  'passengers',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')::text) from public.booking_passenger p),
  'payments',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')::text) from public.online_payment p),
  'trips',(select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.code),'[]')::text) from public.sailing s)) snapshot`;
const before = (await queryLive(snapshotSql))[0].snapshot;
const migration = fs.readFileSync(
  'supabase/migrations/054_initial_vessel_accommodation_classes.sql',
  'utf8',
);
if (process.argv.includes('--apply')) {
  fs.mkdirSync('.backups', { recursive: true });
  const backupPath = `.backups/before-vessel-accommodations-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ projectRef, ...before }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const expected = JSON.stringify(before).replaceAll("'", "''");
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='45s';
    lock table public.vessel,public.accommodation,public.booking,public.booking_passenger,public.online_payment,public.sailing in share row exclusive mode;
    do $$ declare current_snapshot jsonb;begin ${snapshotSql.replace(' snapshot', ' into current_snapshot')};
      if current_snapshot is distinct from '${expected}'::jsonb then raise exception 'Data changed after backup; allocation aborted.';end if;end $$;
    ${migration}
    do $$ declare current_snapshot jsonb;begin ${snapshotSql.replace(' snapshot', ' into current_snapshot')};
      if current_snapshot-'classes' is distinct from '${expected}'::jsonb-'classes' then raise exception 'Protected records changed; allocation aborted.';end if;end $$;
    commit;`,
    false,
  );
  const after = (await queryLive(snapshotSql))[0].snapshot;
  for (const field of ['vessels', 'bookings', 'passengers', 'payments'])
    assert.deepEqual(after[field], before[field]);
  fs.mkdirSync('.audit', { recursive: true });
  fs.writeFileSync(
    '.audit/vessel-accommodation-allocation.json',
    JSON.stringify(
      {
        projectRef,
        backupPath,
        appliedAt: new Date().toISOString(),
        classesBefore: before.classes.length,
        classesAfter: after.classes.length,
        protectedRecordsUnchanged: true,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify(
    await queryLive(
      `select v.name,v.passenger_capacity,a.name class,a.capacity,a.surcharge from public.vessel v join public.accommodation a on a.vessel_id=v.id where v.is_active order by v.name,case a.name when 'Economy' then 1 when 'Tourist Class' then 2 else 3 end`,
    ),
    null,
    2,
  ),
);
