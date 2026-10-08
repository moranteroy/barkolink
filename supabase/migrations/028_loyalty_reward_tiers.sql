create function barkolink_private.loyalty_reward_value(reward_number integer) returns integer
language sql immutable set search_path='' as $$ select least(300,greatest(1,reward_number)*100); $$;

create or replace function barkolink_private.issue_loyalty_vouchers(actor text) returns void language plpgsql set search_path='' as $$
declare earned integer; reward integer; created_id uuid; amount integer;
begin
  if not exists(select 1 from auth.users where id::text=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor,0));
  earned:=barkolink_private.loyalty_trip_count(actor)/5;
  for reward in 1..earned loop
    created_id:=null;amount:=barkolink_private.loyalty_reward_value(reward);
    insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active,owner_uid,loyalty_reward_number)
    values('LOYAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),'FIXED',amount,0,1,now(),now()+interval '90 days',true,actor,reward)
    on conflict (owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id into created_id;
    if created_id is not null then
      insert into public.notification(owner_uid,title,message,category) values(actor,'Your loyalty voucher is ready',
        'You earned PHP '||amount||' off regular fares after '||(reward*5)||' completed, paid trips. Your personal voucher applies automatically to your next eligible booking and is valid for 90 days.','PROMO');
    end if;
  end loop;
end $$;

-- Upgrade unspent, unexpired rewards while preserving codes, expiry and existing booking totals.
with upgraded as (
  update public.voucher v set value=barkolink_private.loyalty_reward_value(v.loyalty_reward_number)
  where v.owner_uid is not null and v.expires_at>now()
    and v.value<barkolink_private.loyalty_reward_value(v.loyalty_reward_number)
    and not exists(select 1 from public.booking b where b.voucher_id=v.id)
  returning v.owner_uid,v.value
)
insert into public.notification(owner_uid,title,message,category)
select owner_uid,'Your loyalty reward just got bigger','Your unused loyalty voucher has been upgraded to PHP '||value||' off regular fares. Your existing expiry date still applies.','PROMO' from upgraded;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v27;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; completed integer;
begin
  result:=barkolink_private.execute_flexible_discounts_v27(operation,args,actor_uid,actor_role);
  if operation='MyLoyalty' then
    completed:=(result->>'completed_trips')::integer;
    return result||jsonb_build_object(
      'reward_value',barkolink_private.loyalty_reward_value(completed/5+1),
      'current_tier',case when completed>=15 then 'Platinum' when completed>=10 then 'Gold' when completed>=5 then 'Silver' else 'Getting started' end,
      'tiers',jsonb_build_array(jsonb_build_object('name','Silver','trips',5,'value',100),jsonb_build_object('name','Gold','trips',10,'value',200),jsonb_build_object('name','Platinum','trips',15,'value',300)));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
