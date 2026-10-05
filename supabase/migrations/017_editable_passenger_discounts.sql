-- Make existing and additional passenger discounts one editable vessel collection.
alter table public.fare_settings add column passenger_discounts jsonb check(passenger_discounts is null or jsonb_typeof(passenger_discounts)='array');
alter table public.sailing add column passenger_discounts jsonb check(passenger_discounts is null or jsonb_typeof(passenger_discounts)='array');

create function barkolink_private.passenger_type_code(label text) returns text language sql immutable set search_path='' as $$
  select case upper(label) when 'STUDENT' then 'STUDENT' when 'SENIOR' then 'SENIOR' when 'SENIOR CITIZEN' then 'SENIOR'
    when 'CHILD' then 'CHILD' when 'PWD' then 'PWD' when 'PREGNANT' then 'PREGNANT' when 'PREGNANT (OPERATOR POLICY)' then 'PREGNANT' else label end
$$;
create function barkolink_private.legacy_passenger_discounts(settings jsonb) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_array(
    jsonb_build_object('id','ffffffff-0000-4000-8000-000000000001','name','Student','percentage',coalesce((settings->>'student_discount')::numeric,20),'is_active',true),
    jsonb_build_object('id','ffffffff-0000-4000-8000-000000000002','name','Senior','percentage',coalesce((settings->>'senior_discount')::numeric,20),'is_active',true),
    jsonb_build_object('id','ffffffff-0000-4000-8000-000000000003','name','Child','percentage',coalesce((settings->>'child_discount')::numeric,20),'is_active',true),
    jsonb_build_object('id','ffffffff-0000-4000-8000-000000000004','name','PWD','percentage',coalesce((settings->>'pwd_discount')::numeric,20),'is_active',true),
    jsonb_build_object('id','ffffffff-0000-4000-8000-000000000005','name','Pregnant','percentage',coalesce((settings->>'pregnant_discount')::numeric,0),'is_active',true)
  ) || coalesce(settings->'custom_discounts','[]')
$$;
create function barkolink_private.normalize_passenger_discounts(discounts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare entry jsonb; output jsonb:='[]'; names text[]:='{}'; ids uuid[]:='{}'; discount_id uuid; label text; percentage integer; enabled boolean;
begin
  if discounts is null or jsonb_typeof(discounts)<>'array' then raise exception 'Passenger discounts must be a list.'; end if;
  if jsonb_array_length(discounts)>20 then raise exception 'Use at most 20 passenger discounts per vessel.'; end if;
  for entry in select value from jsonb_array_elements(discounts) loop
    if jsonb_typeof(entry)<>'object' then raise exception 'Enter valid passenger discount details.'; end if;
    discount_id:=(entry->>'id')::uuid;
    label:=regexp_replace(trim(coalesce(entry->>'name','')),'\s+',' ','g');
    if discount_id is null or discount_id=any(ids) then raise exception 'Each passenger discount needs a unique ID.'; end if;
    if length(label) not between 1 and 60 or lower(barkolink_private.passenger_type_code(label))=any(names) then raise exception 'Give each passenger discount a unique name from 1 to 60 characters.'; end if;
    if lower(label)='regular' then raise exception 'Regular is the base fare; use a different discount name.'; end if;
    if jsonb_typeof(entry->'percentage') is distinct from 'number' or (entry->>'percentage')::numeric<>trunc((entry->>'percentage')::numeric) then raise exception 'Discount percentages must be whole numbers from 0 to 99.'; end if;
    percentage:=(entry->>'percentage')::integer;
    if percentage not between 0 and 99 then raise exception 'Discount percentages must be whole numbers from 0 to 99.'; end if;
    if entry ? 'isActive' and jsonb_typeof(entry->'isActive') is distinct from 'boolean' then raise exception 'Choose whether the discount is active.'; end if;
    enabled:=coalesce((entry->>'isActive')::boolean,true);
    output:=output||jsonb_build_array(jsonb_build_object('id',discount_id,'name',label,'percentage',percentage,'is_active',enabled));
    names:=array_append(names,lower(barkolink_private.passenger_type_code(label))); ids:=array_append(ids,discount_id);
  end loop;
  return output;
end $$;


-- Existing vessel rates become editable records. Existing sailing snapshots stay untouched.
update public.fare_settings f set passenger_discounts=barkolink_private.legacy_passenger_discounts(to_jsonb(f));

create function barkolink_private.snapshot_passenger_discounts() returns trigger language plpgsql set search_path='' as $$
declare discounts jsonb; settings public.fare_settings;
begin
  if tg_op='INSERT' then
    select * into settings from public.fare_settings f where f.code=new.vessel_id::text;
    discounts:=coalesce(settings.passenger_discounts,barkolink_private.legacy_passenger_discounts(to_jsonb(settings)));
  elsif new.vessel_id is distinct from old.vessel_id then
    select * into settings from public.fare_settings f where f.code=new.vessel_id::text;
    discounts:=coalesce(settings.passenger_discounts,barkolink_private.legacy_passenger_discounts(to_jsonb(settings)));
  else
    discounts:=coalesce(old.passenger_discounts,barkolink_private.legacy_passenger_discounts(jsonb_build_object(
      'student_discount',100-old.student_fare*100::numeric/old.regular_fare,'senior_discount',100-old.senior_fare*100::numeric/old.regular_fare,
      'child_discount',100-old.child_fare*100::numeric/old.regular_fare,'pwd_discount',100-old.pwd_fare*100::numeric/old.regular_fare,
      'pregnant_discount',100-old.pregnant_fare*100::numeric/old.regular_fare,'custom_discounts',old.custom_discounts)));
  end if;
  select coalesce(jsonb_agg(item||jsonb_build_object('fare',greatest(1,round(new.regular_fare*(100-(item->>'percentage')::numeric)/100)::integer)) order by position),'[]')
    into new.passenger_discounts from jsonb_array_elements(discounts) with ordinality entries(item,position) where coalesce((item->>'is_active')::boolean,true);
  return new;
end $$;
create trigger sailing_passenger_discount_snapshot before insert or update of vessel_id,regular_fare on public.sailing
for each row execute function barkolink_private.snapshot_passenger_discounts();

create or replace function barkolink_private.fare(s public.sailing,passenger_type text) returns integer language plpgsql immutable set search_path='' as $$
declare amount integer;
begin
  if passenger_type='REGULAR' then return s.regular_fare; end if;
  if s.passenger_discounts is not null then
    select (entry->>'fare')::integer into amount from jsonb_array_elements(s.passenger_discounts) entry
      where entry->>'name'=passenger_type or barkolink_private.passenger_type_code(entry->>'name')=passenger_type;
  else
    if passenger_type in ('STUDENT','SENIOR','CHILD','PWD','PREGNANT') then
      return case passenger_type when 'STUDENT' then s.student_fare when 'SENIOR' then s.senior_fare when 'CHILD' then s.child_fare when 'PWD' then s.pwd_fare when 'PREGNANT' then s.pregnant_fare end;
    end if;
    select (entry->>'fare')::integer into amount from jsonb_array_elements(s.custom_discounts) entry where entry->>'name'=passenger_type;
  end if;
  if amount is null or amount<1 then raise exception 'Invalid passenger type or unavailable discount for this trip.'; end if;
  return amount;
end $$;

create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb language plpgsql set search_path='' as $$
declare normalized jsonb; vessel_id_value uuid; result jsonb; legacy jsonb;
begin
  if operation='AdminSaveFareSettings' then
    if actor_uid is null or actor_uid='' or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    vessel_id_value:=(args->>'vesselId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(vessel_id_value::text,42));
    perform 1 from public.vessel where id=vessel_id_value and is_active for update;
    if not found then raise exception 'Select an active vessel.'; end if;
    if args ? 'passengerDiscounts' then
      normalized:=barkolink_private.normalize_passenger_discounts(args->'passengerDiscounts');
    else
      -- Keep older clients compatible with the fixed percentage fields and custom collection.
      if args ? 'customDiscounts' then legacy:=barkolink_private.normalize_custom_discounts(args->'customDiscounts');
      else select f.custom_discounts into legacy from public.fare_settings f where f.code=vessel_id_value::text; end if;
      normalized:=barkolink_private.legacy_passenger_discounts(jsonb_build_object('student_discount',(args->>'studentDiscount')::integer,
        'senior_discount',(args->>'seniorDiscount')::integer,'child_discount',(args->>'childDiscount')::integer,'pwd_discount',(args->>'pwdDiscount')::integer,
        'pregnant_discount',coalesce((args->>'pregnantDiscount')::integer,0),'custom_discounts',coalesce(legacy,'[]')));
    end if;
    insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount,custom_discounts,passenger_discounts)
    values(vessel_id_value::text,(args->>'regularFare')::integer,
      coalesce((select (d->>'percentage')::integer from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name')='STUDENT' and (d->>'is_active')::boolean),0),
      coalesce((select (d->>'percentage')::integer from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name')='SENIOR' and (d->>'is_active')::boolean),0),
      coalesce((select (d->>'percentage')::integer from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name')='CHILD' and (d->>'is_active')::boolean),0),
      coalesce((select (d->>'percentage')::integer from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name')='PWD' and (d->>'is_active')::boolean),0),
      coalesce((select (d->>'percentage')::integer from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name')='PREGNANT' and (d->>'is_active')::boolean),0),
      coalesce((select jsonb_agg(d) from jsonb_array_elements(normalized) d where barkolink_private.passenger_type_code(d->>'name') not in ('STUDENT','SENIOR','CHILD','PWD','PREGNANT')),'[]'),normalized)
    on conflict(code) do update set regular_fare=excluded.regular_fare,student_discount=excluded.student_discount,senior_discount=excluded.senior_discount,
      child_discount=excluded.child_discount,pwd_discount=excluded.pwd_discount,pregnant_discount=excluded.pregnant_discount,
      custom_discounts=excluded.custom_discounts,passenger_discounts=excluded.passenger_discounts,updated_at=now();
    return '{}';
  elsif operation='StaffFares' then
    result:=barkolink_private.execute_discounts(operation,args,actor_uid,actor_role);
    return jsonb_build_object('fares',coalesce((select jsonb_agg(item||jsonb_build_object('passenger_discounts',coalesce(f.passenger_discounts,barkolink_private.legacy_passenger_discounts(to_jsonb(f)))))
      from jsonb_array_elements(result->'fares') item join public.fare_settings f on f.code=item->>'vesselId'),'[]'));
  end if;
  return barkolink_private.execute_discounts(operation,args,actor_uid,actor_role);
end $$;
create or replace function public.barkolink_execute(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_uid text; actor_role text:='PASSENGER'; begin
  actor_uid:=auth.uid()::text;
  if operation is null or length(operation)>80 or args is null or jsonb_typeof(args)<>'object' then raise exception 'Invalid database request.'; end if;
  if actor_uid is not null then select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid; if not found then raise exception 'Account was not found.' using errcode='42501'; end if; end if;
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  perform barkolink_private.expire_reservations();
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_flexible_discounts(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon,authenticated,service_role;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
