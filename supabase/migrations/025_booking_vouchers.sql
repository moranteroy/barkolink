create table public.voucher (
  id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_type text not null check(discount_type in ('FIXED','PERCENT')), value integer not null check(value>0),
  minimum_spend integer not null default 0 check(minimum_spend>=0), usage_limit integer not null check(usage_limit>0),
  starts_at timestamptz not null, expires_at timestamptz not null, is_active boolean not null default true,
  check(expires_at>starts_at), check(discount_type<>'PERCENT' or value<=99)
);
alter table public.booking add column voucher_id uuid references public.voucher(id);
alter table public.booking add column voucher_code text;
alter table public.booking add column voucher_discount integer not null default 0 check(voucher_discount>=0);
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.booking'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%total = (passenger_fare_total + service_fee)%'
  loop execute format('alter table public.booking drop constraint %I',c.conname); end loop;
end $$;
alter table public.booking add constraint booking_discounted_total check(total=passenger_fare_total+service_fee-voucher_discount and total>0);
create unique index booking_voucher_once on public.booking(owner_uid,voucher_id) where voucher_id is not null;
alter table public.voucher enable row level security;
revoke all on public.voucher from public,anon,authenticated;
grant all on public.voucher to service_role;

create function barkolink_private.voucher_quote(args jsonb,actor text) returns jsonb language plpgsql set search_path='' as $$
declare v public.voucher; s public.sailing; eligible integer:=0; subtotal integer:=0; n integer; count_people integer; discount integer; extra integer:=0; kind text;
begin
  select * into v from public.voucher where code=upper(trim(args->>'voucherCode'));
  if not found or not v.is_active or now()<v.starts_at or now()>=v.expires_at then raise exception 'Voucher is invalid, inactive, or expired.'; end if;
  if exists(select 1 from public.booking where owner_uid=actor and voucher_id=v.id) then raise exception 'You have already used this voucher.'; end if;
  if (select count(*) from public.booking where voucher_id=v.id)>=v.usage_limit then raise exception 'Voucher usage limit has been reached.'; end if;
  select * into s from public.sailing where code=args->>'sailingCode' and status='SCHEDULED' and departure_at>now();
  if not found then raise exception 'Choose an available sailing.'; end if;
  count_people:=(args->>'passengerCount')::integer;
  if count_people is null or count_people not between 1 and 8 then raise exception 'Choose 1 to 8 passengers.'; end if;
  for n in 1..count_people loop
    kind:=args->>('passenger'||n||'Type');
    subtotal:=subtotal+barkolink_private.fare(s,kind);
    if kind='REGULAR' then eligible:=eligible+s.regular_fare; end if;
  end loop;
  if nullif(args->>'accommodationId','') is not null then
    select surcharge into extra from public.accommodation where id=(args->>'accommodationId')::uuid and vessel_id=s.vessel_id and is_active;
    if not found then raise exception 'Choose an available accommodation.'; end if;
  end if;
  subtotal:=subtotal+extra*count_people;
  if subtotal<v.minimum_spend then raise exception 'Minimum spend for this voucher is PHP %.',v.minimum_spend; end if;
  if eligible=0 then raise exception 'Voucher applies to regular passenger fares only.'; end if;
  discount:=least(eligible,subtotal-1,case when v.discount_type='FIXED' then v.value else floor(eligible*v.value/100.0)::integer end);
  if discount<1 then raise exception 'This voucher does not provide a discount for this booking.'; end if;
  return jsonb_build_object('code',v.code,'discount',discount,'subtotal',subtotal,'total',subtotal-discount);
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v24;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb language plpgsql set search_path='' as $$
declare v public.voucher; b public.booking; s public.sailing; result jsonb; quote jsonb; voucher_id_value uuid;
begin
  if operation in ('AdminVouchers','AdminSaveVoucher') then
    if actor_uid is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVouchers' then
      return jsonb_build_object('vouchers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.expires_at desc),'[]') from
        (select offer.*,(select count(*) from public.booking booked where booked.voucher_id=offer.id) as used from public.voucher offer) x));
    end if;
    voucher_id_value:=nullif(args->>'id','')::uuid;
    if voucher_id_value is null then
      insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active)
      values(upper(trim(args->>'code')),args->>'discountType',(args->>'value')::integer,(args->>'minimumSpend')::integer,(args->>'usageLimit')::integer,
        (args->>'startsAt')::timestamptz,(args->>'expiresAt')::timestamptz,coalesce((args->>'isActive')::boolean,true)) returning id into voucher_id_value;
    else
      -- Terms stay immutable; admins can pause or reactivate existing codes.
      update public.voucher set is_active=(args->>'isActive')::boolean where id=voucher_id_value;
      if not found then raise exception 'Voucher was not found.'; end if;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'VOUCHER_SAVED','voucher',voucher_id_value::text,jsonb_build_object('isActive',coalesce((args->>'isActive')::boolean,true)));
    return jsonb_build_object('id',voucher_id_value);
  end if;
  if operation='QuoteVoucher' then
    if actor_uid is null or actor_role is distinct from 'PASSENGER' then raise exception 'Passenger access required.' using errcode='42501'; end if;
    return barkolink_private.voucher_quote(args,actor_uid);
  end if;
  if operation ~ '^ReserveSailing[1-8]$' and nullif(trim(args->>'voucherCode'),'') is not null then
    if actor_uid is null or actor_role is distinct from 'PASSENGER' then raise exception 'Passenger access required.' using errcode='42501'; end if;
    select * into v from public.voucher where code=upper(trim(args->>'voucherCode')) for update;
    if not found then raise exception 'Voucher was not found.'; end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    -- Serialize both discounted and undiscounted submissions before retry checks.
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    select * into b from public.booking where reference=args->>'reference';
    if found then
      if b.voucher_id is distinct from v.id then raise exception 'Booking reference already uses a different voucher.'; end if;
      return barkolink_private.execute_flexible_discounts_v24(operation,args,actor_uid,actor_role);
    end if;
    quote:=barkolink_private.voucher_quote(args||jsonb_build_object('passengerCount',right(operation,1)::integer),actor_uid);
    if (args->>'expectedVoucherDiscount')::integer is distinct from (quote->>'discount')::integer then raise exception 'Voucher discount changed. Apply the voucher again.'; end if;
    result:=barkolink_private.execute_flexible_discounts_v24(operation,args,actor_uid,actor_role);
    if (select passenger_fare_total+service_fee from public.booking where id=(result->'booking_insert'->>'id')::uuid) is distinct from (quote->>'subtotal')::integer then raise exception 'Fare changed. Review your booking and apply the voucher again.'; end if;
    update public.booking set voucher_id=v.id,voucher_code=v.code,voucher_discount=(quote->>'discount')::integer,
      total=passenger_fare_total+service_fee-(quote->>'discount')::integer where id=(result->'booking_insert'->>'id')::uuid;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'VOUCHER_APPLIED','booking',args->>'reference',quote);
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v24(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
