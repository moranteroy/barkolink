import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

const installed = (
  await queryLive(`select strpos(
  pg_get_functiondef('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)'::regprocedure),
  'is not null and s.code is distinct from args->>''sailingCode''') > 0 as installed`)
)[0].installed;
if (!installed) {
  await queryLive(
    `begin;
    set local lock_timeout='10s';
    set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-scan-first-boarding'));
    ${fs.readFileSync('supabase/migrations/068_scan_first_boarding.sql', 'utf8')}
    notify pgrst, 'reload schema';
    commit;`,
    false,
  );
}
console.log(
  'Scan-first boarding lookup installed; actual ticket departure-port and attendance guards retained.',
);
