import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const actor =
  "(select uid from public.app_user where lower(email)='carlobiado@barkolink.com' and role='PASSENGER')";
async function main() {
  if (process.argv.includes('--apply')) {
    const before = await queryLive(`select jsonb_build_object(
      'bookings',(select jsonb_agg(to_jsonb(b)) from public.booking b where owner_uid=${actor} and exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED')),
      'passengers',(select jsonb_agg(to_jsonb(p)) from public.booking_passenger p join public.booking b on b.id=p.booking_id where owner_uid=${actor} and exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED')),
      'rewards',(select jsonb_agg(to_jsonb(v)) from public.voucher v where owner_uid=${actor})) snapshot`);
    fs.mkdirSync('.audit/presentation-loyalty', { recursive: true });
    fs.writeFileSync(
      `.audit/presentation-loyalty/before-silver-only-${Date.now()}.json`,
      JSON.stringify(before, null, 2),
      { flag: 'wx' },
    );
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='30s';
      select pg_advisory_xact_lock(hashtextextended('loyalty:'||${actor},0));
      create temporary table original_carlo_history as select b.id,to_jsonb(b) data from public.booking b where owner_uid=${actor} and not exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED');
      create temporary table trim_demo_bookings as select id from (
        select b.id,row_number() over(order by s.departure_at,b.reference) position from public.booking b join public.sailing s on s.code=b.sailing_code
        where owner_uid=${actor} and exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED')) d where position>5;
      create temporary table trim_demo_rewards as select id from public.voucher where owner_uid=${actor} and loyalty_reward_number in(2,3)
        and title='Presentation loyalty reward' and description='Personal demo reward prepared for the BarkoLink presentation.';
      do $$begin
        if exists(select 1 from trim_demo_bookings t join public.booking b using(id) where b.voucher_id is not null
          or not exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED'))
          or exists(select 1 from public.online_payment p join trim_demo_bookings t on t.id=p.booking_id)
          or exists(select 1 from public.boarding_event e join public.booking_passenger p on p.id=e.passenger_id join trim_demo_bookings t on t.id=p.booking_id)
          or exists(select 1 from public.booking b join trim_demo_rewards r on r.id=b.voucher_id)
          or exists(select 1 from public.voucher_claim c join trim_demo_rewards r on r.id=c.voucher_id)
        then raise exception 'Demo records were used or changed; removal rolled back.';end if;
      end $$;
      delete from public.booking_passenger p using trim_demo_bookings t where p.booking_id=t.id;
      delete from public.booking b using trim_demo_bookings t where b.id=t.id;
      delete from public.voucher v using trim_demo_rewards t where v.id=t.id;
      do $$begin
        if barkolink_private.loyalty_trip_count(${actor})<>5 then raise exception 'Expected exactly five completed trips; rolled back.';end if;
        if exists(select 1 from original_carlo_history o left join public.booking b using(id) where o.data is distinct from to_jsonb(b))
          then raise exception 'Original booking history changed; rolled back.';end if;
        insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
          values(null,'PRESENTATION_LOYALTY_SIMPLIFIED','app_user',${actor},jsonb_build_object('completedDemoTrips',5,'tier','Silver','reason','User requested only the five-trip loyalty presentation'));
      end $$;commit;`,
      false,
    );
  }
  console.log(
    JSON.stringify(
      await queryLive(
        `with wallet as materialized(select barkolink_private.camel(barkolink_private.execute_flexible_discounts('MyLoyalty','{}',${actor},'PASSENGER')) data)
    select data->>'completedTrips' completed_trips,data->>'currentTier' tier,data->>'tripsToNextReward' trips_to_next_reward,
      jsonb_array_length(data->'vouchers') available_rewards,
      (select jsonb_agg(jsonb_build_object('reward',v.loyalty_reward_number,'value',v.value,'used',exists(select 1 from public.booking b where b.voucher_id=v.id))) from public.voucher v where owner_uid=${actor}) rewards from wallet`,
        false,
      ),
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
