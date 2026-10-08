alter table public.voucher add column owner_uid text references public.app_user(uid);
alter table public.voucher add column loyalty_reward_number integer;
alter table public.voucher add constraint loyalty_voucher_owner check (
  (owner_uid is null and loyalty_reward_number is null) or (owner_uid is not null and loyalty_reward_number>0));
create unique index voucher_loyalty_reward_once on public.voucher(owner_uid,loyalty_reward_number) where owner_uid is not null;

create function barkolink_private.loyalty_trip_count(actor text) returns integer language sql set search_path='' as $$
  select count(distinct b.sailing_code)::integer from public.booking b join public.sailing s on s.code=b.sailing_code
  where b.owner_uid=actor and b.status='CONFIRMED' and b.payment_status='PAID' and s.status='COMPLETED'
    and exists(select 1 from public.booking_passenger p where p.booking_id=b.id and p.ticket_status='BOARDED');
$$;
create function barkolink_private.issue_loyalty_vouchers(actor text) returns void language plpgsql set search_path='' as $$
declare earned integer; reward integer; created_id uuid;
begin
  if not exists(select 1 from auth.users where id::text=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor,0));
  earned:=barkolink_private.loyalty_trip_count(actor)/5;
  for reward in 1..earned loop
    created_id:=null;
    insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active,owner_uid,loyalty_reward_number)
    values('LOYAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),'FIXED',50,0,1,now(),now()+interval '90 days',true,actor,reward)
    on conflict (owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id into created_id;
    if created_id is not null then
      insert into public.notification(owner_uid,title,message,category) values(actor,'Your loyalty voucher is ready',
        'You earned PHP 50 off regular fares after 5 completed, paid trips. Your personal voucher applies automatically to your next eligible booking and is valid for 90 days.','PROMO');
    end if;
  end loop;
end $$;

alter function barkolink_private.voucher_quote(jsonb,text) rename to voucher_quote_v25;
create function barkolink_private.voucher_quote(args jsonb,actor text) returns jsonb language plpgsql set search_path='' as $$
declare voucher_owner text;
begin
  select owner_uid into voucher_owner from public.voucher where code=upper(trim(args->>'voucherCode'));
  if voucher_owner is not null and voucher_owner is distinct from actor then raise exception 'This loyalty voucher belongs to another passenger.' using errcode='42501'; end if;
  return barkolink_private.voucher_quote_v25(args,actor);
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v26;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; completed integer; v public.voucher; quote jsonb; passenger_owner text;
begin
  if operation in ('MyLoyalty','QuoteLoyaltyVoucher') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'PASSENGER' then raise exception 'Passenger access required.' using errcode='42501'; end if;
    perform barkolink_private.issue_loyalty_vouchers(actor_uid);
    if operation='MyLoyalty' then
      completed:=barkolink_private.loyalty_trip_count(actor_uid);
      return jsonb_build_object('completed_trips',completed,'trips_per_reward',5,'reward_value',50,'trips_to_next_reward',5-(completed%5),
        'vouchers',(select coalesce(jsonb_agg(jsonb_build_object('code',offer.code,'value',offer.value,'expires_at',offer.expires_at) order by offer.expires_at),'[]')
          from public.voucher offer where offer.owner_uid=actor_uid and offer.is_active and offer.starts_at<=now() and offer.expires_at>now()
            and not exists(select 1 from public.booking b where b.voucher_id=offer.id)));
    end if;
    -- Voucher restrictions match regular promo codes; student/senior-only bookings keep the reward for a later booking.
    for v in select * from public.voucher offer where offer.owner_uid=actor_uid and offer.is_active and offer.starts_at<=now() and offer.expires_at>now()
      and not exists(select 1 from public.booking b where b.voucher_id=offer.id) order by offer.expires_at,offer.loyalty_reward_number
    loop
      begin
        quote:=barkolink_private.voucher_quote(args||jsonb_build_object('voucherCode',v.code),actor_uid);
        return jsonb_build_object('quote',quote);
      exception when raise_exception then
        -- No eligible regular fare (or the sailing is unavailable): leave the reward unused.
        return jsonb_build_object('quote',null);
      end;
    end loop;
    return jsonb_build_object('quote',null);
  end if;
  result:=barkolink_private.execute_flexible_discounts_v26(operation,args,actor_uid,actor_role);
  if operation='AdminUpdateSailingStatus' and args->>'status'='COMPLETED' then
    for passenger_owner in select distinct b.owner_uid from public.booking b where b.sailing_code=args->>'code' and b.status='CONFIRMED' and b.payment_status='PAID'
    loop perform barkolink_private.issue_loyalty_vouchers(passenger_owner); end loop;
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
