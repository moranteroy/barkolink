import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const state=(await queryLive("select to_regclass('public.voucher') is not null as installed"))[0];
const migration=fs.readFileSync('supabase/migrations/025_booking_vouchers.sql','utf8');
const wrapper=migration.slice(migration.indexOf('create function barkolink_private.execute_flexible_discounts(')).replace('create function','create or replace function');
await queryLive(`begin; select pg_advisory_xact_lock(hashtext('barkolink-vouchers-025')); ${state.installed?wrapper:migration} commit;`,false);
const verification=await queryLive(`select jsonb_array_length(barkolink_private.execute_flexible_discounts('AdminVouchers','{}',
  (select id::text from auth.users where raw_app_meta_data->>'role'='ADMIN' limit 1),'ADMIN')->'vouchers') as count`,false);
console.log(JSON.stringify({installed:true,listVerified:true,voucherCount:verification[0].count,message:'Voucher integration is ready. Create promo codes from Admin > Vouchers.'}));
