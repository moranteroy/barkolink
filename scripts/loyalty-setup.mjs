import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const [state]=await queryLive("select to_regprocedure('barkolink_private.execute_flexible_discounts_v26(text,jsonb,text,text)') is not null as installed");
if(!state.installed)await queryLive(`begin; select pg_advisory_xact_lock(hashtext('barkolink-loyalty-027')); ${fs.readFileSync('supabase/migrations/027_loyalty_vouchers.sql','utf8')} commit;`,false);
const [tiers]=await queryLive("select to_regprocedure('barkolink_private.loyalty_reward_value(integer)') is not null as installed");
if(!tiers.installed)await queryLive(`begin; select pg_advisory_xact_lock(hashtext('barkolink-loyalty-028')); ${fs.readFileSync('supabase/migrations/028_loyalty_reward_tiers.sql','utf8')} commit;`,false);
await queryLive(`do $$ declare actor text; begin
  for actor in select distinct b.owner_uid from public.booking b join public.sailing s on s.code=b.sailing_code
    where b.status='CONFIRMED' and b.payment_status='PAID' and s.status='COMPLETED'
  loop perform barkolink_private.issue_loyalty_vouchers(actor); end loop;
end $$;`,false);
const [result]=await queryLive("select count(*) as rewards from public.voucher where owner_uid is not null");
console.log(JSON.stringify({installed:true,issuedLoyaltyRewards:Number(result.rewards)}));
