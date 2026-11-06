import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, dataExpression, usersExpression } from './test-data-database.mjs';

const file = 'supabase/migrations/045_schedule_based_vessel_positions.sql';
const sql = fs.readFileSync(file, 'utf8');
const desired = sql.split('as $$')[1].split('$$;')[0].trim();
const sha256 = crypto.createHash('sha256').update(sql).digest('hex');
const signature = 'barkolink_private.vessel_position_at(uuid,timestamptz,text)';
const inspect = async () =>
  (
    await queryLive(`select pg_get_functiondef('${signature}'::regprocedure) definition,
  prosrc as source from pg_proc where oid='${signature}'::regprocedure`)
  )[0];
const before = await inspect();
const installed = before.source.trim() === desired;
console.log(JSON.stringify({ projectRef, migration: file, installed, sha256 }));
if (!installed && !process.argv.includes('--apply')) process.exit(0);
if (!installed) {
  fs.mkdirSync('.backups', { recursive: true });
  fs.writeFileSync(
    `.backups/before-schedule-based-vessel-positions-${Date.now()}.json`,
    JSON.stringify({ projectRef, ...before, sha256 }, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  const fingerprint = `jsonb_build_object('operations',md5(${dataExpression}::text),'users',${usersExpression})`;
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-schedule-based-positions'));
    do $$ begin if pg_get_functiondef('${signature}'::regprocedure) is distinct from '${before.definition.replaceAll("'", "''")}' then raise exception 'Position function changed after preflight';end if;end $$;
    create temporary table tracking_045_guard on commit drop as select ${fingerprint} value;
    ${sql}
    do $$ begin if (select value from tracking_045_guard) is distinct from ${fingerprint} then raise exception 'Records changed; migration rolled back';end if;end $$;
    notify pgrst,'reload schema';commit;`,
    false,
  );
}
assert.equal((await inspect()).source.trim(), desired);
const result = (
  await queryLive(
    `select
  has_function_privilege('anon','${signature}','execute') anonymous_access,
  has_function_privilege('authenticated','${signature}','execute') direct_client_access,
  (select count(*)::int from public.vessel where is_active) active_vessels,
  (select coalesce(jsonb_object_agg(state,n),'{}') from (select barkolink_private.vessel_display_position_at(id,now())->>'state' state,count(*)::int n from public.vessel where is_active group by 1) states) tracking_states,
  (select count(*)::int from public.sailing s where s.status='SCHEDULED' and s.departure_at>now() and barkolink_private.vessel_departure_issue(s.vessel_id,s.origin_port_id,s.departure_at,s.code) is null) eligible_scheduled_trips`,
    false,
  )
)[0];
assert.equal(result.anonymous_access, false);
assert.equal(result.direct_client_access, false);
const receipt = {
  projectRef,
  migration: file,
  sha256,
  verifiedAt: new Date().toISOString(),
  ...result,
};
fs.mkdirSync('.audit', { recursive: true });
fs.writeFileSync(
  '.audit/schedule-based-vessel-positions-migration.json',
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt));
