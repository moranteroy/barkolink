import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { queryLive, projectRef, usersExpression } from './test-data-database.mjs';

async function main() {
  const migration = 'supabase/migrations/051_automatic_daily_trips.sql';
  const sql = fs.readFileSync(migration, 'utf8');
  const sha256 = crypto.createHash('sha256').update(sql).digest('hex');
  const metadata = (
    await queryLive(`select
    to_regprocedure('barkolink_private.generate_daily_trips()') is not null installed,
    to_regclass('cron.job') is not null cron_available,
    pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure) definition,
    (select count(*) from barkolink_private.daily_schedule where is_active) active_schedules`)
  )[0];
  assert.equal(
    metadata.cron_available,
    true,
    'Database cron must be available for unattended daily trips.',
  );
  console.log(
    JSON.stringify({
      projectRef,
      migration,
      sha256,
      installed: metadata.installed,
      activeSchedules: metadata.active_schedules,
    }),
  );
  if (!process.argv.includes('--apply')) return;
  if (!metadata.installed) {
    fs.mkdirSync('.backups', { recursive: true });
    const backupPath = `.backups/before-daily-trip-automation-${Date.now()}.json`;
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ projectRef, migration, sha256, definition: metadata.definition }, null, 2),
      { flag: 'wx', mode: 0o600 },
    );
    // Ignore only the newly added source/status columns when comparing existing rows.
    const fingerprint = `select md5(jsonb_build_object(
      'sailings',(select coalesce(jsonb_agg(to_jsonb(s)-'daily_schedule_id'-'daily_service_date'-'daily_departure_time' order by code),'[]') from public.sailing s),
      'schedules',(select coalesce(jsonb_agg(to_jsonb(s)-'vessel_id'-'generation_issues'-'last_generated_at' order by id),'[]') from barkolink_private.daily_schedule s),
      'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.booking b),
      'passengers',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.booking_passenger p),
      'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.online_payment p),
      'users',${usersExpression})::text) fingerprint`;
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='60s';
      select pg_advisory_xact_lock(hashtext('barkolink-daily-automation-install'));
      lock table public.sailing,public.booking,public.booking_passenger,public.online_payment,public.app_user,auth.users,
        barkolink_private.daily_schedule in share row exclusive mode;
      do $guard$ begin
        if pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure) <> '${metadata.definition.replaceAll("'", "''")}' then
          raise exception 'Dispatcher changed; installation aborted.';
        end if;
      end $guard$;
      create temporary table daily_automation_guard as ${fingerprint};
      ${sql}
      do $guard$ declare original text;current_value text;begin
        select fingerprint into original from daily_automation_guard;
        ${fingerprint.replace(' fingerprint', ' into current_value')};
        if original is distinct from current_value then raise exception 'Existing records changed; installation rolled back.';end if;
      end $guard$;
      notify pgrst,'reload schema';commit;`,
      false,
    );
    console.log(JSON.stringify({ installed: true, existingRecordsPreserved: true, backupPath }));
  }
  const verified = (
    await queryLive(`select
    (select count(*) from cron.job where jobname='barkolink-generate-daily-trips' and active and schedule='* * * * *') active_jobs,
    has_function_privilege('authenticated','barkolink_private.generate_daily_trips()','execute') direct_staff_access,
    has_function_privilege('anon','barkolink_private.generate_daily_trips()','execute') anonymous_access,
    position('execute_daily_automation' in pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure))>0 dispatcher_ready`)
  )[0];
  assert.equal(Number(verified.active_jobs), 1);
  assert.equal(verified.direct_staff_access, false);
  assert.equal(verified.anonymous_access, false);
  assert.equal(verified.dispatcher_ready, true);
  fs.mkdirSync('.audit', { recursive: true });
  const receipt = {
    projectRef,
    migration,
    sha256,
    verifiedAt: new Date().toISOString(),
    ...verified,
  };
  fs.writeFileSync('.audit/daily-trip-automation-migration.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
