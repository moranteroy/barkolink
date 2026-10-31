import fs from 'node:fs';
import {queryLive} from './test-data-database.mjs';
const account="(select uid from public.app_user where lower(email)='carlobiado@barkolink.com' and role='PASSENGER')";
async function main(){
  if(process.argv.includes('--apply')){
    const backup=await queryLive(`select b.id,b.reference,b.created_at from public.booking b where owner_uid=${account} and reference like 'DEMO-CARLO-LOYALTY-%' order by created_at,id`);
    fs.mkdirSync('.audit/presentation-loyalty',{recursive:true});
    fs.writeFileSync(`.audit/presentation-loyalty/reference-map-before-${Date.now()}.json`,JSON.stringify(backup,null,2),{flag:'wx'});
    await queryLive(`begin;set local lock_timeout='10s';set local statement_timeout='30s';
      select pg_advisory_xact_lock(hashtextextended('loyalty:'||${account},0));
      create temporary table original_bookings as select id,to_jsonb(b)-'reference'-'updated_at' data from public.booking b where owner_uid=${account};
      create temporary table original_tickets as select p.id,to_jsonb(p) data from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.owner_uid=${account};
      do $$declare record_to_update record;new_reference text;actor text;count_before integer;
      begin
        select uid into strict actor from public.app_user where uid=${account} for update;
        count_before:=barkolink_private.loyalty_trip_count(actor);
        for record_to_update in select * from public.booking b where owner_uid=actor and reference like 'DEMO-CARLO-LOYALTY-%' order by created_at,id for update loop
          if not exists(select 1 from public.activity_log a where a.entity_id=record_to_update.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED')
            then raise exception 'The booking could not be verified as the requested presentation record.';end if;
          loop
            new_reference:='BKG'||to_char(record_to_update.created_at at time zone 'Asia/Manila','YYYY-MMDD')||lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint)%1000000000000)::text,12,'0');
            exit when not exists(select 1 from public.booking where reference=new_reference);
          end loop;
          update public.booking set reference=new_reference where id=record_to_update.id;
          insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
            values(null,'PRESENTATION_REFERENCE_NORMALIZED','booking',record_to_update.id::text,
              jsonb_build_object('oldReference',record_to_update.reference,'newReference',new_reference,'reason','User requested standard booking references for presentation and report exports'));
        end loop;
        if count_before<>barkolink_private.loyalty_trip_count(actor)
          or exists(select 1 from original_bookings o left join public.booking b using(id) where o.data is distinct from (to_jsonb(b)-'reference'-'updated_at'))
          or exists(select 1 from original_tickets o left join public.booking_passenger p using(id) where o.data is distinct from to_jsonb(p))
          then raise exception 'Booking details, ticket codes or loyalty progress changed; transaction rolled back.';end if;
      end $$;commit;`,false);
  }
  console.log(JSON.stringify(await queryLive(`select count(*) total_bookings,count(*) filter(where reference like 'DEMO-CARLO-LOYALTY-%') old_demo_references,
    count(*) filter(where reference ~ '^BKG[0-9]{4}-[0-9]{16}$') standard_references,
    barkolink_private.loyalty_trip_count(${account}) completed_trips
    from public.booking where owner_uid=${account}`,false)));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
