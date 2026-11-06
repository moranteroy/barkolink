import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
async function main() {
  const installed = async () =>
    (
      await queryLive(
        "select position('This voucher has expired. Choose another voucher.' in pg_get_functiondef('barkolink_private.voucher_quote(jsonb,text)'::regprocedure))>0 installed",
      )
    )[0].installed;
  if (process.argv.includes('--apply') && !(await installed()))
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='30s';${fs.readFileSync('supabase/migrations/058_voucher_availability_errors.sql', 'utf8')}commit;`,
      false,
    );
  if (!(await installed())) throw new Error('Voucher availability update is not installed.');
  await queryLive(
    `begin;set local statement_timeout='15s';
    do $$declare actor text;expired_code text;blocked boolean:=false;
    begin
      select uid into strict actor from public.app_user where lower(email)='carlobiado@barkolink.com';
      perform set_config('request.jwt.claim.sub',actor,true);
      select code into strict expired_code from public.voucher where owner_uid is null and expires_at<=now() order by expires_at limit 1;
      begin
        perform public.barkolink_execute('QuoteVoucher',jsonb_build_object('voucherCode',expired_code));
      exception when others then
        if sqlerrm='This voucher has expired. Choose another voucher.' then blocked:=true;else raise;end if;
      end;
      if not blocked then raise exception 'Expired voucher was not rejected.';end if;
    end $$;rollback;`,
    false,
  );
  console.log(
    'Voucher availability update installed; expired code rejected with the correct message through the passenger RPC.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
