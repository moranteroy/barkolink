create table barkolink_private.loyalty_settings (
  code text primary key check (code='DEFAULT'),
  trips_per_reward integer not null check (trips_per_reward between 1 and 1000),
  silver_reward integer not null check (silver_reward between 1 and 1000000),
  gold_reward integer not null check (gold_reward between silver_reward and 1000000),
  platinum_reward integer not null check (platinum_reward between gold_reward and 1000000),
  expiry_days integer not null check (expiry_days between 1 and 3650)
);
insert into barkolink_private.loyalty_settings values ('DEFAULT',5,100,200,300,90);
revoke all on barkolink_private.loyalty_settings from public,anon,authenticated;

create or replace function barkolink_private.loyalty_reward_value(reward_number integer) returns integer
language sql stable set search_path='' as $$
  select case when reward_number<=1 then silver_reward when reward_number=2 then gold_reward else platinum_reward end
  from barkolink_private.loyalty_settings where code='DEFAULT';
$$;

create or replace function barkolink_private.issue_loyalty_vouchers(actor text) returns void language plpgsql set search_path='' as $$
declare earned integer; reward integer; created_id uuid; amount integer; config barkolink_private.loyalty_settings;
begin
  if not exists(select 1 from auth.users where id::text=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor,0));
  select * into config from barkolink_private.loyalty_settings where code='DEFAULT' for share;
  earned:=barkolink_private.loyalty_trip_count(actor)/config.trips_per_reward;
  for reward in 1..earned loop
    created_id:=null; amount:=case when reward=1 then config.silver_reward when reward=2 then config.gold_reward else config.platinum_reward end;
    insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active,owner_uid,loyalty_reward_number)
    values('LOYAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),'FIXED',amount,0,1,now(),now()+make_interval(days=>config.expiry_days),true,actor,reward)
    on conflict (owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id into created_id;
    if created_id is not null then
      insert into public.notification(owner_uid,title,message,category) values(actor,'Your loyalty voucher is ready',
        'You earned PHP '||amount||' off regular fares after '||(reward*config.trips_per_reward)||' completed, paid trips. Your personal voucher applies automatically to your next eligible booking and is valid for '||config.expiry_days||' days.','PROMO');
    end if;
  end loop;
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v30;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare config barkolink_private.loyalty_settings; result jsonb; completed integer; cycle integer;
begin
  if operation in ('AdminLoyaltySettings','AdminSaveLoyaltySettings') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminSaveLoyaltySettings' then
      update barkolink_private.loyalty_settings set trips_per_reward=(args->>'tripsPerReward')::integer,
        silver_reward=(args->>'silverReward')::integer,gold_reward=(args->>'goldReward')::integer,
        platinum_reward=(args->>'platinumReward')::integer,expiry_days=(args->>'expiryDays')::integer where code='DEFAULT';
    end if;
    select * into config from barkolink_private.loyalty_settings where code='DEFAULT';
    return jsonb_build_object('settings',to_jsonb(config)-'code');
  end if;
  result:=barkolink_private.execute_flexible_discounts_v30(operation,args,actor_uid,actor_role);
  if operation='MyLoyalty' then
    select * into config from barkolink_private.loyalty_settings where code='DEFAULT';
    completed:=(result->>'completed_trips')::integer; cycle:=config.trips_per_reward;
    return result||jsonb_build_object('trips_per_reward',cycle,'reward_value',barkolink_private.loyalty_reward_value(completed/cycle+1),
      'trips_to_next_reward',cycle-(completed%cycle),'expiry_days',config.expiry_days,
      'current_tier',case when completed>=cycle*3 then 'Platinum' when completed>=cycle*2 then 'Gold' when completed>=cycle then 'Silver' else 'Getting started' end,
      'tiers',jsonb_build_array(jsonb_build_object('name','Silver','trips',cycle,'value',config.silver_reward),
        jsonb_build_object('name','Gold','trips',cycle*2,'value',config.gold_reward),jsonb_build_object('name','Platinum','trips',cycle*3,'value',config.platinum_reward)));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
