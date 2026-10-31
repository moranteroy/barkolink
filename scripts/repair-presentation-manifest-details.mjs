import fs from 'node:fs';
import {queryLive} from './test-data-database.mjs';
async function main(){
  if(process.argv.includes('--apply')){
    const snapshot=await queryLive(`select p.id,p.sex,p.booking_id from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.app_user u on u.uid=b.owner_uid where lower(u.email)='carlobiado@barkolink.com' and lower(trim(p.full_name))=lower(trim(u.full_name))`);
    fs.mkdirSync('.audit/presentation-loyalty',{recursive:true});
    fs.writeFileSync(`.audit/presentation-loyalty/before-manifest-sex-${Date.now()}.json`,JSON.stringify(snapshot,null,2),{flag:'wx'});
    await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='30s';
      do $$declare actor public.app_user;source_sex text;variants integer;changed integer;
      begin
        select * into strict actor from public.app_user where lower(email)='carlobiado@barkolink.com' and role='PASSENGER' for update;
        select count(distinct lower(trim(p.sex))),min(trim(p.sex)) into variants,source_sex
          from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.owner_uid=actor.uid
          and lower(trim(p.full_name))=lower(trim(actor.full_name)) and nullif(trim(p.sex),'') is not null;
        if variants<>1 then raise exception 'A single verified passenger sex was not found.';end if;
        update public.booking_passenger p set sex=source_sex from public.booking b
          where p.booking_id=b.id and b.owner_uid=actor.uid and nullif(trim(p.sex),'') is null
          and lower(trim(p.full_name))=lower(trim(actor.full_name))
          and exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED');
        get diagnostics changed=row_count;
        insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
          values(null,'PRESENTATION_MANIFEST_DETAILS_REPAIRED','app_user',actor.uid,jsonb_build_object('updatedPassengers',changed,'source','Existing non-empty passenger records for the same account and passenger name','field','sex'));
      end $$;commit;`,false);
  }
  console.log(JSON.stringify(await queryLive(`select p.sex,count(*) passengers,count(*) filter(where p.sex is null or trim(p.sex)='') missing_sex from public.booking_passenger p join public.booking b on b.id=p.booking_id join public.app_user u on u.uid=b.owner_uid where lower(u.email)='carlobiado@barkolink.com' and lower(trim(p.full_name))=lower(trim(u.full_name)) group by p.sex`)));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
