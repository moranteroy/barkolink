-- Additive upgrade. The existing RPC remains the only browser database entry point.
create table public.travel_advisory (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 120),
  message text not null check (length(trim(message)) between 3 and 2000),
  category text not null check (category in ('WEATHER','PORT','SCHEDULE','SAFETY','GENERAL')),
  priority text not null check (priority in ('HIGH','MEDIUM','LOW')),
  sailing_code text references public.sailing(code),
  starts_at timestamptz not null, ends_at timestamptz not null,
  published boolean not null default false, created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table public.saved_traveler (
  id uuid primary key default gen_random_uuid(), owner_uid text not null references public.app_user(uid) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  birth_date date not null check (birth_date >= date '1900-01-01'),
  sex text not null check (sex in ('MALE','FEMALE','OTHER')),
  phone text not null check (length(trim(phone)) between 7 and 30),
  nationality text not null check (length(trim(nationality)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.passenger_no_show (
  passenger_id uuid primary key references public.booking_passenger(id) on delete cascade,
  marked_by_uid text not null, created_at timestamptz not null default now()
);
create index saved_traveler_owner_idx on public.saved_traveler(owner_uid);
create index travel_advisory_period_idx on public.travel_advisory(ends_at) where published;
alter table public.travel_advisory enable row level security;
alter table public.saved_traveler enable row level security;
alter table public.passenger_no_show enable row level security;
revoke all on public.travel_advisory, public.saved_traveler, public.passenger_no_show from anon, authenticated;
grant all on public.travel_advisory, public.saved_traveler, public.passenger_no_show to service_role;

create function barkolink_private.execute_experience(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare result jsonb; record_id uuid; changed integer; s public.sailing;
begin
  if operation not in ('ActiveAdvisories','AdminAdvisories','AdminSaveAdvisory','MyMarkAllNotificationsRead',
    'MySavedTravelers','MySaveTraveler','MyDeleteTraveler','AdminTripOperations','AdminReconcileNoShows') then
    return barkolink_private.execute(operation,args,actor_uid,actor_role);
  end if;
  if actor_uid is null or actor_uid = '' then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  if actor_role is null or actor_role not in ('PASSENGER','ADMIN','TICKETING','BOARDING') then
    raise exception 'Invalid access role.' using errcode='42501';
  end if;
  if operation like 'Admin%' and actor_role <> 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation in ('MySavedTravelers','MySaveTraveler','MyDeleteTraveler') and actor_role <> 'PASSENGER' then
    raise exception 'Passenger access required.' using errcode='42501';
  end if;
  case operation
    when 'ActiveAdvisories','AdminAdvisories' then
      select jsonb_build_object('advisories',coalesce(jsonb_agg(to_jsonb(a) order by
        case a.priority when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end,a.starts_at desc),'[]')) into result
      from public.travel_advisory a where operation='AdminAdvisories' or
        (a.published and a.starts_at<=now() and a.ends_at>now() and
          (a.sailing_code is null or a.sailing_code=nullif(args->>'sailingCode','')));
    when 'AdminSaveAdvisory' then
      record_id := nullif(args->>'id','')::uuid;
      if record_id is null then
        insert into public.travel_advisory(title,message,category,priority,sailing_code,starts_at,ends_at,published)
        values(trim(args->>'title'),trim(args->>'message'),args->>'category',args->>'priority',nullif(args->>'sailingCode',''),
          (args->>'startsAt')::timestamptz,(args->>'endsAt')::timestamptz,coalesce((args->>'published')::boolean,false)) returning id into record_id;
      else
        update public.travel_advisory set title=trim(args->>'title'),message=trim(args->>'message'),category=args->>'category',priority=args->>'priority',
          sailing_code=nullif(args->>'sailingCode',''),starts_at=(args->>'startsAt')::timestamptz,ends_at=(args->>'endsAt')::timestamptz,
          published=coalesce((args->>'published')::boolean,false) where id=record_id;
        if not found then raise exception 'Advisory was not found.'; end if;
      end if;
      insert into public.activity_log(actor_uid,action,entity_type,entity_id) values(actor_uid,'ADVISORY_SAVED','travel_advisory',record_id::text);
      result := jsonb_build_object('id',record_id);
    when 'MyMarkAllNotificationsRead' then
      update public.notification set read_at=now() where owner_uid=actor_uid and read_at is null;
      get diagnostics changed = row_count;
      result := jsonb_build_object('marked',changed);
    when 'MySavedTravelers' then
      select jsonb_build_object('travelers',coalesce(jsonb_agg(to_jsonb(t) order by t.full_name,t.id),'[]')) into result
        from public.saved_traveler t where t.owner_uid=actor_uid;
    when 'MySaveTraveler' then
      if (args->>'birthDate')::date > (now() at time zone 'Asia/Manila')::date then raise exception 'Birth date cannot be in the future.'; end if;
      -- Serialize the per-account limit, including simultaneous creates.
      perform 1 from public.app_user where uid=actor_uid for update;
      record_id := nullif(args->>'id','')::uuid;
      if record_id is null then
        if (select count(*) from public.saved_traveler where owner_uid=actor_uid)>=20 then raise exception 'You can save up to 20 travelers.'; end if;
        insert into public.saved_traveler(owner_uid,full_name,birth_date,sex,phone,nationality)
        values(actor_uid,trim(args->>'fullName'),(args->>'birthDate')::date,args->>'sex',trim(args->>'phone'),trim(args->>'nationality')) returning id into record_id;
      else
        update public.saved_traveler set full_name=trim(args->>'fullName'),birth_date=(args->>'birthDate')::date,sex=args->>'sex',
          phone=trim(args->>'phone'),nationality=trim(args->>'nationality') where id=record_id and owner_uid=actor_uid;
        if not found then raise exception 'Saved traveler was not found.'; end if;
      end if;
      result := jsonb_build_object('id',record_id);
    when 'MyDeleteTraveler' then
      delete from public.saved_traveler where id=(args->>'id')::uuid and owner_uid=actor_uid;
      if not found then raise exception 'Saved traveler was not found.'; end if;
      result := '{}';
    when 'AdminTripOperations' then
      select * into s from public.sailing where code=args->>'code';
      if not found then raise exception 'Sailing was not found.'; end if;
      result := jsonb_build_object('sailing',barkolink_private.sailing_json(s),
        'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]') from public.booking b where b.sailing_code=s.code),
        'passengers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'fullName',p.full_name,'passengerType',p.passenger_type,
          'ticketStatus',p.ticket_status,'checkedInAt',p.checked_in_at,'boardedAt',p.boarded_at,
          'noShow',exists(select 1 from public.passenger_no_show n where n.passenger_id=p.id),
          'booking',jsonb_build_object('reference',b.reference,'status',b.status,'paymentStatus',b.payment_status)) order by p.full_name,p.id),'[]')
          from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.sailing_code=s.code),
        'activity',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from public.activity_log a
          where (a.entity_type='sailing' and a.entity_id=s.code) or (a.entity_type='booking' and a.entity_id in
            (select b.id::text from public.booking b where b.sailing_code=s.code))));
    when 'AdminReconcileNoShows' then
      -- Completed voyages cannot accept further boarding. This also serializes against status changes.
      select * into s from public.sailing where code=args->>'code' for update;
      if not found or s.status<>'COMPLETED' or s.departure_at>now() then
        raise exception 'Complete the departed sailing before reconciling no-shows.';
      end if;
      insert into public.passenger_no_show(passenger_id,marked_by_uid)
        select p.id,actor_uid from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where b.sailing_code=s.code and b.status='CONFIRMED' and b.payment_status='PAID' and p.ticket_status in ('ISSUED','CHECKED_IN')
        on conflict (passenger_id) do nothing;
      get diagnostics changed = row_count;
      if changed>0 then
        insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
        values(actor_uid,'NO_SHOW_RECONCILED','sailing',s.code,jsonb_build_object('marked',changed));
      end if;
      result := jsonb_build_object('marked',changed);
  end case;
  return result;
end $$;
create or replace function public.barkolink_execute(operation text, args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_uid text; actor_role text := 'PASSENGER';
begin
  actor_uid := auth.uid()::text;
  if operation is null or length(operation)>80 or args is null or jsonb_typeof(args)<>'object' then raise exception 'Invalid database request.'; end if;
  if actor_uid is not null then
    select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid;
    if not found then raise exception 'Account was not found.' using errcode='42501'; end if;
  end if;
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  perform barkolink_private.expire_reservations();
  return barkolink_private.camel(barkolink_private.execute_experience(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;
