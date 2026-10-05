-- Custom operator discounts are saved per vessel and snapshotted onto new sailings.
alter table public.fare_settings add column custom_discounts jsonb not null default '[]' check(jsonb_typeof(custom_discounts)='array');
alter table public.sailing add column custom_discounts jsonb not null default '[]' check(jsonb_typeof(custom_discounts)='array');
alter table public.booking_passenger drop constraint booking_passenger_passenger_type_check;
alter table public.booking_passenger add constraint booking_passenger_passenger_type_check check(length(trim(passenger_type)) between 1 and 60);

create function barkolink_private.normalize_custom_discounts(discounts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare entry jsonb; output jsonb:='[]'; names text[]:='{}'; ids uuid[]:='{}'; discount_id uuid; label text; percentage integer; enabled boolean;
begin
  if discounts is null or jsonb_typeof(discounts)<>'array' then raise exception 'Custom discounts must be a list.'; end if;
  if jsonb_array_length(discounts)>20 then raise exception 'Use at most 20 custom discounts per vessel.'; end if;
  for entry in select value from jsonb_array_elements(discounts) loop
    if jsonb_typeof(entry)<>'object' then raise exception 'Enter valid custom discount details.'; end if;
    discount_id:=(entry->>'id')::uuid;
    label:=regexp_replace(trim(coalesce(entry->>'name','')),'\s+',' ','g');
    if discount_id is null or discount_id=any(ids) then raise exception 'Each custom discount needs a unique ID.'; end if;
    if length(label) not between 1 and 60 or lower(label)=any(names) then raise exception 'Give each custom discount a unique name from 1 to 60 characters.'; end if;
    if lower(label) in ('regular','student','senior','senior citizen','child','pwd','pregnant','pregnant (operator policy)') then raise exception 'Use a custom name different from the standard passenger types.'; end if;
    if jsonb_typeof(entry->'percentage') is distinct from 'number' or (entry->>'percentage')::numeric<>trunc((entry->>'percentage')::numeric) then raise exception 'Discount percentages must be whole numbers from 0 to 99.'; end if;
    percentage:=(entry->>'percentage')::integer;
    if percentage not between 0 and 99 then raise exception 'Discount percentages must be whole numbers from 0 to 99.'; end if;
    if entry ? 'isActive' and jsonb_typeof(entry->'isActive') is distinct from 'boolean' then raise exception 'Choose whether the discount is active.'; end if;
    enabled:=coalesce((entry->>'isActive')::boolean,true);
    output:=output||jsonb_build_array(jsonb_build_object('id',discount_id,'name',label,'percentage',percentage,'is_active',enabled));
    names:=array_append(names,lower(label)); ids:=array_append(ids,discount_id);
  end loop;
  return output;
end $$;

create function barkolink_private.snapshot_custom_discounts() returns trigger
language plpgsql set search_path='' as $$
declare discounts jsonb;
begin
  if tg_op='INSERT' then
    select f.custom_discounts into discounts from public.fare_settings f where f.code=new.vessel_id::text;
  elsif new.vessel_id is distinct from old.vessel_id then
    select f.custom_discounts into discounts from public.fare_settings f where f.code=new.vessel_id::text;
  else
    discounts:=old.custom_discounts;
  end if;
  select coalesce(jsonb_agg(item||jsonb_build_object('fare',greatest(1,round(new.regular_fare*(100-(item->>'percentage')::integer)::numeric/100)::integer))),'[]')
    into new.custom_discounts from jsonb_array_elements(coalesce(discounts,'[]')) item where coalesce((item->>'is_active')::boolean,true);
  return new;
end $$;
create trigger sailing_custom_discount_snapshot before insert or update of vessel_id,regular_fare on public.sailing
for each row execute function barkolink_private.snapshot_custom_discounts();

create or replace function barkolink_private.fare(s public.sailing, passenger_type text) returns integer
language plpgsql immutable set search_path='' as $$
declare custom_fare integer;
begin
  if passenger_type in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then
    return case passenger_type when 'REGULAR' then s.regular_fare when 'STUDENT' then s.student_fare
      when 'SENIOR' then s.senior_fare when 'CHILD' then s.child_fare when 'PWD' then s.pwd_fare when 'PREGNANT' then s.pregnant_fare end;
  end if;
  select (entry->>'fare')::integer into custom_fare from jsonb_array_elements(s.custom_discounts) entry where entry->>'name'=passenger_type;
  if not found or custom_fare is null or custom_fare<1 then raise exception 'Invalid passenger type or custom discount for this trip.'; end if;
  return custom_fare;
end $$;

create function barkolink_private.execute_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare normalized jsonb; vessel_id_value uuid;
begin
  if operation='AdminSaveFareSettings' then
    if actor_uid is null or actor_uid='' or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if args ? 'customDiscounts' then normalized:=barkolink_private.normalize_custom_discounts(args->'customDiscounts'); end if;
    vessel_id_value:=(args->>'vesselId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(vessel_id_value::text,42));
    perform 1 from public.vessel where id=vessel_id_value and is_active for update;
    if not found then raise exception 'Select an active vessel.'; end if;
    insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount,pregnant_discount,custom_discounts)
      values(vessel_id_value::text,(args->>'regularFare')::integer,(args->>'studentDiscount')::integer,(args->>'seniorDiscount')::integer,
        (args->>'childDiscount')::integer,(args->>'pwdDiscount')::integer,coalesce((args->>'pregnantDiscount')::integer,0),
        coalesce(normalized,(select f.custom_discounts from public.fare_settings f where f.code=vessel_id_value::text),'[]'))
      on conflict(code) do update set regular_fare=excluded.regular_fare,student_discount=excluded.student_discount,senior_discount=excluded.senior_discount,
        child_discount=excluded.child_discount,pwd_discount=excluded.pwd_discount,pregnant_discount=excluded.pregnant_discount,custom_discounts=excluded.custom_discounts,updated_at=now();
    return '{}';
  elsif operation='StaffFares' then
    if actor_uid is null or actor_uid='' or coalesce(actor_role,'') not in ('ADMIN','TICKETING') then raise exception 'Ticketing access required.' using errcode='42501'; end if;
    if coalesce((args->>'page')::integer,0) not between 0 and 100000 or length(trim(coalesce(args->>'search','')))>120 then raise exception 'Invalid records search.'; end if;
    return jsonb_build_object('fares',(select coalesce(jsonb_agg(jsonb_build_object('vesselName',v.name,'vesselId',v.id,
      'regularFare',f.regular_fare,'studentDiscount',f.student_discount,'seniorDiscount',f.senior_discount,'childDiscount',f.child_discount,
      'pwdDiscount',f.pwd_discount,'pregnantDiscount',f.pregnant_discount,'custom_discounts',f.custom_discounts,
      'accommodations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.surcharge,a.name),'[]') from public.accommodation a where a.vessel_id=v.id and a.is_active)) order by v.name,v.id),'[]')
      from public.vessel v join public.fare_settings f on f.code=v.id::text where v.is_active));
  end if;
  return barkolink_private.execute_workspaces(operation,args,actor_uid,actor_role);
end $$;

create or replace function public.barkolink_execute(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_uid text; actor_role text:='PASSENGER'; begin
  actor_uid:=auth.uid()::text;
  if operation is null or length(operation)>80 or args is null or jsonb_typeof(args)<>'object' then raise exception 'Invalid database request.'; end if;
  if actor_uid is not null then select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid; if not found then raise exception 'Account was not found.' using errcode='42501'; end if; end if;
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  perform barkolink_private.expire_reservations();
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_discounts(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon,authenticated,service_role;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
