import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
async function main() {
  if (process.argv.includes('--apply'))
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='30s';
    ${fs.readFileSync('supabase/migrations/059_loyalty_voucher_code_notifications.sql', 'utf8')}
    insert into public.notification(owner_uid,title,message,category)
      select v.owner_uid,'Your loyalty voucher is ready','Voucher code: '||v.code||'. Your PHP '||v.value||' personal loyalty reward is ready. It applies automatically at booking review, or you can copy the code from Home > Loyalty rewards. Valid until '||to_char(v.expires_at at time zone 'Asia/Manila','Mon DD, YYYY')||' (PH).','PROMO'
      from public.voucher v join public.app_user u on u.uid=v.owner_uid
      where lower(u.email)='carlobiado@barkolink.com' and v.loyalty_reward_number=2 and v.is_active and v.expires_at>now()
        and not exists(select 1 from public.booking b where b.voucher_id=v.id)
        and not exists(select 1 from public.notification n where n.owner_uid=v.owner_uid and position(v.code in n.message)>0);
    commit;`,
      false,
    );
  console.log(
    JSON.stringify(
      await queryLive(`select v.value,v.expires_at,
    exists(select 1 from public.notification n where n.owner_uid=v.owner_uid and position(v.code in n.message)>0) notification_has_code,
    exists(select 1 from public.notification n where n.owner_uid=v.owner_uid and position(v.code in n.message)>0 and n.read_at is null) unread
    from public.voucher v join public.app_user u on u.uid=v.owner_uid where lower(u.email)='carlobiado@barkolink.com' and v.loyalty_reward_number=2`),
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
