import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const [state] = await queryLive("select to_regprocedure('barkolink_private.execute_flexible_discounts_v25(text,jsonb,text,text)') is not null as installed");
if (!state.installed) {
  await queryLive(`begin; select pg_advisory_xact_lock(hashtext('barkolink-sailing-board-026')); ${fs.readFileSync('supabase/migrations/026_passenger_sailing_board.sql','utf8')} commit;`,false);
}
const [result] = await queryLive(`select count(*) as sailings from jsonb_array_elements(
  barkolink_private.execute_flexible_discounts('PassengerSailingBoard','{}','setup-validation','PASSENGER')->'sailings')`, false);
console.log(JSON.stringify({ installed:true, todaysSailings:Number(result.sailings) }));
