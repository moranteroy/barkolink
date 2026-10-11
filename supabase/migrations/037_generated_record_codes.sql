-- Generate codes for new vouchers only. Existing references and QR tokens stay unchanged.
create function barkolink_private.new_voucher_code() returns text language plpgsql set search_path='' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; token text; sample integer;
begin
  loop
    token := '';
    for i in 1..16 loop
      sample := get_byte(decode(substr(replace(gen_random_uuid()::text,'-',''),1,2),'hex'),0);
      token := token || substr(alphabet, (sample % 32) + 1, 1);
    end loop;
    exit when token ~ '[A-Z]' and token ~ '[0-9]';
  end loop;
  return 'VCH-' || token;
end $$;
revoke all on function barkolink_private.new_voucher_code() from public,anon,authenticated;

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
    values(barkolink_private.new_voucher_code(),'FIXED',amount,0,1,now(),now()+make_interval(days=>config.expiry_days),true,actor,reward)
    on conflict (owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id into created_id;
    if created_id is not null then
      insert into public.notification(owner_uid,title,message,category) values(actor,'Your loyalty voucher is ready',
        'You earned PHP '||amount||' off regular fares after '||(reward*config.trips_per_reward)||' completed, paid trips. Your personal voucher applies automatically to your next eligible booking and is valid for '||config.expiry_days||' days.','PROMO');
    end if;
  end loop;
end $$;
