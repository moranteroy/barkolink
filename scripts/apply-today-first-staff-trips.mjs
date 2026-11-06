import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

const installed = (
  await queryLive(`select strpos(
  pg_get_functiondef('barkolink_private.execute_workspaces(text,jsonb,text,text)'::regprocedure),
  'admin_sailing_priority(p.departure_at,p.status)') > 0 as installed`)
)[0].installed;
if (!installed) {
  await queryLive(
    `begin;
    set local lock_timeout='10s';
    set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-today-first-staff-trips'));
    ${fs.readFileSync('supabase/migrations/067_today_first_staff_trips.sql', 'utf8')}
    notify pgrst, 'reload schema';
    commit;`,
    false,
  );
}
console.log('Staff trips prioritize today in Philippine time before pagination.');
