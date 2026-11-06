import fs from 'node:fs';
import { queryLive, projectRef, usersExpression } from './test-data-database.mjs';

async function main() {
  const migration = 'supabase/migrations/053_shared_trp_codes.sql';
  const before = (
    await queryLive(`select
    to_regclass('barkolink_private.trip_code_serial') is not null installed,
    (select coalesce(jsonb_agg(to_jsonb(s) order by code),'[]') from public.sailing s where code like 'DLY%') trips,
    pg_get_functiondef('barkolink_private.generate_daily_trips()'::regprocedure) generator,
    pg_get_functiondef('barkolink_private.next_trip_code()'::regprocedure) preview,
    pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure) manual`)
  )[0];
  console.log(
    JSON.stringify({
      projectRef,
      migration,
      installed: before.installed,
      existingDailyTrips: before.trips.length,
    }),
  );
  if (!process.argv.includes('--apply')) return;
  if (before.installed)
    throw new Error('TRP allocation is already installed. Inspect the saved rollout receipt.');
  fs.mkdirSync('.backups', { recursive: true });
  const backupPath = `.backups/before-daily-trp-codes-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ projectRef, ...before }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const fingerprint = `select md5(jsonb_build_object(
    'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.booking b),
    'passengers',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.booking_passenger p),
    'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.online_payment p),
    'users',${usersExpression})::text) fingerprint`;
  const result = await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='60s';
    select pg_advisory_xact_lock(hashtext('barkolink-generate-daily-trips'));
    lock table public.sailing,public.booking,public.booking_passenger,public.online_payment,public.travel_advisory,
      public.notification_campaign,public.app_user,auth.users in share row exclusive mode;
    do $guard$ begin
      if exists(select 1 from public.sailing s where s.code like 'DLY%' and (
        exists(select 1 from public.booking b where b.sailing_code=s.code) or
        exists(select 1 from public.travel_advisory a where a.sailing_code=s.code) or
        exists(select 1 from public.notification_campaign n where n.sailing_code=s.code))) then
        raise exception 'Daily trips have linked records; code rename was not applied.';
      end if;
    end $guard$;
    create temporary table trp_original_sailings as select code,to_jsonb(s)-'code' payload from public.sailing s;
    create temporary table trp_data_guard as ${fingerprint};
    ${fs.readFileSync(migration, 'utf8')}
    create temporary table renamed_daily_codes(old_code text primary key,new_code text unique);
    do $rename$ declare trip record;replacement text;begin
      for trip in select code from public.sailing where code like 'DLY%' order by departure_at,code loop
        replacement:=barkolink_private.allocate_trip_code();
        update public.sailing set code=replacement where code=trip.code;
        insert into renamed_daily_codes values(trip.code,replacement);
        insert into public.activity_log(action,entity_type,entity_id,details)
          values('UPDATE','sailing',replacement,jsonb_build_object('code',jsonb_build_object('before',trip.code,'after',replacement)));
      end loop;
    end $rename$;
    do $guard$ declare original text;current_value text;begin
      select fingerprint into original from trp_data_guard;
      ${fingerprint.replace(' fingerprint', ' into current_value')};
      if original is distinct from current_value then raise exception 'Passenger or payment data changed; rollback.';end if;
      if exists(select 1 from trp_original_sailings o left join renamed_daily_codes m on m.old_code=o.code
        left join public.sailing s on s.code=coalesce(m.new_code,o.code) where s.code is null or to_jsonb(s)-'code' is distinct from o.payload) then
        raise exception 'Trip fields changed beyond the code; rollback.';
      end if;
      if exists(select 1 from public.sailing where code like 'DLY%') then raise exception 'Some DLY codes remain; rollback.';end if;
    end $guard$;
    select jsonb_build_object('renamed',(select count(*) from renamed_daily_codes),'mapping',(select jsonb_agg(to_jsonb(m) order by new_code) from renamed_daily_codes m)) result;
    notify pgrst,'reload schema';commit;`,
    false,
  );
  fs.mkdirSync('.audit', { recursive: true });
  fs.writeFileSync(
    '.audit/daily-trp-codes-applied.json',
    JSON.stringify({ projectRef, backupPath, result }, null, 2),
  );
  console.log(
    JSON.stringify({
      renamed: result[0]?.result?.renamed,
      backupPath,
      existingTripFieldsPreserved: true,
      passengerPaymentRecordsPreserved: true,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
