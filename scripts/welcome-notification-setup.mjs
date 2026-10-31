import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';

const migration = 'supabase/migrations/055_automatic_welcome_notification.sql';
const installed = async () => (await queryLive("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_campaign' and column_name='is_welcome') installed"))[0].installed;
if (process.argv.includes('--apply') && !await installed()) {
  await queryLive(`begin;
    set local lock_timeout='10s';
    set local statement_timeout='45s';
    select pg_advisory_xact_lock(hashtext('barkolink-welcome-055'));
    ${fs.readFileSync(migration, 'utf8')}
    commit;`, false);
}
if (!await installed()) {
  console.log(JSON.stringify({ installed: false, welcome: await queryLive(`select id,title,audience,recipient_count,
    (select count(*) from public.notification n where n.campaign_id=c.id) delivered,
    (select count(*) from public.app_user where role in ('PASSENGER','TICKETING','BOARDING','ADMIN')) accounts
    from public.notification_campaign c where title='Welcome aboard BarkoLink'`) }));
} else {
  const state = await queryLive(`select c.title,c.recipient_count,
    (select count(*) from public.notification where campaign_id=c.id) delivered,
    (select count(*) from public.app_user u where u.role in ('PASSENGER','TICKETING','BOARDING','ADMIN') and not exists(select 1 from public.notification n where n.campaign_id=c.id and n.owner_uid=u.uid)) missing,
    (select count(*) from (select owner_uid from public.notification where campaign_id=c.id group by owner_uid having count(*)>1) duplicates) duplicates
    from public.notification_campaign c where c.is_welcome`);
  console.log(JSON.stringify({ installed: true, welcome: state }));
  if (process.argv.includes('--apply') && (state.length !== 1 || state.some(s => Number(s.missing) || Number(s.duplicates) || Number(s.recipient_count) !== Number(s.delivered)))) throw new Error('Welcome notification verification failed.');
}
