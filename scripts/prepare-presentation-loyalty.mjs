import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const email = 'carlobiado@barkolink.com';
const goldOnly = process.argv.includes('--gold-only');
const lastReward = goldOnly ? 2 : 3;
async function main() {
  const accounts = await queryLive(
    `select uid,email,role from public.app_user where lower(email)='${email}'`,
  );
  if (accounts.length !== 1 || accounts[0].role !== 'PASSENGER')
    throw new Error('The presentation passenger account could not be verified.');
  if (process.argv.includes('--apply')) {
    fs.mkdirSync('.audit/presentation-loyalty', { recursive: true });
    const before = await queryLive(
      `select to_jsonb(v) record from public.voucher v where owner_uid=(select uid from public.app_user where lower(email)='${email}') order by loyalty_reward_number`,
    );
    fs.writeFileSync(
      `.audit/presentation-loyalty/before-${Date.now()}.json`,
      JSON.stringify(before, null, 2),
    );
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='30s';
      do $$declare actor text;config barkolink_private.loyalty_settings;reward integer;created uuid;
      begin
        select uid into strict actor from public.app_user where lower(email)='${email}' and role='PASSENGER' for update;
        perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor,0));
        select * into strict config from barkolink_private.loyalty_settings where code='DEFAULT' for share;
        for reward in 2..${lastReward} loop
          insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active,
            owner_uid,loyalty_reward_number,claimable,title,description,required_trips)
          values(barkolink_private.new_voucher_code(),'FIXED',case when reward=2 then config.gold_reward else config.platinum_reward end,
            0,1,now(),now()+make_interval(days=>config.expiry_days),true,actor,reward,false,
            'Presentation loyalty reward','Personal demo reward prepared for the BarkoLink presentation.',0)
          on conflict(owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id into created;
          if created is not null then
            insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
              values(null,'PRESENTATION_LOYALTY_PREPARED','voucher',created::text,
                jsonb_build_object('reason','Presentation demo reward requested by account operator','loyaltyRewardNumber',reward));
          end if;
        end loop;
        if (select count(*) from public.voucher v where owner_uid=actor and loyalty_reward_number between 2 and ${lastReward} and is_active and starts_at<=now()
            and expires_at>now()+interval '1 day' and not exists(select 1 from public.booking b where b.voucher_id=v.id))<>${lastReward - 1}
          then raise exception 'Presentation rewards are not both available through tomorrow.';end if;
      end $$;commit;`,
      false,
    );
  }
  if (process.argv.includes('--complete-history')) {
    await queryLive(
      `begin;set local lock_timeout='10s';set local statement_timeout='45s';
      create temporary table original_carlo_bookings on commit drop as select b.id,to_jsonb(b) data from public.booking b join public.app_user u on u.uid=b.owner_uid where lower(u.email)='${email}';
      create temporary table original_sailings_guard on commit drop as select md5(jsonb_agg(to_jsonb(s)-'available_seats'-'updated_at' order by code)::text) digest from public.sailing s;
      create temporary table original_inventory on commit drop as select code,available_seats from public.sailing;
      create temporary table prepared_inventory(code text primary key, passengers integer not null) on commit drop;
      do $$declare actor public.app_user;trip public.sailing;current_count integer;target integer;booking_id uuid;next_at timestamptz;next_port uuid;passenger_sex text;counter integer:=0;ref text;
      begin
        select * into strict actor from public.app_user where lower(email)='${email}' and role='PASSENGER' for update;
        perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor.uid,0));
        select trips_per_reward*${lastReward} into strict target from barkolink_private.loyalty_settings where code='DEFAULT';
        select case when count(distinct lower(trim(p.sex)))=1 then min(p.sex) else null end into passenger_sex
          from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.owner_uid=actor.uid
          and lower(trim(p.full_name))=lower(trim(actor.full_name)) and nullif(trim(p.sex),'') is not null;
        current_count:=barkolink_private.loyalty_trip_count(actor.uid);
        for trip in select * from public.sailing s where s.status='COMPLETED' and s.arrival_at<now()
          and not exists(select 1 from public.booking b where b.owner_uid=actor.uid and b.sailing_code=s.code)
          order by departure_at,code loop
          exit when current_count>=target;
          if next_at is not null and (trip.departure_at<next_at or trip.origin_port_id<>next_port) then continue;end if;
          if trip.available_seats<1 then continue;end if;
          if barkolink_private.vessel_departure_issue(trip.vessel_id,trip.origin_port_id,trip.departure_at,trip.code) is not null then continue;end if;
          perform 1 from public.sailing where code=trip.code and available_seats>0 for update;
          if not found then continue;end if;
          counter:=counter+1;ref:='BKG'||to_char((trip.departure_at-interval '1 day') at time zone 'Asia/Manila','YYYY-MMDD')||lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint)%1000000000000)::text,12,'0');
          insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,service_fee,total,
            booking_channel,payment_status,payment_method,paid_at,created_at,updated_at)
          values(ref,actor.uid,trip.code,'CONFIRMED',1,trip.regular_fare,0,trip.regular_fare,
            'WALK_IN','PAID','CASH',trip.departure_at-interval '12 hours',trip.departure_at-interval '1 day',trip.arrival_at)
          returning id into booking_id;
          update public.sailing set available_seats=available_seats-1,updated_at=now() where code=trip.code;
          insert into prepared_inventory values(trip.code,1) on conflict(code) do update set passengers=prepared_inventory.passengers+1;
          insert into public.booking_passenger(booking_id,full_name,passenger_type,sex,phone,nationality,fare,ticket_status,
            issued_at,checked_in_at,boarded_at,created_at)
          values(booking_id,actor.full_name,'REGULAR',passenger_sex,actor.phone,'Filipino',trip.regular_fare,'BOARDED',
            trip.departure_at-interval '12 hours',trip.departure_at-interval '45 minutes',trip.departure_at-interval '15 minutes',trip.departure_at-interval '1 day');
          insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
            values(null,'PRESENTATION_LOYALTY_HISTORY_PREPARED','booking',booking_id::text,
              jsonb_build_object('reason','Demo completed journey for the requested Carlo presentation','demo',true));
          current_count:=barkolink_private.loyalty_trip_count(actor.uid);
          next_at:=trip.arrival_at+interval '30 minutes';next_port:=trip.destination_port_id;
        end loop;
        if current_count<target then raise exception 'Not enough historical trips for coherent presentation history; rolled back.';end if;
        if exists(select 1 from original_carlo_bookings o left join public.booking b using(id) where o.data is distinct from to_jsonb(b))
          or (select digest from original_sailings_guard) is distinct from (select md5(jsonb_agg(to_jsonb(s)-'available_seats'-'updated_at' order by code)::text) from public.sailing s)
          or exists(select 1 from original_inventory o join public.sailing s using(code) left join prepared_inventory p using(code)
            where s.available_seats<>o.available_seats-coalesce(p.passengers,0))
        then raise exception 'Existing booking or sailing changed; rolled back.';end if;
      end $$;commit;`,
      false,
    );
  }
  const visible = await queryLive(
    `with actor as(select uid from public.app_user where lower(email)='${email}'),
    wallet as materialized(select barkolink_private.camel(barkolink_private.execute_flexible_discounts('MyLoyalty','{}',uid,'PASSENGER')) data from actor)
    select data->>'completedTrips' completed_trips,data->>'currentTier' current_tier,data->>'tripsToNextReward' trips_to_next_reward,data->'tiers' milestones,
      (select jsonb_agg(v-'code') from jsonb_array_elements(data->'vouchers') v) available_rewards from wallet`,
    false,
  );
  console.log(JSON.stringify({ email, ...visible[0] }));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
