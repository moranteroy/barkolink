import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

async function main() {
  const seed = fs.readFileSync('supabase/advisory-drafts.sql', 'utf8');
  if (process.argv.includes('--apply')) {
    await queryLive(
      `begin;
    set local lock_timeout='10s';
    set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-advisory-drafts'));
    ${seed}
    commit;`,
      false,
    );
  }
  console.log(
    JSON.stringify(
      await queryLive(`select title,category,priority,published,
  to_char(starts_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') starts_ph,
  to_char(ends_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') ends_ph
  from public.travel_advisory where id::text like 'd620ad00-1031-4000-8000-%' order by id`),
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
