import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
async function main(){
  const installed=async()=>(await queryLive("select to_regprocedure('barkolink_private.update_voucher_details(jsonb,text,text)') is not null installed"))[0].installed;
  if(process.argv.includes('--apply') && !await installed()){
    await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='45s';
      select pg_advisory_xact_lock(hashtext('barkolink-voucher-details-057'));
      lock public.voucher,public.voucher_claim in share row exclusive mode;
      create temporary table voucher_terms_before as select id,to_jsonb(v)-'title'-'description'-'required_trips' terms from public.voucher v;
      create temporary table voucher_claims_before as select * from public.voucher_claim;
      ${fs.readFileSync('supabase/migrations/057_edit_voucher_details.sql','utf8')}
      ${fs.readFileSync('supabase/voucher-promo-details.sql','utf8')}
      do $$begin
        if exists(select 1 from public.voucher v full join voucher_terms_before b using(id) where b.terms is distinct from (to_jsonb(v)-'title'-'description'-'required_trips'))
          or exists((select * from public.voucher_claim except select * from voucher_claims_before) union all (select * from voucher_claims_before except select * from public.voucher_claim))
        then raise exception 'Voucher terms or claims changed unexpectedly.';end if;
      end $$;
      commit;`,false);
  }
  if(!await installed()){console.log(JSON.stringify({installed:false}));return;}
  if(process.argv.includes('--verify')){
    await queryLive(`begin;set local statement_timeout='15s';
      do $$declare actor text;offer public.voucher;claimed public.voucher;args jsonb;blocked boolean:=false;
      begin
        select uid into strict actor from public.app_user where role='ADMIN' order by uid limit 1;
        perform set_config('request.jwt.claim.sub',actor,true);
        perform set_config('request.jwt.claims','{"aal":"aal2"}',true);
        select * into strict offer from public.voucher v where owner_uid is null and claimable and barkolink_private.voucher_allocations(v.id)=0 order by id limit 1 for update;
        args:=jsonb_build_object('id',offer.id,'title',offer.title,'description',offer.description,'requiredTrips',2,'usageLimit',offer.usage_limit);
        perform public.barkolink_execute('AdminUpdateVoucherDetails',args);
        if (select required_trips from public.voucher where id=offer.id)<>2 then raise exception 'Mission edit verification failed.';end if;
        perform public.barkolink_execute('AdminUpdateVoucherDetails',args||jsonb_build_object('requiredTrips',0));
        select * into claimed from public.voucher v where owner_uid is null and barkolink_private.voucher_allocations(v.id)>0 order by id limit 1 for update;
        if found then
          begin
            perform public.barkolink_execute('AdminUpdateVoucherDetails',jsonb_build_object('id',claimed.id,'title',claimed.title,'description',claimed.description,'requiredTrips',claimed.required_trips+1,'usageLimit',claimed.usage_limit));
          exception when others then
            if position('mission cannot change' in sqlerrm)>0 then blocked:=true;else raise;end if;
          end;
          if not blocked then raise exception 'Claimed mission lock verification failed.';end if;
        end if;
      end $$;rollback;`,false);
    console.log('Native PostgreSQL RPC checks passed; test edits rolled back.');
  }
  console.log(JSON.stringify({installed:true,promos:await queryLive(`select title,required_trips,usage_limit,is_active,
    (select count(*) from public.voucher_claim c where c.voucher_id=v.id) claimed,
    (select count(*) from public.booking b where b.voucher_id=v.id) used
    from public.voucher v where owner_uid is null order by title,id`)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
