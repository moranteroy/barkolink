alter table public.voucher add column claimable boolean not null default false;
alter table public.voucher add column title text not null default 'Travel promo' check(length(trim(title)) between 3 and 120);
alter table public.voucher add column description text not null default '' check(length(description)<=1000);
alter table public.voucher add column required_trips integer not null default 0 check(required_trips between 0 and 1000);
alter table public.voucher add constraint public_voucher_mission check((not claimable and required_trips=0) or (claimable and owner_uid is null));
create table public.voucher_claim (
  voucher_id uuid not null references public.voucher(id) on delete cascade,
  owner_uid text not null references public.app_user(uid) on delete cascade,
  claimed_at timestamptz not null default now(), primary key(voucher_id,owner_uid)
);
alter table public.voucher_claim enable row level security;
revoke all on public.voucher_claim from public,anon,authenticated;
grant all on public.voucher_claim to service_role;

-- Existing general promotions become discoverable; personal loyalty codes remain private.
update public.voucher set claimable=true where owner_uid is null;
insert into public.voucher_claim(voucher_id,owner_uid,claimed_at)
  select b.voucher_id,b.owner_uid,b.created_at from public.booking b join public.voucher v on v.id=b.voucher_id where v.claimable
  on conflict do nothing;

-- A claim reserves a use. Legacy reservations also count, without counting an account twice.
create function barkolink_private.voucher_allocations(offer uuid) returns integer
language sql stable set search_path='' as $$
  select ((select count(*) from public.voucher_claim where voucher_id=offer)+
    (select count(*) from public.booking b where b.voucher_id=offer and not exists(
      select 1 from public.voucher_claim c where c.voucher_id=offer and c.owner_uid=b.owner_uid)))::integer;
$$;

create or replace function barkolink_private.voucher_quote(args jsonb,actor text) returns jsonb
language plpgsql set search_path='' as $$
declare voucher_owner text; listed boolean; claimed boolean;
begin
  select v.owner_uid,v.claimable,c.owner_uid is not null into voucher_owner,listed,claimed from public.voucher v
    left join public.voucher_claim c on c.voucher_id=v.id and c.owner_uid=actor where v.code=upper(trim(args->>'voucherCode'));
  if voucher_owner is not null and voucher_owner is distinct from actor then raise exception 'This loyalty voucher belongs to another passenger.' using errcode='42501'; end if;
  if listed and not claimed then
    raise exception 'Claim this voucher from Claim vouchers before applying it to a booking.';
  end if;
  return barkolink_private.voucher_quote_v25(args,actor);
end $$;

create function barkolink_private.execute_claim_vouchers(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare offer public.voucher; result jsonb; completed integer; claimed timestamptz; listed boolean; trips integer;
begin
  if operation in ('PassengerVouchers','ClaimVoucher') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'PASSENGER' then raise exception 'Passenger access required.' using errcode='42501'; end if;
    completed:=barkolink_private.loyalty_trip_count(actor_uid);
    if operation='ClaimVoucher' then
      select * into offer from public.voucher where id=(args->>'voucherId')::uuid for update;
      if not found or not offer.claimable or offer.owner_uid is not null then raise exception 'This voucher is not available to claim.'; end if;
      select claimed_at into claimed from public.voucher_claim where voucher_id=offer.id and owner_uid=actor_uid;
      if not found then
        if not offer.is_active or now()<offer.starts_at or now()>=offer.expires_at then raise exception 'This voucher is paused, not yet available, or expired.'; end if;
        if completed<offer.required_trips then raise exception 'Complete % paid % with a boarded passenger to unlock this voucher.',offer.required_trips,case when offer.required_trips=1 then 'trip' else 'trips' end; end if;
        if barkolink_private.voucher_allocations(offer.id)>=offer.usage_limit then raise exception 'All available voucher slots have been claimed.'; end if;
        insert into public.voucher_claim(voucher_id,owner_uid) values(offer.id,actor_uid) returning claimed_at into claimed;
      end if;
      return jsonb_build_object('code',offer.code,'claimed_at',claimed);
    end if;
    return jsonb_build_object('completed_trips',completed,'vouchers',(
      select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'description',v.description,
        'discount_type',v.discount_type,'value',v.value,'minimum_spend',v.minimum_spend,
        'starts_at',v.starts_at,'expires_at',v.expires_at,'is_active',v.is_active,'required_trips',v.required_trips,
        'remaining',greatest(0,v.usage_limit-barkolink_private.voucher_allocations(v.id)),
        'claimed_at',c.claimed_at,'code',case when c.owner_uid is not null then v.code else null end,
        'used',exists(select 1 from public.booking b where b.voucher_id=v.id and b.owner_uid=actor_uid))
        order by v.expires_at,v.id),'[]')
      from public.voucher v left join public.voucher_claim c on c.voucher_id=v.id and c.owner_uid=actor_uid
      where v.claimable and v.owner_uid is null and (c.owner_uid is not null or
        (v.is_active and v.starts_at<=now() and v.expires_at>now() and barkolink_private.voucher_allocations(v.id)<v.usage_limit))));
  end if;
  if operation='AdminVouchers' then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    return jsonb_build_object('vouchers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.expires_at desc),'[]') from
      (select v.*,(select count(*) from public.booking b where b.voucher_id=v.id) used,
        barkolink_private.voucher_allocations(v.id) claimed from public.voucher v) x));
  end if;
  if operation='AdminSaveVoucher' and nullif(args->>'id','') is null then
    listed:=coalesce((args->>'claimable')::boolean,false);
    trips:=coalesce((args->>'requiredTrips')::integer,0);
    if trips not between 0 and 1000 or (not listed and trips<>0) then raise exception 'Choose a valid voucher mission.'; end if;
    if length(trim(coalesce(args->>'title','Travel promo'))) not between 3 and 120 or length(coalesce(args->>'description',''))>1000 then raise exception 'Enter a promo name (3 to 120 characters) and description (up to 1,000 characters).'; end if;
    result:=barkolink_private.execute_flexible_discounts_v25(operation,args,actor_uid,actor_role);
    update public.voucher set claimable=listed,title=trim(coalesce(args->>'title','Travel promo')),
      description=trim(coalesce(args->>'description','')),required_trips=trips where id=(result->>'id')::uuid;
    return result;
  end if;
  raise exception 'Unsupported voucher request.';
end $$;
-- Add an early branch to the existing dispatcher instead of nesting another wrapper
-- around every booking/payment request. Preserve the complete existing dispatcher body.
do $$
declare definition text; insertion integer; branch text;
begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure),E'\r\n',E'\n');
  insertion:=position(E'\nbegin\n' in definition);
  if insertion=0 then raise exception 'Voucher dispatcher insertion point was not found.'; end if;
  branch:=E'  if operation in (\'PassengerVouchers\',\'ClaimVoucher\',\'AdminVouchers\') or (operation=\'AdminSaveVoucher\' and nullif(args->>\'id\',\'\') is null) then\n    return barkolink_private.execute_claim_vouchers(operation,args,actor_uid,actor_role);\n  end if;\n';
  execute overlay(definition placing branch from insertion+length(E'\nbegin\n') for 0);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
