import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const installed = (await queryLive("select to_regprocedure('barkolink_private.new_voucher_code()') is not null as installed"))[0].installed;
if (installed) { console.log('Voucher code generator is already installed.'); process.exit(0); }
if (!process.argv.includes('--apply')) { console.log('Voucher code generator is ready to install.'); process.exit(0); }
const migration = fs.readFileSync('supabase/migrations/037_generated_record_codes.sql', 'utf8');
await queryLive(`begin;
set local lock_timeout='10s';
set local statement_timeout='30s';
lock table public.booking,public.booking_passenger,public.voucher in share row exclusive mode;
create temporary table code_history_guard as select md5(jsonb_build_object(
  'bookings',(select jsonb_agg(to_jsonb(b) order by id) from public.booking b),
  'tickets',(select jsonb_agg(to_jsonb(p) order by id) from public.booking_passenger p),
  'vouchers',(select jsonb_agg(to_jsonb(v) order by id) from public.voucher v))::text) as fingerprint;
${migration}
do $$ declare after_value text; begin
select md5(jsonb_build_object(
  'bookings',(select jsonb_agg(to_jsonb(b) order by id) from public.booking b),
  'tickets',(select jsonb_agg(to_jsonb(p) order by id) from public.booking_passenger p),
  'vouchers',(select jsonb_agg(to_jsonb(v) order by id) from public.voucher v))::text) into after_value;
if after_value is distinct from (select fingerprint from code_history_guard) then
  raise exception 'Existing bookings, vouchers or QR tokens changed; installation rolled back.';
end if;
end $$;
drop table code_history_guard;
commit;`, false);
console.log('Installed voucher generator. Existing bookings, vouchers and QR tokens are unchanged.');
