import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
async function main() {
  const installed = async () => (await queryLive("select to_regclass('public.voucher_claim') is not null installed"))[0].installed;
  if (process.argv.includes('--apply') && !await installed()) {
    await queryLive(`begin; set local lock_timeout='10s'; set local statement_timeout='45s';
      select pg_advisory_xact_lock(hashtext('barkolink-claimable-vouchers-056'));
      lock table public.voucher,public.booking in share row exclusive mode;
      ${fs.readFileSync('supabase/migrations/056_claimable_vouchers.sql','utf8')}
      commit;`,false);
  }
  if (!await installed()) { console.log(JSON.stringify({installed:false})); return; }
  const state=(await queryLive(`select
    (select count(*) from public.voucher where claimable and owner_uid is null and is_active and starts_at<=now() and expires_at>now()) public_promos,
    (select count(*) from public.voucher_claim) claims,
    has_table_privilege('authenticated','public.voucher_claim','SELECT') browser_read,
    has_table_privilege('authenticated','public.voucher_claim','INSERT') browser_write,
    has_function_privilege('anon','barkolink_private.voucher_allocations(uuid)','EXECUTE') anonymous_helper,
    exists(select 1 from public.voucher where claimable and owner_uid is not null) private_exposed`))[0];
  if(state.browser_read || state.browser_write || state.anonymous_helper || state.private_exposed)throw new Error('Claim voucher permission verification failed.');
  const probe=(await queryLive(`with actor as (select uid from public.app_user where role='PASSENGER' order by uid limit 1),
    wallet as materialized (select barkolink_private.camel(barkolink_private.execute_claim_vouchers('PassengerVouchers','{}',uid,'PASSENGER')) data from actor)
    select jsonb_typeof(data->'vouchers')='array' valid_wallet,
      data ? 'completedTrips' mission_progress,
      not exists(select 1 from jsonb_array_elements(data->'vouchers') v where v->>'code' is not null and v->>'claimedAt' is null) unclaimed_codes_hidden
    from wallet`,false))[0];
  if(probe && Object.values(probe).some(v=>!v))throw new Error('Passenger wallet verification failed.');
  console.log(JSON.stringify({installed:true,...state,wallet:probe || 'No passenger account to inspect'}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
