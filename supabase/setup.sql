-- BarkoLink setup: run once in Supabase SQL Editor on a new project.
-- All migrations are applied together or rolled back on failure.
begin;

-- 001_schema.sql
-- BarkoLink PostgreSQL schema. Run migrations in numeric order in Supabase SQL Editor.
-- Text IDs support both Supabase Auth UUIDs and non-login walk-in guest records.
create schema if not exists barkolink_private;
revoke all on schema barkolink_private from public, anon, authenticated;

create table public.app_user (
  uid text primary key,
  email text not null unique,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  phone text,
  role text not null default 'PASSENGER' check (role in ('PASSENGER','TICKETING','BOARDING','ADMIN','WALK_IN')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.port (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null, city text not null, region text, is_active boolean not null default true
);
create table public.vessel (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null, passenger_capacity integer not null check (passenger_capacity > 0),
  is_active boolean not null default true
);
create table public.fare_settings (
  code text primary key, regular_fare integer not null check (regular_fare > 0),
  student_discount integer not null check (student_discount between 0 and 99),
  senior_discount integer not null check (senior_discount between 0 and 99),
  child_discount integer not null check (child_discount between 0 and 99),
  pwd_discount integer not null check (pwd_discount between 0 and 99),
  updated_at timestamptz not null default now()
);
create table public.sailing (
  code text primary key, origin_port_id uuid not null references public.port,
  destination_port_id uuid not null references public.port, vessel_id uuid not null references public.vessel,
  departure_at timestamptz not null, arrival_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  regular_fare integer not null check (regular_fare > 0), student_fare integer not null check (student_fare > 0),
  senior_fare integer not null check (senior_fare > 0), child_fare integer not null check (child_fare > 0),
  pwd_fare integer not null check (pwd_fare > 0), available_seats integer not null check (available_seats >= 0),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','DELAYED','BOARDING','COMPLETED','CANCELLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (origin_port_id <> destination_port_id), check (arrival_at > departure_at)
);
create table public.booking (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  owner_uid text not null references public.app_user, sailing_code text not null references public.sailing,
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','CANCELLED')),
  passenger_count integer not null check (passenger_count between 1 and 8),
  passenger_fare_total integer not null check (passenger_fare_total > 0),
  service_fee integer not null default 0 check (service_fee >= 0), total integer not null,
  currency text not null default 'PHP', booking_channel text not null default 'ONLINE' check (booking_channel in ('ONLINE','WALK_IN')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PAID')),
  payment_method text check (payment_method is null or payment_method = 'CASH'),
  paid_at timestamptz, collected_by_uid text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (total = passenger_fare_total + service_fee)
);
create table public.booking_passenger (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.booking,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  passenger_type text not null default 'REGULAR' check (passenger_type in ('REGULAR','STUDENT','SENIOR','CHILD','PWD')),
  birth_date date, sex text, phone text, nationality text, fare integer not null check (fare > 0),
  ticket_code uuid not null unique default gen_random_uuid(),
  ticket_status text not null default 'PENDING' check (ticket_status in ('PENDING','ISSUED','CHECKED_IN','BOARDED')),
  issued_at timestamptz not null default now(), checked_in_at timestamptz, boarded_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.notification (
  id uuid primary key default gen_random_uuid(), owner_uid text not null references public.app_user,
  title text not null, message text not null, category text not null default 'TRIP',
  read_at timestamptz, created_at timestamptz not null default now()
);
create table public.boarding_event (
  id uuid primary key default gen_random_uuid(), passenger_id uuid not null references public.booking_passenger,
  staff_uid text not null, event_type text not null check (event_type in ('CHECKED_IN','BOARDED')),
  created_at timestamptz not null default now()
);
create index sailing_departure_status_idx on public.sailing(departure_at, status);
create index booking_owner_idx on public.booking(owner_uid, created_at desc);
create index booking_sailing_idx on public.booking(sailing_code);
create index passenger_booking_idx on public.booking_passenger(booking_id);
create index notification_owner_idx on public.notification(owner_uid, created_at desc);
create index boarding_passenger_idx on public.boarding_event(passenger_id, created_at desc);

-- Browser roles have no direct table access. The RPC derives identity from
-- Supabase Auth and enforces application permissions inside PostgreSQL.
do $$ declare t text; begin
  foreach t in array array['app_user','port','vessel','fare_settings','sailing','booking','booking_passenger','notification','boarding_event'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Serialize PostgreSQL snake_case columns into the existing frontend contracts.
create function barkolink_private.camel(value jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb; item record; key_name text; part text; i integer;
begin
  if jsonb_typeof(value) = 'array' then
    select coalesce(jsonb_agg(barkolink_private.camel(e)), '[]'::jsonb) into result from jsonb_array_elements(value) e;
    return result;
  elsif jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for item in select * from jsonb_each(value) loop
      -- These legacy relationship/count keys are consumed by existing views.
      key_name := item.key;
      if key_name not in ('bookingPassengers_on_booking', '_count') and key_name !~ '_(insert|update|upsert)$' then
        key_name := split_part(item.key, '_', 1);
        for i in 2..array_length(string_to_array(item.key, '_'), 1) loop
          part := split_part(item.key, '_', i);
          key_name := key_name || upper(left(part, 1)) || substr(part, 2);
        end loop;
      end if;
      result := result || jsonb_build_object(key_name, barkolink_private.camel(item.value));
    end loop;
    return result;
  end if;
  return value;
end $$;

create function barkolink_private.sailing_json(s public.sailing) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object(
    'origin', (select to_jsonb(p) from public.port p where p.id = s.origin_port_id),
    'destination', (select to_jsonb(p) from public.port p where p.id = s.destination_port_id),
    'vessel', (select to_jsonb(v) from public.vessel v where v.id = s.vessel_id))
$$;
create function barkolink_private.booking_base(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(b) || jsonb_build_object(
    'owner', (select to_jsonb(u) from public.app_user u where u.uid = b.owner_uid),
    'sailing', (select barkolink_private.sailing_json(s) from public.sailing s where s.code = b.sailing_code))
$$;
create function barkolink_private.passenger_json(p public.booking_passenger) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(p) || jsonb_build_object('booking',
    (select barkolink_private.booking_base(b) from public.booking b where b.id = p.booking_id))
$$;
create function barkolink_private.booking_json(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select barkolink_private.booking_base(b) || jsonb_build_object('bookingPassengers_on_booking',
    (select coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at, p.id), '[]'::jsonb)
     from public.booking_passenger p where p.booking_id = b.id))
$$;
create function barkolink_private.next_trip_code() returns text
language sql stable set search_path = '' as $$
  with day as (select to_char(now() at time zone 'Asia/Manila', '"TRP"YYYY-MMDD') as prefix),
  numbered as (
    select day.prefix, coalesce(max(substring(s.code from 13)::bigint), 0) + 1 as n
    from day left join public.sailing s on s.code ~ ('^' || day.prefix || '[0-9]{3,}$') group by day.prefix
  ) select prefix || case when n < 1000 then lpad(n::text, 3, '0') else n::text end from numbered
$$;
create function barkolink_private.fare(s public.sailing, passenger_type text) returns integer
language plpgsql immutable set search_path = '' as $$
begin
  case passenger_type
    when 'REGULAR' then return s.regular_fare;
    when 'STUDENT' then return s.student_fare;
    when 'SENIOR' then return s.senior_fare;
    when 'CHILD' then return s.child_fare;
    when 'PWD' then return s.pwd_fare;
    else raise exception 'Invalid passenger type.';
  end case;
end $$;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 002_operations.sql
-- Every call executes as one PostgreSQL transaction. The public wrapper derives
-- identity from Supabase Auth; callers cannot pass their own UID or access role.
create function barkolink_private.execute(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  result jsonb; s public.sailing; b public.booking; p public.booking_passenger;
  v public.vessel; f public.fare_settings; owner_id text; booking_id uuid;
  passenger_list jsonb := '[]'; person jsonb; fare_value integer; fare_total integer := 0;
  passenger_count integer; i integer; new_code text; new_status text; is_walk_in boolean;
begin
  if operation not in ('BrowseActivePorts', 'BrowseSailings') then
    if actor_uid is null or actor_uid = '' then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
    if actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') or actor_role is null then
      raise exception 'Invalid access role.' using errcode = '42501';
    end if;
    if operation like 'Admin%' or operation = 'CreateManagedUserProfile' then
      if actor_role <> 'ADMIN' then raise exception 'Administrator access required.' using errcode = '42501'; end if;
    elsif operation like 'Ticketing%' or operation in ('StaffBookings','CollectBookingPayment') then
      if actor_role not in ('TICKETING','ADMIN') then raise exception 'Ticketing access required.' using errcode = '42501'; end if;
    elsif operation like 'Boarding%' or operation in ('CheckInTicket','BoardTicket') then
      if actor_role not in ('BOARDING','ADMIN') then raise exception 'Boarding access required.' using errcode = '42501'; end if;
    elsif operation ~ '^ReserveSailing[1-8]$' or operation in ('MyBookings','MyTickets','CancelMyBooking') then
      if actor_role <> 'PASSENGER' then raise exception 'Passenger access required.' using errcode = '42501'; end if;
    end if;
  end if;

  case operation
    when 'BrowseActivePorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select id, code, name, city from public.port where is_active order by name limit 100) q;
    when 'BrowseSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() order by departure_at limit 50) q;
    when 'MyProfile' then
      select jsonb_build_object('user', (select to_jsonb(u) from public.app_user u where uid = actor_uid)) into result;
    when 'CreateMyProfile' then
      insert into public.app_user(uid, email, full_name, phone, role)
      values (actor_uid, lower(args->>'email'), trim(args->>'fullName'), args->>'phone', 'PASSENGER')
      on conflict (uid) do nothing;
      result := jsonb_build_object('user_insert', jsonb_build_object('uid', actor_uid));
    when 'UpdateMyProfile' then
      update public.app_user set full_name = trim(args->>'fullName'), phone = args->>'phone', updated_at = now() where uid = actor_uid;
      if not found then raise exception 'Profile was not found.'; end if;
      result := jsonb_build_object('user_update', jsonb_build_object('uid', actor_uid));
    when 'CreateManagedUserProfile' then
      if args->>'role' not in ('PASSENGER','TICKETING','BOARDING') then raise exception 'Invalid managed account role.'; end if;
      insert into public.app_user(uid, email, full_name, phone, role)
      values (args->>'uid', lower(args->>'email'), trim(args->>'fullName'), args->>'phone', args->>'role');
      result := jsonb_build_object('uid', args->>'uid');
    when 'MyBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking where owner_uid = actor_uid order by created_at desc) q;
    when 'MyTickets' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc), '[]')) into result
      from public.booking_passenger p join public.booking b on b.id = p.booking_id
      where b.owner_uid = actor_uid and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'MyNotifications' then
      select jsonb_build_object('notifications', coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')) into result
      from public.notification n where n.owner_uid = actor_uid;
    when 'MarkNotificationRead' then
      update public.notification set read_at = now() where id = (args->>'id')::uuid and owner_uid = actor_uid;
      if not found then raise exception 'Notification was not found.'; end if;
      result := '{}';
    when 'StaffBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking order by created_at desc limit 100) q;
    when 'TicketingPassengerAccounts' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select uid, full_name, email from public.app_user where role = 'PASSENGER' order by full_name limit 500) q;
    when 'TicketingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() and available_seats >= 1 order by departure_at limit 100) q;
    when 'BoardingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status in ('SCHEDULED','BOARDING') order by departure_at limit 100) q;
    when 'BoardingManifest' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(b) order by b.created_at), '[]')) into result
      from public.booking b where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'BoardingActivity' then
      select jsonb_build_object('boardingEvents', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select e.*, barkolink_private.passenger_json(p) as passenger from public.boarding_event e
        join public.booking_passenger p on p.id = e.passenger_id join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' order by e.created_at desc limit 100) q;
    when 'AdminSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing order by departure_at desc limit 100) q;
    when 'AdminUsers' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select * from public.app_user where role <> 'WALK_IN' order by created_at desc limit 100) q;
    when 'AdminPassengerRecords' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select * from public.booking_passenger order by created_at desc limit 1000) q;
    when 'AdminExportManifest' then
      if coalesce((args->>'offset')::integer, -1) < 0 then raise exception 'Invalid manifest offset.'; end if;
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select p.* from public.booking_passenger p join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID'
        order by p.created_at, p.id limit 500 offset (args->>'offset')::integer) q;
    when 'AdminPorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]')) into result from public.port p;
    when 'AdminVessels' then
      select jsonb_build_object('vessels', coalesce(jsonb_agg(to_jsonb(v) order by v.name), '[]')) into result from public.vessel v;
    when 'AdminFareSettings' then
      select jsonb_build_object('fareSettings', (select to_jsonb(f) from public.fare_settings f where code = 'DEFAULT'),
        'vesselFareSettings', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.fare_settings f where code <> 'DEFAULT')) into result;
    when 'AdminNextTripCode' then
      result := jsonb_build_object('nextTripCode', jsonb_build_object('code', barkolink_private.next_trip_code()));
    when 'AdminSailingBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(to_jsonb(b)), '[]')) into result from public.booking b
      where sailing_code = args->>'code' and status in ('PENDING','CONFIRMED');
    when 'AdminDashboardStats' then
      if (args->>'dayEnd')::timestamptz <= (args->>'dayStart')::timestamptz then raise exception 'Invalid date range.'; end if;
      select jsonb_build_object(
        'todaySailings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.sailing where departure_at >= (args->>'dayStart')::timestamptz and departure_at < (args->>'dayEnd')::timestamptz))),
        'todayBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where created_at >= (args->>'dayStart')::timestamptz and created_at < (args->>'dayEnd')::timestamptz))),
        'cancelledBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where status = 'CANCELLED'))),
        'allPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger p join public.booking b on b.id = p.booking_id where b.status = 'CONFIRMED' and b.payment_status = 'PAID'))),
        'checkedInPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status in ('CHECKED_IN','BOARDED')))),
        'boardedPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status = 'BOARDED')))
      ) into result;
    when 'AdminCreatePort' then
      insert into public.port(code, name, city, region) values (upper(trim(args->>'code')), trim(args->>'name'), trim(args->>'city'), args->>'region') returning id into booking_id;
      result := jsonb_build_object('port_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdatePort' then
      update public.port set name = trim(args->>'name'), city = trim(args->>'city'), region = args->>'region', is_active = (args->>'isActive')::boolean where id = (args->>'id')::uuid;
      if not found then raise exception 'Port was not found.'; end if;
      result := '{}';
    when 'AdminCreateVessel' then
      insert into public.vessel(code, name, passenger_capacity) values (upper(trim(args->>'code')), trim(args->>'name'), (args->>'capacity')::integer) returning id into booking_id;
      result := jsonb_build_object('vessel_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdateVessel' then
      select * into v from public.vessel where id = (args->>'id')::uuid for update;
      if not found then raise exception 'Vessel was not found.'; end if;
      if (args->>'capacity')::integer <> v.passenger_capacity and exists (select 1 from public.sailing where vessel_id = v.id and status in ('SCHEDULED','DELAYED','BOARDING')) then
        raise exception 'Change capacity only when this vessel has no active sailings.';
      end if;
      update public.vessel set name = trim(args->>'name'), passenger_capacity = (args->>'capacity')::integer, is_active = (args->>'isActive')::boolean where id = v.id;
      result := '{}';
    when 'AdminSaveFareSettings' then
      if not exists (select 1 from public.vessel where id = (args->>'vesselId')::uuid and is_active) then raise exception 'Select an active vessel.'; end if;
      insert into public.fare_settings(code, regular_fare, student_discount, senior_discount, child_discount, pwd_discount)
      values (args->>'vesselId', (args->>'regularFare')::integer, (args->>'studentDiscount')::integer, (args->>'seniorDiscount')::integer, (args->>'childDiscount')::integer, (args->>'pwdDiscount')::integer)
      on conflict (code) do update set regular_fare = excluded.regular_fare, student_discount = excluded.student_discount,
        senior_discount = excluded.senior_discount, child_discount = excluded.child_discount, pwd_discount = excluded.pwd_discount, updated_at = now();
      result := '{}';
    when 'AdminCreateSailing', 'AdminUpdateUnbookedSailing' then
      -- Lock vessel before sailing consistently, including capacity changes.
      select * into v from public.vessel where id = (args->>'vesselId')::uuid and is_active for update;
      if not found or (select count(*) from public.port where id in ((args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid) and is_active) <> 2 then
        raise exception 'Select active ports and an active vessel.';
      end if;
      if coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Departure must be in the future.'; end if;
      if operation = 'AdminCreateSailing' then
        perform pg_advisory_xact_lock(4281001);
        select * into f from public.fare_settings where code = v.id::text;
        if not found then raise exception 'Save fare settings for this vessel first.'; end if;
        new_code := barkolink_private.next_trip_code();
        insert into public.sailing(code, origin_port_id, destination_port_id, vessel_id, departure_at, arrival_at, duration_minutes,
          regular_fare, student_fare, senior_fare, child_fare, pwd_fare, available_seats)
        values (new_code, (args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid, v.id,
          (args->>'departureAt')::timestamptz, (args->>'arrivalAt')::timestamptz, (args->>'durationMinutes')::integer,
          f.regular_fare, greatest(1, round(f.regular_fare * (100 - f.student_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.senior_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.child_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.pwd_discount)::numeric / 100)::integer), v.passenger_capacity);
        result := jsonb_build_object('sailing_insert', jsonb_build_object('code', new_code));
      else
        select * into s from public.sailing where code = args->>'code' for update;
        if not found or s.status not in ('SCHEDULED','DELAYED') or exists (select 1 from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED')) then
          raise exception 'Only unbooked, pre-boarding sailings can change route, vessel, time, and fares.';
        end if;
        update public.sailing set origin_port_id = (args->>'originPortId')::uuid, destination_port_id = (args->>'destinationPortId')::uuid,
          vessel_id = v.id, departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, regular_fare = (args->>'regularFare')::integer,
          student_fare = (args->>'studentFare')::integer, senior_fare = (args->>'seniorFare')::integer,
          child_fare = (args->>'childFare')::integer, pwd_fare = (args->>'pwdFare')::integer,
          available_seats = v.passenger_capacity, updated_at = now() where code = s.code;
        result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code));
      end if;
    when 'AdminUpdateSailingStatus', 'AdminRescheduleSailing' then
      select * into s from public.sailing where code = args->>'code' for update;
      if not found then raise exception 'Sailing was not found.'; end if;
      if operation = 'AdminUpdateSailingStatus' then
        new_status := args->>'status';
        if not coalesce((s.status = 'SCHEDULED' and new_status in ('BOARDING','DELAYED')) or
          (s.status = 'DELAYED' and new_status in ('SCHEDULED','BOARDING')) or
          (s.status = 'BOARDING' and new_status = 'COMPLETED'), false) then raise exception 'This sailing status change is not allowed.'; end if;
        update public.sailing set status = new_status, updated_at = now() where code = s.code;
      else
        if s.status not in ('SCHEDULED','DELAYED') or coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Only pre-boarding trips can be rescheduled to a future time.'; end if;
        update public.sailing set departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, updated_at = now() where code = s.code;
      end if;
      insert into public.notification(owner_uid, title, message)
        select distinct owner_uid, 'Sailing updated', 'Sailing ' || s.code || ' has changed. Check your booking for the updated schedule and status.'
        from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED');
      get diagnostics i = row_count;
      result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code), 'notified', i);
    when 'CollectBookingPayment' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED') or s.departure_at <= now() or s.status not in ('SCHEDULED','BOARDING') or args->>'method' is distinct from 'CASH' then
        raise exception 'Booking must be unpaid and active, with cash payment before departure.';
      end if;
      update public.booking set status = 'CONFIRMED', payment_status = 'PAID', payment_method = 'CASH', paid_at = now(), collected_by_uid = actor_uid, updated_at = now() where id = b.id;
      update public.booking_passenger bp set ticket_status = 'ISSUED', issued_at = now() where bp.booking_id = b.id and bp.ticket_status = 'PENDING';
      insert into public.notification(owner_uid, title, message, category) values (b.owner_uid, 'Payment received', 'Your passenger e-tickets are ready in My Bookings.', 'BOOKING');
      result := '{}';
    when 'CancelMyBooking', 'AdminCancelBooking' then
      select * into b from public.booking where id = coalesce(args->>'bookingId', args->>'id')::uuid for update;
      if not found or (operation = 'CancelMyBooking' and b.owner_uid <> actor_uid) then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' or s.departure_at <= now() then raise exception 'Only unpaid bookings before departure can be cancelled.'; end if;
      update public.booking set status = 'CANCELLED', updated_at = now() where id = b.id;
      -- Use the stored count and sailing, never caller-supplied seat counts.
      update public.sailing set available_seats = available_seats + b.passenger_count, updated_at = now() where code = b.sailing_code;
      result := '{}';
    when 'CheckInTicket', 'BoardTicket' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      if not found then raise exception 'Ticket was not found.'; end if;
      select * into b from public.booking where id = p.booking_id for update;
      select * into s from public.sailing where code = b.sailing_code for update;
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid for update;
      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then
        if p.ticket_status <> 'ISSUED' or s.status not in ('SCHEDULED','BOARDING') or (s.status <> 'BOARDING' and s.departure_at <= now()) then raise exception 'Only issued tickets on active trips can check in.'; end if;
        update public.booking_passenger set ticket_status = 'CHECKED_IN', checked_in_at = now() where id = p.id;
        new_status := 'CHECKED_IN';
      else
        if p.ticket_status <> 'CHECKED_IN' or s.status <> 'BOARDING' then raise exception 'Check in first and set the trip to BOARDING.'; end if;
        update public.booking_passenger set ticket_status = 'BOARDED', boarded_at = now() where id = p.id;
        new_status := 'BOARDED';
      end if;
      insert into public.boarding_event(passenger_id, staff_uid, event_type) values (p.id, actor_uid, new_status);
      result := '{}';
    when 'AdminReports' then
      result := barkolink_private.reports(args);
    else
      is_walk_in := operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn');
      if operation !~ '^ReserveSailing[1-8]$' and not is_walk_in then raise exception 'Unknown database operation.'; end if;
      passenger_count := case when is_walk_in then 1 else right(operation, 1)::integer end;
      if is_walk_in and args->>'method' is distinct from 'CASH' then raise exception 'Walk-in payment must be cash.'; end if;
      owner_id := case when operation = 'TicketingCreateGuestWalkIn' then args->>'guestUid' when is_walk_in then args->>'ownerUid' else actor_uid end;
      -- Reference is the idempotency key, serialized before seat changes.
      perform pg_advisory_xact_lock(hashtextextended(args->>'reference', 0));
      select * into b from public.booking where reference = args->>'reference';
      if found then
        if b.owner_uid <> owner_id or b.sailing_code <> args->>'sailingCode' or b.passenger_count <> passenger_count or b.status = 'CANCELLED' then raise exception 'Booking reference is already in use.'; end if;
        return jsonb_build_object('booking_insert', jsonb_build_object('id', b.id));
      end if;
      select * into s from public.sailing where code = args->>'sailingCode' for update;
      if not found or s.status <> 'SCHEDULED' or s.departure_at <= now() or s.available_seats < passenger_count then raise exception 'This sailing no longer has enough available seats.'; end if;
      if operation = 'TicketingCreateGuestWalkIn' then
        insert into public.app_user(uid, email, full_name, phone, role) values (owner_id, args->>'guestEmail', trim(args->>'passengerName'), args->>'passengerPhone', 'WALK_IN');
      elsif not exists (select 1 from public.app_user where uid = owner_id and role = 'PASSENGER') then
        raise exception 'Choose a passenger account.';
      end if;
      for i in 1..passenger_count loop
        person := case when is_walk_in then jsonb_build_object('full_name', trim(args->>'passengerName'), 'passenger_type', args->>'passengerType',
          'birth_date', args->>'birthDate', 'sex', args->>'sex', 'phone', args->>'passengerPhone', 'nationality', args->>'nationality')
        else jsonb_build_object('full_name', trim(args->>('passenger' || i || 'Name')), 'passenger_type', args->>('passenger' || i || 'Type'),
          'birth_date', args->>('passenger' || i || 'BirthDate'), 'sex', args->>('passenger' || i || 'Sex'),
          'phone', args->>('passenger' || i || 'Phone'), 'nationality', args->>('passenger' || i || 'Nationality')) end;
        fare_value := barkolink_private.fare(s, person->>'passenger_type');
        fare_total := fare_total + fare_value;
        passenger_list := passenger_list || jsonb_build_array(person || jsonb_build_object('fare', fare_value));
      end loop;
      insert into public.booking(reference, owner_uid, sailing_code, passenger_count, passenger_fare_total, total, status, booking_channel, payment_status, payment_method, paid_at, collected_by_uid)
      values (args->>'reference', owner_id, s.code, passenger_count, fare_total, fare_total,
        case when is_walk_in then 'CONFIRMED' else 'PENDING' end, case when is_walk_in then 'WALK_IN' else 'ONLINE' end,
        case when is_walk_in then 'PAID' else 'UNPAID' end, case when is_walk_in then 'CASH' end,
        case when is_walk_in then now() end, case when is_walk_in then actor_uid end) returning id into booking_id;
      for person in select value from jsonb_array_elements(passenger_list) loop
        insert into public.booking_passenger(booking_id, full_name, passenger_type, birth_date, sex, phone, nationality, fare, ticket_status, ticket_code)
        values (booking_id, person->>'full_name', person->>'passenger_type', nullif(person->>'birth_date','')::date,
          person->>'sex', person->>'phone', person->>'nationality', (person->>'fare')::integer,
          case when is_walk_in then 'ISSUED' else 'PENDING' end,
          case when operation = 'TicketingCreateGuestWalkIn' then (args->>'ticketCode')::uuid else gen_random_uuid() end);
      end loop;
      update public.sailing set available_seats = available_seats - passenger_count, updated_at = now() where code = s.code;
      insert into public.notification(owner_uid, title, message, category)
      values (owner_id, case when is_walk_in then 'Walk-in ticket issued' else 'Reservation awaiting payment' end,
        case when is_walk_in then 'Your walk-in ticket has been issued.' else 'Pay at the ticketing desk to receive your e-ticket.' end, 'BOOKING');
      result := jsonb_build_object('booking_insert', jsonb_build_object('id', booking_id));
  end case;
  return result;
end $$;

create function public.barkolink_execute(operation text, args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_uid text; actor_role text := 'PASSENGER';
begin
  actor_uid := auth.uid()::text;
  if operation is null or length(operation) > 80 or args is null or jsonb_typeof(args) <> 'object' then
    raise exception 'Invalid database request.';
  end if;
  if actor_uid is not null then
    -- Read authoritative metadata rather than stale JWT claims after a demotion.
    select coalesce(raw_app_meta_data->>'role', 'PASSENGER') into actor_role from auth.users where id::text = actor_uid;
    if not found then raise exception 'Account was not found.' using errcode = '42501'; end if;
  end if;
  if operation = 'CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode = '42501'; end if;
  return barkolink_private.camel(barkolink_private.execute(operation, args, actor_uid, actor_role));
end
$$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 003_reports.sql
-- PostgreSQL report aggregation: joins, lateral queries, counts and sums.
create function barkolink_private.reports(args jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare start_at timestamptz := (args->>'startAt')::timestamptz; end_at timestamptz := (args->>'endAt')::timestamptz; result jsonb;
begin
  if start_at is null or end_at is null or end_at <= start_at or end_at - start_at > interval '366 days' then
    raise exception 'Choose a report range of up to 366 days.';
  end if;
  select jsonb_build_object('sailings', coalesce(jsonb_agg(to_jsonb(report)), '[]')) into result from (
SELECT s.code, s.departure_at AS "departureAt", s.status,
      s.origin_port_id::text AS "originId", o.name AS origin,
      s.destination_port_id::text AS "destinationId", d.name AS destination,
      s.vessel_id::text AS "vesselId", v.name AS vessel, v.passenger_capacity AS capacity,
      GREATEST(0, v.passenger_capacity - s.available_seats) AS "reservedSeats",
      b."bookingCount", b."paidBookings", b."pendingBookings", b."cancelledBookings",
      b."collectedRevenue", b."pendingRevenue", b."onlineBookings", b."walkInBookings",
      b."activePassengers", p."paidPassengers", p."checkedIn", p.boarded,
      p.regular, p.student, p.senior, p.child, p.pwd
    FROM public.sailing s
    JOIN public.port o ON o.id = s.origin_port_id
    JOIN public.port d ON d.id = s.destination_port_id
    JOIN public.vessel v ON v.id = s.vessel_id
    CROSS JOIN LATERAL (
      SELECT count(*) AS "bookingCount",
        count(*) FILTER (WHERE payment_status = 'PAID' AND status IN ('PENDING', 'CONFIRMED')) AS "paidBookings",
        count(*) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')) AS "pendingBookings",
        count(*) FILTER (WHERE status = 'CANCELLED') AS "cancelledBookings",
        COALESCE(sum(total) FILTER (WHERE payment_status = 'PAID'), 0) AS "collectedRevenue",
        COALESCE(sum(total) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')), 0) AS "pendingRevenue",
        count(*) FILTER (WHERE booking_channel = 'ONLINE') AS "onlineBookings",
        count(*) FILTER (WHERE booking_channel = 'WALK_IN') AS "walkInBookings",
        COALESCE(sum(passenger_count) FILTER (WHERE status IN ('PENDING', 'CONFIRMED')), 0) AS "activePassengers"
      FROM public.booking WHERE sailing_code = s.code
    ) b
    CROSS JOIN LATERAL (
      SELECT count(*) AS "paidPassengers",
        count(*) FILTER (WHERE bp.ticket_status IN ('CHECKED_IN', 'BOARDED')) AS "checkedIn",
        count(*) FILTER (WHERE bp.ticket_status = 'BOARDED') AS boarded,
        count(*) FILTER (WHERE bp.passenger_type = 'REGULAR') AS regular,
        count(*) FILTER (WHERE bp.passenger_type = 'STUDENT') AS student,
        count(*) FILTER (WHERE bp.passenger_type = 'SENIOR') AS senior,
        count(*) FILTER (WHERE bp.passenger_type = 'CHILD') AS child,
        count(*) FILTER (WHERE bp.passenger_type = 'PWD') AS pwd
      FROM public.booking_passenger bp JOIN public.booking pb ON pb.id = bp.booking_id
      WHERE pb.sailing_code = s.code AND pb.status = 'CONFIRMED' AND pb.payment_status = 'PAID'
    ) p
    WHERE s.departure_at >= start_at AND s.departure_at < end_at
      AND end_at > start_at AND end_at - start_at <= interval '366 days'
    ORDER BY s.departure_at, s.code
  ) report;
  return result;
end $$;
revoke all on function barkolink_private.reports(jsonb) from public, anon, authenticated;


-- 004_auth.sql
-- Profiles are created even when email confirmation is enabled. Application
-- roles come from server-managed app_metadata, never editable user_metadata.
create function barkolink_private.sync_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare assigned_role text;
begin
  assigned_role := coalesce(new.raw_app_meta_data->>'role', 'PASSENGER');
  if assigned_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then raise exception 'Invalid account role.'; end if;
  insert into public.app_user(uid, email, full_name, role)
  values (new.id::text, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'fullName'), ''), split_part(new.email, '@', 1)), 120), assigned_role)
  on conflict (uid) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role, updated_at = now();
  return new;
end $$;
create trigger barkolink_auth_profile after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users for each row execute function barkolink_private.sync_auth_user();
revoke all on function barkolink_private.sync_auth_user() from public, anon, authenticated;

-- Backfill any accounts already registered in this Supabase project.
insert into public.app_user(uid, email, full_name, role)
select id::text, lower(email), left(coalesce(nullif(trim(raw_user_meta_data->>'fullName'), ''), split_part(email, '@', 1)), 120),
  coalesce(raw_app_meta_data->>'role', 'PASSENGER') from auth.users where email is not null
on conflict (uid) do nothing;


-- 005_operations_upgrade.sql
-- Additive upgrade for installed BarkoLink projects. Run once, transactionally.
alter table public.fare_settings add column pregnant_discount integer not null default 0 check (pregnant_discount between 0 and 99);
alter table public.sailing add column pregnant_fare integer;
update public.sailing set pregnant_fare = regular_fare;
alter table public.sailing alter column pregnant_fare set not null;
alter table public.sailing add constraint sailing_pregnant_fare_check check (pregnant_fare > 0);
alter table public.booking_passenger drop constraint booking_passenger_passenger_type_check;
alter table public.booking_passenger add constraint booking_passenger_passenger_type_check check (passenger_type in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT'));
alter table public.booking drop constraint booking_status_check;
alter table public.booking add constraint booking_status_check check (status in ('PENDING','CONFIRMED','CANCELLED','EXPIRED'));
alter table public.booking drop constraint booking_payment_status_check;
alter table public.booking add constraint booking_payment_status_check check (payment_status in ('UNPAID','PAID','REFUND_PENDING','REFUNDED'));
alter table public.booking add column payment_deadline timestamptz;
alter table public.booking add column cancellation_reason text;
alter table public.booking add column refunded_at timestamptz;
alter table public.booking add column refunded_by_uid text;
alter table public.booking add column refund_note text;
alter table public.booking_passenger add column discount_verified_at timestamptz;
alter table public.booking_passenger add column discount_verified_by_uid text;
alter table public.booking_passenger add column discount_verification_note text;

create table public.operation_settings (
  id boolean primary key default true check (id),
  reservation_minutes integer not null default 1440 check (reservation_minutes between 5 and 10080)
);
insert into public.operation_settings(id) values (true);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(), actor_uid text,
  action text not null, entity_type text not null, entity_id text not null,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log(created_at desc, id);
create index booking_deadline_idx on public.booking(payment_deadline) where status = 'PENDING' and payment_status = 'UNPAID';
alter table public.operation_settings enable row level security;
alter table public.activity_log enable row level security;
revoke all on public.operation_settings, public.activity_log from anon, authenticated;
grant all on public.operation_settings, public.activity_log to service_role;

-- Give existing unpaid future reservations a full grace period after deployment.
update public.booking b set payment_deadline = least(now() + interval '24 hours', s.departure_at)
from public.sailing s where b.sailing_code = s.code and b.status in ('PENDING','CONFIRMED') and b.payment_status = 'UNPAID';

create function barkolink_private.expire_reservations() returns integer
language plpgsql set search_path = '' as $$
declare b public.booking; affected integer := 0;
begin
  for b in select * from public.booking where status in ('PENDING','CONFIRMED') and payment_status = 'UNPAID'
    and payment_deadline <= now() order by id for update skip locked loop
    update public.sailing set available_seats = available_seats + b.passenger_count, updated_at = now() where code = b.sailing_code;
    update public.booking set status = 'EXPIRED', cancellation_reason = 'Payment deadline passed', updated_at = now() where id = b.id;
    insert into public.notification(owner_uid,title,message,category)
      values(b.owner_uid,'Reservation expired','Reservation ' || b.reference || ' expired because its payment deadline passed. Its seats were released.','BOOKING');
    insert into public.activity_log(action,entity_type,entity_id,details) values('RESERVATION_EXPIRED','booking',b.id::text,jsonb_build_object('reference',b.reference,'releasedSeats',b.passenger_count));
    affected := affected + 1;
  end loop;
  return affected;
end $$;

-- Per-vessel transaction lock also prevents two concurrent schedule submissions.
create function barkolink_private.check_vessel_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('SCHEDULED','DELAYED','BOARDING') then
    perform pg_advisory_xact_lock(hashtextextended(new.vessel_id::text, 4281));
    if exists(select 1 from public.sailing s where s.vessel_id = new.vessel_id and s.code <> new.code
      and s.status in ('SCHEDULED','DELAYED','BOARDING')
      and tstzrange(s.departure_at,s.arrival_at,'[)') && tstzrange(new.departure_at,new.arrival_at,'[)')) then
      raise exception 'This vessel already has an overlapping trip. Choose another vessel or schedule.';
    end if;
  end if;
  return new;
end $$;
create trigger barkolink_vessel_schedule before insert or update of vessel_id, departure_at, arrival_at, status on public.sailing
for each row execute function barkolink_private.check_vessel_schedule();

create function barkolink_private.audit_change() returns trigger
language plpgsql set search_path = '' as $$
declare before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}' end;
  after_row jsonb := to_jsonb(new); changes jsonb;
begin
  -- Log changed operational values; never copy passenger/contact/auth data.
  select coalesce(jsonb_object_agg(k,jsonb_build_object('before',before_row->k,'after',after_row->k)), '{}') into changes
  from jsonb_object_keys(after_row) k where k in ('status','payment_status','departure_at','arrival_at','vessel_id','regular_fare',
    'student_discount','senior_discount','child_discount','pwd_discount','pregnant_discount','reservation_minutes','discount_verified_at','is_active','refund_note','cancellation_reason')
    and before_row->k is distinct from after_row->k;
  if tg_op = 'INSERT' or changes <> '{}' then
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(auth.uid()::text,tg_op,tg_table_name,coalesce(after_row->>'id',after_row->>'code',after_row->>'uid','settings'),changes);
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['booking','sailing','fare_settings','vessel','port','operation_settings','booking_passenger'] loop
    execute format('create trigger barkolink_audit after insert or update on public.%I for each row execute function barkolink_private.audit_change()',t);
  end loop;
end $$;

create or replace function barkolink_private.fare(s public.sailing, passenger_type text) returns integer
language plpgsql immutable set search_path = '' as $$
begin
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
  return case passenger_type when 'REGULAR' then s.regular_fare when 'STUDENT' then s.student_fare
    when 'SENIOR' then s.senior_fare when 'CHILD' then s.child_fare when 'PWD' then s.pwd_fare
    when 'PREGNANT' then s.pregnant_fare else null end;
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
  if passenger_type not in ('REGULAR','STUDENT','SENIOR','CHILD','PWD','PREGNANT') then raise exception 'Invalid passenger type.'; end if;
end $$;



-- Replacement operations for the additive upgrade; later changes use new migrations.
-- Every call executes as one PostgreSQL transaction. The public wrapper derives
-- identity from Supabase Auth; callers cannot pass their own UID or access role.
create or replace function barkolink_private.execute(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  result jsonb; s public.sailing; b public.booking; p public.booking_passenger;
  v public.vessel; f public.fare_settings; owner_id text; booking_id uuid;
  passenger_list jsonb := '[]'; person jsonb; fare_value integer; fare_total integer := 0;
  passenger_count integer; i integer; new_code text; new_status text; is_walk_in boolean;
begin
  if operation not in ('BrowseActivePorts', 'BrowseSailings') then
    if actor_uid is null or actor_uid = '' then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
    if actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') or actor_role is null then
      raise exception 'Invalid access role.' using errcode = '42501';
    end if;
    if operation like 'Admin%' or operation = 'CreateManagedUserProfile' then
      if actor_role <> 'ADMIN' then raise exception 'Administrator access required.' using errcode = '42501'; end if;
    elsif operation like 'Ticketing%' or operation in ('StaffBookings','CollectBookingPayment','VerifyPassengerDiscount','RefundBooking') then
      if actor_role not in ('TICKETING','ADMIN') then raise exception 'Ticketing access required.' using errcode = '42501'; end if;
    elsif operation like 'Boarding%' or operation in ('CheckInTicket','BoardTicket') then
      if actor_role not in ('BOARDING','ADMIN') then raise exception 'Boarding access required.' using errcode = '42501'; end if;
    elsif operation ~ '^ReserveSailing[1-8]$' or operation in ('MyBookings','MyTickets','CancelMyBooking') then
      if actor_role <> 'PASSENGER' then raise exception 'Passenger access required.' using errcode = '42501'; end if;
    end if;
  end if;

  case operation
    when 'AdminOperationsSettings' then
      select to_jsonb(x) into result from public.operation_settings x where id;
    when 'AdminSaveOperationsSettings' then
      update public.operation_settings set reservation_minutes = (args->>'reservationMinutes')::integer where id;
      result := '{}';
    when 'AdminActivityLog' then
      select jsonb_build_object('records',coalesce(jsonb_agg(to_jsonb(q)), '[]'), 'totalCount',(select count(*) from public.activity_log)) into result
      from (select a.*, coalesce(u.full_name,'System') as actor_name from public.activity_log a left join public.app_user u on u.uid = a.actor_uid
        order by a.created_at desc,a.id limit 30 offset greatest(0,coalesce((args->>'page')::integer,0))*30) q;
    when 'VerifyPassengerDiscount' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      select * into b from public.booking where id = p.booking_id for update;
      if p.id is null or b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' then raise exception 'Verify discounts only on active unpaid reservations.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a verification note of 3 to 160 characters; do not copy ID numbers.'; end if;
      update public.booking_passenger set discount_verified_at = now(), discount_verified_by_uid = actor_uid,
        discount_verification_note = trim(args->>'note') where id = p.id;
      result := '{}';
    when 'RefundBooking' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found or b.status <> 'CANCELLED' or b.payment_status <> 'REFUND_PENDING' then raise exception 'Only cancelled bookings awaiting a refund can be refunded.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a refund receipt or reason (3 to 160 characters).'; end if;
      update public.booking set payment_status='REFUNDED',refunded_at=now(),refunded_by_uid=actor_uid,refund_note=trim(args->>'note'),updated_at=now() where id=b.id;
      insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,'Cash refund recorded','A cash refund of PHP ' || b.total || ' was recorded for ' || b.reference || '.','BOOKING');
      result := '{}';
    when 'BrowseActivePorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select id, code, name, city from public.port where is_active order by name limit 100) q;
    when 'BrowseSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() order by departure_at limit 50) q;
    when 'MyProfile' then
      select jsonb_build_object('user', (select to_jsonb(u) from public.app_user u where uid = actor_uid)) into result;
    when 'CreateMyProfile' then
      insert into public.app_user(uid, email, full_name, phone, role)
      values (actor_uid, lower(args->>'email'), trim(args->>'fullName'), args->>'phone', 'PASSENGER')
      on conflict (uid) do nothing;
      result := jsonb_build_object('user_insert', jsonb_build_object('uid', actor_uid));
    when 'UpdateMyProfile' then
      update public.app_user set full_name = trim(args->>'fullName'), phone = args->>'phone', updated_at = now() where uid = actor_uid;
      if not found then raise exception 'Profile was not found.'; end if;
      result := jsonb_build_object('user_update', jsonb_build_object('uid', actor_uid));
    when 'CreateManagedUserProfile' then
      if args->>'role' not in ('PASSENGER','TICKETING','BOARDING') then raise exception 'Invalid managed account role.'; end if;
      insert into public.app_user(uid, email, full_name, phone, role)
      values (args->>'uid', lower(args->>'email'), trim(args->>'fullName'), args->>'phone', args->>'role');
      result := jsonb_build_object('uid', args->>'uid');
    when 'MyBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking where owner_uid = actor_uid order by created_at desc) q;
    when 'MyTickets' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc), '[]')) into result
      from public.booking_passenger p join public.booking b on b.id = p.booking_id
      where b.owner_uid = actor_uid and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'MyNotifications' then
      select jsonb_build_object('notifications', coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')) into result
      from public.notification n where n.owner_uid = actor_uid;
    when 'MarkNotificationRead' then
      update public.notification set read_at = now() where id = (args->>'id')::uuid and owner_uid = actor_uid;
      if not found then raise exception 'Notification was not found.'; end if;
      result := '{}';
    when 'StaffBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')
        order by created_at desc,id limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')));
    when 'TicketingPassengerAccounts' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select uid, full_name, email from public.app_user where role = 'PASSENGER' order by full_name limit 500) q;
    when 'TicketingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() and available_seats >= 1 order by departure_at limit 100) q;
    when 'BoardingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status in ('SCHEDULED','BOARDING') order by departure_at limit 100) q;
    when 'BoardingManifest' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(b) order by b.created_at), '[]')) into result
      from public.booking b where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'BoardingActivity' then
      select jsonb_build_object('boardingEvents', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select e.*, barkolink_private.passenger_json(p) as passenger from public.boarding_event e
        join public.booking_passenger p on p.id = e.passenger_id join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' order by e.created_at desc limit 100) q;
    when 'AdminSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where true order by departure_at desc,code limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.sailing where true));
    when 'AdminUsers' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select * from public.app_user where role <> 'WALK_IN' order by created_at desc,uid limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.app_user where role <> 'WALK_IN'));
    when 'AdminPassengerRecords' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select * from public.booking_passenger where true order by created_at desc,id limit least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking_passenger where true));
    when 'AdminExportManifest' then
      if coalesce((args->>'offset')::integer, -1) < 0 then raise exception 'Invalid manifest offset.'; end if;
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select p.* from public.booking_passenger p join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID'
        order by p.created_at, p.id limit 500 offset (args->>'offset')::integer) q;
    when 'AdminPorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]')) into result from public.port p;
    when 'AdminVessels' then
      select jsonb_build_object('vessels', coalesce(jsonb_agg(to_jsonb(v) order by v.name), '[]')) into result from public.vessel v;
    when 'AdminFareSettings' then
      select jsonb_build_object('fareSettings', (select to_jsonb(f) from public.fare_settings f where code = 'DEFAULT'),
        'vesselFareSettings', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.fare_settings f where code <> 'DEFAULT')) into result;
    when 'AdminNextTripCode' then
      result := jsonb_build_object('nextTripCode', jsonb_build_object('code', barkolink_private.next_trip_code()));
    when 'AdminSailingBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(to_jsonb(b)), '[]')) into result from public.booking b
      where sailing_code = args->>'code' and status in ('PENDING','CONFIRMED');
    when 'AdminDashboardStats' then
      if (args->>'dayEnd')::timestamptz <= (args->>'dayStart')::timestamptz then raise exception 'Invalid date range.'; end if;
      select jsonb_build_object(
        'todaySailings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.sailing where departure_at >= (args->>'dayStart')::timestamptz and departure_at < (args->>'dayEnd')::timestamptz))),
        'todayBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where created_at >= (args->>'dayStart')::timestamptz and created_at < (args->>'dayEnd')::timestamptz))),
        'cancelledBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where status = 'CANCELLED'))),
        'allPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger p join public.booking b on b.id = p.booking_id where b.status = 'CONFIRMED' and b.payment_status = 'PAID'))),
        'checkedInPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status in ('CHECKED_IN','BOARDED')))),
        'boardedPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status = 'BOARDED')))
      ) into result;
    when 'AdminCreatePort' then
      insert into public.port(code, name, city, region) values (upper(trim(args->>'code')), trim(args->>'name'), trim(args->>'city'), args->>'region') returning id into booking_id;
      result := jsonb_build_object('port_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdatePort' then
      update public.port set name = trim(args->>'name'), city = trim(args->>'city'), region = args->>'region', is_active = (args->>'isActive')::boolean where id = (args->>'id')::uuid;
      if not found then raise exception 'Port was not found.'; end if;
      result := '{}';
    when 'AdminCreateVessel' then
      insert into public.vessel(code, name, passenger_capacity) values (upper(trim(args->>'code')), trim(args->>'name'), (args->>'capacity')::integer) returning id into booking_id;
      result := jsonb_build_object('vessel_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdateVessel' then
      select * into v from public.vessel where id = (args->>'id')::uuid for update;
      if not found then raise exception 'Vessel was not found.'; end if;
      if (args->>'capacity')::integer <> v.passenger_capacity and exists (select 1 from public.sailing where vessel_id = v.id and status in ('SCHEDULED','DELAYED','BOARDING')) then
        raise exception 'Change capacity only when this vessel has no active sailings.';
      end if;
      update public.vessel set name = trim(args->>'name'), passenger_capacity = (args->>'capacity')::integer, is_active = (args->>'isActive')::boolean where id = v.id;
      result := '{}';
    when 'AdminSaveFareSettings' then
      if not exists (select 1 from public.vessel where id = (args->>'vesselId')::uuid and is_active) then raise exception 'Select an active vessel.'; end if;
      insert into public.fare_settings(code, regular_fare, student_discount, senior_discount, child_discount, pwd_discount, pregnant_discount)
      values (args->>'vesselId', (args->>'regularFare')::integer, (args->>'studentDiscount')::integer, (args->>'seniorDiscount')::integer, (args->>'childDiscount')::integer, (args->>'pwdDiscount')::integer, coalesce((args->>'pregnantDiscount')::integer,0))
      on conflict (code) do update set regular_fare = excluded.regular_fare, student_discount = excluded.student_discount,
        senior_discount = excluded.senior_discount, child_discount = excluded.child_discount, pwd_discount = excluded.pwd_discount, pregnant_discount = excluded.pregnant_discount, updated_at = now();
      result := '{}';
    when 'AdminCreateSailing', 'AdminUpdateUnbookedSailing' then
      -- Lock vessel before sailing consistently, including capacity changes.
      select * into v from public.vessel where id = (args->>'vesselId')::uuid and is_active for update;
      if not found or (select count(*) from public.port where id in ((args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid) and is_active) <> 2 then
        raise exception 'Select active ports and an active vessel.';
      end if;
      if coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Departure must be in the future.'; end if;
      if operation = 'AdminCreateSailing' then
        perform pg_advisory_xact_lock(4281001);
        select * into f from public.fare_settings where code = v.id::text;
        if not found then raise exception 'Save fare settings for this vessel first.'; end if;
        new_code := barkolink_private.next_trip_code();
        insert into public.sailing(code, origin_port_id, destination_port_id, vessel_id, departure_at, arrival_at, duration_minutes,
          regular_fare, student_fare, senior_fare, child_fare, pwd_fare, pregnant_fare, available_seats)
        values (new_code, (args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid, v.id,
          (args->>'departureAt')::timestamptz, (args->>'arrivalAt')::timestamptz, (args->>'durationMinutes')::integer,
          f.regular_fare, greatest(1, round(f.regular_fare * (100 - f.student_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.senior_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.child_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.pwd_discount)::numeric / 100)::integer), greatest(1, round(f.regular_fare * (100 - f.pregnant_discount)::numeric / 100)::integer), v.passenger_capacity);
        result := jsonb_build_object('sailing_insert', jsonb_build_object('code', new_code));
      else
        select * into s from public.sailing where code = args->>'code' for update;
        if not found or s.status not in ('SCHEDULED','DELAYED') or exists (select 1 from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED')) then
          raise exception 'Only unbooked, pre-boarding sailings can change route, vessel, time, and fares.';
        end if;
        update public.sailing set origin_port_id = (args->>'originPortId')::uuid, destination_port_id = (args->>'destinationPortId')::uuid,
          vessel_id = v.id, departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, regular_fare = (args->>'regularFare')::integer,
          student_fare = (args->>'studentFare')::integer, senior_fare = (args->>'seniorFare')::integer,
          child_fare = (args->>'childFare')::integer, pwd_fare = (args->>'pwdFare')::integer, pregnant_fare = coalesce((args->>'pregnantFare')::integer,(args->>'regularFare')::integer),
          available_seats = v.passenger_capacity, updated_at = now() where code = s.code;
        result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code));
      end if;
    when 'AdminUpdateSailingStatus', 'AdminRescheduleSailing' then
      if args->>'status' = 'CANCELLED' then perform 1 from public.booking where sailing_code=args->>'code' and status in ('PENDING','CONFIRMED') order by id for update; end if;
      select * into s from public.sailing where code = args->>'code' for update;
      if not found then raise exception 'Sailing was not found.'; end if;
      if operation = 'AdminUpdateSailingStatus' then
        new_status := args->>'status';
        if new_status = 'CANCELLED' then
          if s.status not in ('SCHEDULED','DELAYED','BOARDING') then raise exception 'Only active trips can be cancelled.'; end if;
          if length(trim(coalesce(args->>'reason',''))) not between 3 and 160 then raise exception 'Enter a cancellation reason (3 to 160 characters).'; end if;
          if exists(select 1 from public.booking_passenger bp join public.booking bb on bb.id=bp.booking_id where bb.sailing_code=s.code and bp.ticket_status='BOARDED') then raise exception 'Cannot cancel a trip with boarded passengers. Resolve the voyage with the operator first.'; end if;
          -- Lock bookings before their sailing, matching payment/cancellation order.
          perform 1 from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED') order by id for update;
          insert into public.notification(owner_uid,title,message,category)
            select distinct owner_uid,'Sailing cancelled','Trip ' || s.code || ' was cancelled: ' || trim(args->>'reason') || '. Paid bookings await a cash refund.','TRIP'
            from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          get diagnostics i = row_count;
          update public.sailing set available_seats=available_seats+coalesce((select sum(passenger_count) from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED')),0),status='CANCELLED',updated_at=now() where code=s.code;
          update public.booking set status='CANCELLED',cancellation_reason=trim(args->>'reason'),payment_status=case when payment_status='PAID' then 'REFUND_PENDING' else payment_status end,updated_at=now()
            where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          return jsonb_build_object('sailing_update',jsonb_build_object('code',s.code),'notified',i);
        end if;
        if not coalesce((s.status = 'SCHEDULED' and new_status in ('BOARDING','DELAYED')) or
          (s.status = 'DELAYED' and new_status in ('SCHEDULED','BOARDING')) or
          (s.status = 'BOARDING' and new_status = 'COMPLETED'), false) then raise exception 'This sailing status change is not allowed.'; end if;
        update public.sailing set status = new_status, updated_at = now() where code = s.code;
      else
        if s.status not in ('SCHEDULED','DELAYED') or coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Only pre-boarding trips can be rescheduled to a future time.'; end if;
        update public.sailing set departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, updated_at = now() where code = s.code;
      end if;
      update public.booking set payment_deadline=least(payment_deadline,(args->>'departureAt')::timestamptz) where sailing_code=s.code and payment_status='UNPAID' and status in ('PENDING','CONFIRMED') and operation='AdminRescheduleSailing';
      insert into public.notification(owner_uid, title, message)
        select distinct owner_uid, 'Sailing updated', 'Sailing ' || s.code || ' has changed. Check your booking for the updated schedule and status.'
        from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED');
      get diagnostics i = row_count;
      result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code), 'notified', i);
    when 'CollectBookingPayment' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.payment_deadline <= now() then raise exception 'Payment deadline passed. Refresh this reservation.'; end if;
      if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED') or s.departure_at <= now() or s.status not in ('SCHEDULED','BOARDING') or args->>'method' is distinct from 'CASH' then
        raise exception 'Booking must be unpaid and active, with cash payment before departure.';
      end if;
      if exists(select 1 from public.booking_passenger bp where bp.booking_id=b.id and bp.fare<s.regular_fare and bp.discount_verified_at is null) then raise exception 'Verify each discounted passenger before collecting payment.'; end if;
      update public.booking set status = 'CONFIRMED', payment_status = 'PAID', payment_method = 'CASH', paid_at = now(), collected_by_uid = actor_uid, updated_at = now() where id = b.id;
      update public.booking_passenger bp set ticket_status = 'ISSUED', issued_at = now() where bp.booking_id = b.id and bp.ticket_status = 'PENDING';
      insert into public.notification(owner_uid, title, message, category) values (b.owner_uid, 'Payment received', 'Your passenger e-tickets are ready in My Bookings.', 'BOOKING');
      result := '{}';
    when 'CancelMyBooking', 'AdminCancelBooking' then
      select * into b from public.booking where id = coalesce(args->>'bookingId', args->>'id')::uuid for update;
      if not found or (operation = 'CancelMyBooking' and b.owner_uid <> actor_uid) then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' or s.departure_at <= now() then raise exception 'Only unpaid bookings before departure can be cancelled.'; end if;
      update public.booking set status = 'CANCELLED', updated_at = now() where id = b.id;
      -- Use the stored count and sailing, never caller-supplied seat counts.
      update public.sailing set available_seats = available_seats + b.passenger_count, updated_at = now() where code = b.sailing_code;
      result := '{}';
    when 'CheckInTicket', 'BoardTicket' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      if not found then raise exception 'Ticket was not found.'; end if;
      select * into b from public.booking where id = p.booking_id for update;
      select * into s from public.sailing where code = b.sailing_code for update;
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid for update;
      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then
        if p.ticket_status <> 'ISSUED' or s.status not in ('SCHEDULED','BOARDING') or (s.status <> 'BOARDING' and s.departure_at <= now()) then raise exception 'Only issued tickets on active trips can check in.'; end if;
        update public.booking_passenger set ticket_status = 'CHECKED_IN', checked_in_at = now() where id = p.id;
        new_status := 'CHECKED_IN';
      else
        if p.ticket_status <> 'CHECKED_IN' or s.status <> 'BOARDING' then raise exception 'Check in first and set the trip to BOARDING.'; end if;
        update public.booking_passenger set ticket_status = 'BOARDED', boarded_at = now() where id = p.id;
        new_status := 'BOARDED';
      end if;
      insert into public.boarding_event(passenger_id, staff_uid, event_type) values (p.id, actor_uid, new_status);
      result := '{}';
    when 'AdminReports' then
      result := barkolink_private.reports(args);
    else
      is_walk_in := operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn');
      if operation !~ '^ReserveSailing[1-8]$' and not is_walk_in then raise exception 'Unknown database operation.'; end if;
      passenger_count := case when is_walk_in then 1 else right(operation, 1)::integer end;
      if is_walk_in and args->>'method' is distinct from 'CASH' then raise exception 'Walk-in payment must be cash.'; end if;
      owner_id := case when operation = 'TicketingCreateGuestWalkIn' then args->>'guestUid' when is_walk_in then args->>'ownerUid' else actor_uid end;
      -- Reference is the idempotency key, serialized before seat changes.
      perform pg_advisory_xact_lock(hashtextextended(args->>'reference', 0));
      select * into b from public.booking where reference = args->>'reference';
      if found then
        if b.owner_uid <> owner_id or b.sailing_code <> args->>'sailingCode' or b.passenger_count <> passenger_count or b.status = 'CANCELLED' then raise exception 'Booking reference is already in use.'; end if;
        return jsonb_build_object('booking_insert', jsonb_build_object('id', b.id));
      end if;
      select * into s from public.sailing where code = args->>'sailingCode' for update;
      if not found or s.status <> 'SCHEDULED' or s.departure_at <= now() or s.available_seats < passenger_count then raise exception 'This sailing no longer has enough available seats.'; end if;
      if operation = 'TicketingCreateGuestWalkIn' then
        insert into public.app_user(uid, email, full_name, phone, role) values (owner_id, args->>'guestEmail', trim(args->>'passengerName'), args->>'passengerPhone', 'WALK_IN');
      elsif not exists (select 1 from public.app_user where uid = owner_id and role = 'PASSENGER') then
        raise exception 'Choose a passenger account.';
      end if;
      for i in 1..passenger_count loop
        person := case when is_walk_in then jsonb_build_object('full_name', trim(args->>'passengerName'), 'passenger_type', args->>'passengerType',
          'birth_date', args->>'birthDate', 'sex', args->>'sex', 'phone', args->>'passengerPhone', 'nationality', args->>'nationality')
        else jsonb_build_object('full_name', trim(args->>('passenger' || i || 'Name')), 'passenger_type', args->>('passenger' || i || 'Type'),
          'birth_date', args->>('passenger' || i || 'BirthDate'), 'sex', args->>('passenger' || i || 'Sex'),
          'phone', args->>('passenger' || i || 'Phone'), 'nationality', args->>('passenger' || i || 'Nationality')) end;
        fare_value := barkolink_private.fare(s, person->>'passenger_type');
        if is_walk_in and fare_value < s.regular_fare and (not coalesce((args->>'discountVerified')::boolean,false) or length(trim(coalesce(args->>'verificationNote',''))) not between 3 and 160) then raise exception 'Check the discount eligibility and enter a verification note before issuing a discounted walk-in ticket.'; end if;
        fare_total := fare_total + fare_value;
        passenger_list := passenger_list || jsonb_build_array(person || jsonb_build_object('fare', fare_value));
      end loop;
      insert into public.booking(reference, owner_uid, sailing_code, passenger_count, passenger_fare_total, total, status, booking_channel, payment_status, payment_method, paid_at, collected_by_uid, payment_deadline)
      values (args->>'reference', owner_id, s.code, passenger_count, fare_total, fare_total,
        case when is_walk_in then 'CONFIRMED' else 'PENDING' end, case when is_walk_in then 'WALK_IN' else 'ONLINE' end,
        case when is_walk_in then 'PAID' else 'UNPAID' end, case when is_walk_in then 'CASH' end,
        case when is_walk_in then now() end, case when is_walk_in then actor_uid end, case when not is_walk_in then least(s.departure_at,now() + make_interval(mins => (select reservation_minutes from public.operation_settings where id))) end) returning id into booking_id;
      for person in select value from jsonb_array_elements(passenger_list) loop
        insert into public.booking_passenger(booking_id, full_name, passenger_type, birth_date, sex, phone, nationality, fare, ticket_status, ticket_code)
        values (booking_id, person->>'full_name', person->>'passenger_type', nullif(person->>'birth_date','')::date,
          person->>'sex', person->>'phone', person->>'nationality', (person->>'fare')::integer,
          case when is_walk_in then 'ISSUED' else 'PENDING' end,
          case when operation = 'TicketingCreateGuestWalkIn' then (args->>'ticketCode')::uuid else gen_random_uuid() end);
      end loop;
      if is_walk_in and coalesce((args->>'discountVerified')::boolean,false) then
        update public.booking_passenger set discount_verified_at=now(),discount_verified_by_uid=actor_uid,discount_verification_note=trim(args->>'verificationNote') where booking_passenger.booking_id=(select bb.id from public.booking bb where bb.reference=args->>'reference') and fare<s.regular_fare;
      end if;
      update public.sailing set available_seats = available_seats - passenger_count, updated_at = now() where code = s.code;
      insert into public.notification(owner_uid, title, message, category)
      values (owner_id, case when is_walk_in then 'Walk-in ticket issued' else 'Reservation awaiting payment' end,
        case when is_walk_in then 'Your walk-in ticket has been issued.' else 'Pay at the ticketing desk to receive your e-ticket.' end, 'BOOKING');
      result := jsonb_build_object('booking_insert', jsonb_build_object('id', booking_id));
  end case;
  return result;
end $$;

create or replace function public.barkolink_execute(operation text, args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_uid text; actor_role text := 'PASSENGER';
begin
  actor_uid := auth.uid()::text;
  if operation is null or length(operation) > 80 or args is null or jsonb_typeof(args) <> 'object' then
    raise exception 'Invalid database request.';
  end if;
  if actor_uid is not null then
    -- Read authoritative metadata rather than stale JWT claims after a demotion.
    select coalesce(raw_app_meta_data->>'role', 'PASSENGER') into actor_role from auth.users where id::text = actor_uid;
    if not found then raise exception 'Account was not found.' using errcode = '42501'; end if;
  end if;
  if operation = 'CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode = '42501'; end if;
  perform barkolink_private.expire_reservations();
  return barkolink_private.camel(barkolink_private.execute(operation, args, actor_uid, actor_role));
end
$$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;

-- PostgreSQL report aggregation: joins, lateral queries, counts and sums.
create or replace function barkolink_private.reports(args jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare start_at timestamptz := (args->>'startAt')::timestamptz; end_at timestamptz := (args->>'endAt')::timestamptz; result jsonb;
begin
  if start_at is null or end_at is null or end_at <= start_at or end_at - start_at > interval '366 days' then
    raise exception 'Choose a report range of up to 366 days.';
  end if;
  select jsonb_build_object('sailings', coalesce(jsonb_agg(to_jsonb(report)), '[]')) into result from (
SELECT s.code, s.departure_at AS "departureAt", s.status,
      s.origin_port_id::text AS "originId", o.name AS origin,
      s.destination_port_id::text AS "destinationId", d.name AS destination,
      s.vessel_id::text AS "vesselId", v.name AS vessel, v.passenger_capacity AS capacity,
      GREATEST(0, v.passenger_capacity - s.available_seats) AS "reservedSeats",
      b."bookingCount", b."paidBookings", b."pendingBookings", b."cancelledBookings",
      b."collectedRevenue", b."pendingRevenue", b."onlineBookings", b."walkInBookings",
      b."activePassengers", p."paidPassengers", p."checkedIn", p.boarded,
      p.regular, p.student, p.senior, p.child, p.pwd, p.pregnant, b."refundPending", b."refundedRevenue", b."expiredBookings"
    FROM public.sailing s
    JOIN public.port o ON o.id = s.origin_port_id
    JOIN public.port d ON d.id = s.destination_port_id
    JOIN public.vessel v ON v.id = s.vessel_id
    CROSS JOIN LATERAL (
      SELECT count(*) AS "bookingCount",
        count(*) FILTER (WHERE status='EXPIRED') AS "expiredBookings",
        COALESCE(sum(total) FILTER (WHERE payment_status='REFUND_PENDING'),0) AS "refundPending",
        COALESCE(sum(total) FILTER (WHERE payment_status='REFUNDED'),0) AS "refundedRevenue",
        count(*) FILTER (WHERE payment_status = 'PAID' AND status IN ('PENDING', 'CONFIRMED')) AS "paidBookings",
        count(*) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')) AS "pendingBookings",
        count(*) FILTER (WHERE status = 'CANCELLED') AS "cancelledBookings",
        COALESCE(sum(total) FILTER (WHERE payment_status in ('PAID','REFUND_PENDING')), 0) AS "collectedRevenue",
        COALESCE(sum(total) FILTER (WHERE payment_status = 'UNPAID' AND status IN ('PENDING', 'CONFIRMED')), 0) AS "pendingRevenue",
        count(*) FILTER (WHERE booking_channel = 'ONLINE') AS "onlineBookings",
        count(*) FILTER (WHERE booking_channel = 'WALK_IN') AS "walkInBookings",
        COALESCE(sum(passenger_count) FILTER (WHERE status IN ('PENDING', 'CONFIRMED')), 0) AS "activePassengers"
      FROM public.booking WHERE sailing_code = s.code
    ) b
    CROSS JOIN LATERAL (
      SELECT count(*) AS "paidPassengers",
        count(*) FILTER (WHERE bp.ticket_status IN ('CHECKED_IN', 'BOARDED')) AS "checkedIn",
        count(*) FILTER (WHERE bp.ticket_status = 'BOARDED') AS boarded,
        count(*) FILTER (WHERE bp.passenger_type = 'REGULAR') AS regular,
        count(*) FILTER (WHERE bp.passenger_type = 'STUDENT') AS student,
        count(*) FILTER (WHERE bp.passenger_type = 'SENIOR') AS senior,
        count(*) FILTER (WHERE bp.passenger_type = 'CHILD') AS child,
        count(*) FILTER (WHERE bp.passenger_type = 'PWD') AS pwd, count(*) FILTER (WHERE bp.passenger_type = 'PREGNANT') AS pregnant
      FROM public.booking_passenger bp JOIN public.booking pb ON pb.id = bp.booking_id
      WHERE pb.sailing_code = s.code AND pb.status = 'CONFIRMED' AND pb.payment_status = 'PAID'
    ) p
    WHERE s.departure_at >= start_at AND s.departure_at < end_at
      AND end_at > start_at AND end_at - start_at <= interval '366 days'
    ORDER BY s.departure_at, s.code
  ) report;
  return result;
end $$;
revoke all on function barkolink_private.reports(jsonb) from public, anon, authenticated;

revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 006_expiry_schedule.sql
-- Supabase supports pg_cron. Local PostgreSQL test engines may not have it.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-expire-reservations','* * * * *','select barkolink_private.expire_reservations();')$schedule$;
  end if;
end $$;


-- 007_reschedule_lock_order.sql
-- Follow the same booking-before-sailing lock order as payment, expiry and cancellation.
create or replace function barkolink_private.execute(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  result jsonb; s public.sailing; b public.booking; p public.booking_passenger;
  v public.vessel; f public.fare_settings; owner_id text; booking_id uuid;
  passenger_list jsonb := '[]'; person jsonb; fare_value integer; fare_total integer := 0;
  passenger_count integer; i integer; new_code text; new_status text; is_walk_in boolean;
begin
  if operation not in ('BrowseActivePorts', 'BrowseSailings') then
    if actor_uid is null or actor_uid = '' then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
    if actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') or actor_role is null then
      raise exception 'Invalid access role.' using errcode = '42501';
    end if;
    if operation like 'Admin%' or operation = 'CreateManagedUserProfile' then
      if actor_role <> 'ADMIN' then raise exception 'Administrator access required.' using errcode = '42501'; end if;
    elsif operation like 'Ticketing%' or operation in ('StaffBookings','CollectBookingPayment','VerifyPassengerDiscount','RefundBooking') then
      if actor_role not in ('TICKETING','ADMIN') then raise exception 'Ticketing access required.' using errcode = '42501'; end if;
    elsif operation like 'Boarding%' or operation in ('CheckInTicket','BoardTicket') then
      if actor_role not in ('BOARDING','ADMIN') then raise exception 'Boarding access required.' using errcode = '42501'; end if;
    elsif operation ~ '^ReserveSailing[1-8]$' or operation in ('MyBookings','MyTickets','CancelMyBooking') then
      if actor_role <> 'PASSENGER' then raise exception 'Passenger access required.' using errcode = '42501'; end if;
    end if;
  end if;

  case operation
    when 'AdminOperationsSettings' then
      select to_jsonb(x) into result from public.operation_settings x where id;
    when 'AdminSaveOperationsSettings' then
      update public.operation_settings set reservation_minutes = (args->>'reservationMinutes')::integer where id;
      result := '{}';
    when 'AdminActivityLog' then
      select jsonb_build_object('records',coalesce(jsonb_agg(to_jsonb(q)), '[]'), 'totalCount',(select count(*) from public.activity_log)) into result
      from (select a.*, coalesce(u.full_name,'System') as actor_name from public.activity_log a left join public.app_user u on u.uid = a.actor_uid
        order by a.created_at desc,a.id limit 30 offset greatest(0,coalesce((args->>'page')::integer,0))*30) q;
    when 'VerifyPassengerDiscount' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      select * into b from public.booking where id = p.booking_id for update;
      if p.id is null or b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' then raise exception 'Verify discounts only on active unpaid reservations.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a verification note of 3 to 160 characters; do not copy ID numbers.'; end if;
      update public.booking_passenger set discount_verified_at = now(), discount_verified_by_uid = actor_uid,
        discount_verification_note = trim(args->>'note') where id = p.id;
      result := '{}';
    when 'RefundBooking' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found or b.status <> 'CANCELLED' or b.payment_status <> 'REFUND_PENDING' then raise exception 'Only cancelled bookings awaiting a refund can be refunded.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a refund receipt or reason (3 to 160 characters).'; end if;
      update public.booking set payment_status='REFUNDED',refunded_at=now(),refunded_by_uid=actor_uid,refund_note=trim(args->>'note'),updated_at=now() where id=b.id;
      insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,'Cash refund recorded','A cash refund of PHP ' || b.total || ' was recorded for ' || b.reference || '.','BOOKING');
      result := '{}';
    when 'BrowseActivePorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select id, code, name, city from public.port where is_active order by name limit 100) q;
    when 'BrowseSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() order by departure_at limit 50) q;
    when 'MyProfile' then
      select jsonb_build_object('user', (select to_jsonb(u) from public.app_user u where uid = actor_uid)) into result;
    when 'CreateMyProfile' then
      insert into public.app_user(uid, email, full_name, phone, role)
      values (actor_uid, lower(args->>'email'), trim(args->>'fullName'), args->>'phone', 'PASSENGER')
      on conflict (uid) do nothing;
      result := jsonb_build_object('user_insert', jsonb_build_object('uid', actor_uid));
    when 'UpdateMyProfile' then
      update public.app_user set full_name = trim(args->>'fullName'), phone = args->>'phone', updated_at = now() where uid = actor_uid;
      if not found then raise exception 'Profile was not found.'; end if;
      result := jsonb_build_object('user_update', jsonb_build_object('uid', actor_uid));
    when 'CreateManagedUserProfile' then
      if args->>'role' not in ('PASSENGER','TICKETING','BOARDING') then raise exception 'Invalid managed account role.'; end if;
      insert into public.app_user(uid, email, full_name, phone, role)
      values (args->>'uid', lower(args->>'email'), trim(args->>'fullName'), args->>'phone', args->>'role');
      result := jsonb_build_object('uid', args->>'uid');
    when 'MyBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking where owner_uid = actor_uid order by created_at desc) q;
    when 'MyTickets' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc), '[]')) into result
      from public.booking_passenger p join public.booking b on b.id = p.booking_id
      where b.owner_uid = actor_uid and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'MyNotifications' then
      select jsonb_build_object('notifications', coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')) into result
      from public.notification n where n.owner_uid = actor_uid;
    when 'MarkNotificationRead' then
      update public.notification set read_at = now() where id = (args->>'id')::uuid and owner_uid = actor_uid;
      if not found then raise exception 'Notification was not found.'; end if;
      result := '{}';
    when 'StaffBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')
        order by created_at desc,id limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')));
    when 'TicketingPassengerAccounts' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select uid, full_name, email from public.app_user where role = 'PASSENGER' order by full_name limit 500) q;
    when 'TicketingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() and available_seats >= 1 order by departure_at limit 100) q;
    when 'BoardingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status in ('SCHEDULED','BOARDING') order by departure_at limit 100) q;
    when 'BoardingManifest' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(b) order by b.created_at), '[]')) into result
      from public.booking b where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'BoardingActivity' then
      select jsonb_build_object('boardingEvents', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select e.*, barkolink_private.passenger_json(p) as passenger from public.boarding_event e
        join public.booking_passenger p on p.id = e.passenger_id join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' order by e.created_at desc limit 100) q;
    when 'AdminSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where true order by departure_at desc,code limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.sailing where true));
    when 'AdminUsers' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select * from public.app_user where role <> 'WALK_IN' order by created_at desc,uid limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.app_user where role <> 'WALK_IN'));
    when 'AdminPassengerRecords' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select * from public.booking_passenger where true order by created_at desc,id limit least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking_passenger where true));
    when 'AdminExportManifest' then
      if coalesce((args->>'offset')::integer, -1) < 0 then raise exception 'Invalid manifest offset.'; end if;
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select p.* from public.booking_passenger p join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID'
        order by p.created_at, p.id limit 500 offset (args->>'offset')::integer) q;
    when 'AdminPorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]')) into result from public.port p;
    when 'AdminVessels' then
      select jsonb_build_object('vessels', coalesce(jsonb_agg(to_jsonb(v) order by v.name), '[]')) into result from public.vessel v;
    when 'AdminFareSettings' then
      select jsonb_build_object('fareSettings', (select to_jsonb(f) from public.fare_settings f where code = 'DEFAULT'),
        'vesselFareSettings', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.fare_settings f where code <> 'DEFAULT')) into result;
    when 'AdminNextTripCode' then
      result := jsonb_build_object('nextTripCode', jsonb_build_object('code', barkolink_private.next_trip_code()));
    when 'AdminSailingBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(to_jsonb(b)), '[]')) into result from public.booking b
      where sailing_code = args->>'code' and status in ('PENDING','CONFIRMED');
    when 'AdminDashboardStats' then
      if (args->>'dayEnd')::timestamptz <= (args->>'dayStart')::timestamptz then raise exception 'Invalid date range.'; end if;
      select jsonb_build_object(
        'todaySailings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.sailing where departure_at >= (args->>'dayStart')::timestamptz and departure_at < (args->>'dayEnd')::timestamptz))),
        'todayBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where created_at >= (args->>'dayStart')::timestamptz and created_at < (args->>'dayEnd')::timestamptz))),
        'cancelledBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where status = 'CANCELLED'))),
        'allPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger p join public.booking b on b.id = p.booking_id where b.status = 'CONFIRMED' and b.payment_status = 'PAID'))),
        'checkedInPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status in ('CHECKED_IN','BOARDED')))),
        'boardedPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger where ticket_status = 'BOARDED')))
      ) into result;
    when 'AdminCreatePort' then
      insert into public.port(code, name, city, region) values (upper(trim(args->>'code')), trim(args->>'name'), trim(args->>'city'), args->>'region') returning id into booking_id;
      result := jsonb_build_object('port_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdatePort' then
      update public.port set name = trim(args->>'name'), city = trim(args->>'city'), region = args->>'region', is_active = (args->>'isActive')::boolean where id = (args->>'id')::uuid;
      if not found then raise exception 'Port was not found.'; end if;
      result := '{}';
    when 'AdminCreateVessel' then
      insert into public.vessel(code, name, passenger_capacity) values (upper(trim(args->>'code')), trim(args->>'name'), (args->>'capacity')::integer) returning id into booking_id;
      result := jsonb_build_object('vessel_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdateVessel' then
      select * into v from public.vessel where id = (args->>'id')::uuid for update;
      if not found then raise exception 'Vessel was not found.'; end if;
      if (args->>'capacity')::integer <> v.passenger_capacity and exists (select 1 from public.sailing where vessel_id = v.id and status in ('SCHEDULED','DELAYED','BOARDING')) then
        raise exception 'Change capacity only when this vessel has no active sailings.';
      end if;
      update public.vessel set name = trim(args->>'name'), passenger_capacity = (args->>'capacity')::integer, is_active = (args->>'isActive')::boolean where id = v.id;
      result := '{}';
    when 'AdminSaveFareSettings' then
      if not exists (select 1 from public.vessel where id = (args->>'vesselId')::uuid and is_active) then raise exception 'Select an active vessel.'; end if;
      insert into public.fare_settings(code, regular_fare, student_discount, senior_discount, child_discount, pwd_discount, pregnant_discount)
      values (args->>'vesselId', (args->>'regularFare')::integer, (args->>'studentDiscount')::integer, (args->>'seniorDiscount')::integer, (args->>'childDiscount')::integer, (args->>'pwdDiscount')::integer, coalesce((args->>'pregnantDiscount')::integer,0))
      on conflict (code) do update set regular_fare = excluded.regular_fare, student_discount = excluded.student_discount,
        senior_discount = excluded.senior_discount, child_discount = excluded.child_discount, pwd_discount = excluded.pwd_discount, pregnant_discount = excluded.pregnant_discount, updated_at = now();
      result := '{}';
    when 'AdminCreateSailing', 'AdminUpdateUnbookedSailing' then
      -- Lock vessel before sailing consistently, including capacity changes.
      select * into v from public.vessel where id = (args->>'vesselId')::uuid and is_active for update;
      if not found or (select count(*) from public.port where id in ((args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid) and is_active) <> 2 then
        raise exception 'Select active ports and an active vessel.';
      end if;
      if coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Departure must be in the future.'; end if;
      if operation = 'AdminCreateSailing' then
        perform pg_advisory_xact_lock(4281001);
        select * into f from public.fare_settings where code = v.id::text;
        if not found then raise exception 'Save fare settings for this vessel first.'; end if;
        new_code := barkolink_private.next_trip_code();
        insert into public.sailing(code, origin_port_id, destination_port_id, vessel_id, departure_at, arrival_at, duration_minutes,
          regular_fare, student_fare, senior_fare, child_fare, pwd_fare, pregnant_fare, available_seats)
        values (new_code, (args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid, v.id,
          (args->>'departureAt')::timestamptz, (args->>'arrivalAt')::timestamptz, (args->>'durationMinutes')::integer,
          f.regular_fare, greatest(1, round(f.regular_fare * (100 - f.student_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.senior_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.child_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.pwd_discount)::numeric / 100)::integer), greatest(1, round(f.regular_fare * (100 - f.pregnant_discount)::numeric / 100)::integer), v.passenger_capacity);
        result := jsonb_build_object('sailing_insert', jsonb_build_object('code', new_code));
      else
        select * into s from public.sailing where code = args->>'code' for update;
        if not found or s.status not in ('SCHEDULED','DELAYED') or exists (select 1 from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED')) then
          raise exception 'Only unbooked, pre-boarding sailings can change route, vessel, time, and fares.';
        end if;
        update public.sailing set origin_port_id = (args->>'originPortId')::uuid, destination_port_id = (args->>'destinationPortId')::uuid,
          vessel_id = v.id, departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, regular_fare = (args->>'regularFare')::integer,
          student_fare = (args->>'studentFare')::integer, senior_fare = (args->>'seniorFare')::integer,
          child_fare = (args->>'childFare')::integer, pwd_fare = (args->>'pwdFare')::integer, pregnant_fare = coalesce((args->>'pregnantFare')::integer,(args->>'regularFare')::integer),
          available_seats = v.passenger_capacity, updated_at = now() where code = s.code;
        result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code));
      end if;
    when 'AdminUpdateSailingStatus', 'AdminRescheduleSailing' then
      if args->>'status' = 'CANCELLED' or operation = 'AdminRescheduleSailing' then perform 1 from public.booking where sailing_code=args->>'code' and status in ('PENDING','CONFIRMED') order by id for update; end if;
      select * into s from public.sailing where code = args->>'code' for update;
      if not found then raise exception 'Sailing was not found.'; end if;
      if operation = 'AdminUpdateSailingStatus' then
        new_status := args->>'status';
        if new_status = 'CANCELLED' then
          if s.status not in ('SCHEDULED','DELAYED','BOARDING') then raise exception 'Only active trips can be cancelled.'; end if;
          if length(trim(coalesce(args->>'reason',''))) not between 3 and 160 then raise exception 'Enter a cancellation reason (3 to 160 characters).'; end if;
          if exists(select 1 from public.booking_passenger bp join public.booking bb on bb.id=bp.booking_id where bb.sailing_code=s.code and bp.ticket_status='BOARDED') then raise exception 'Cannot cancel a trip with boarded passengers. Resolve the voyage with the operator first.'; end if;
          -- Lock bookings before their sailing, matching payment/cancellation order.
          perform 1 from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED') order by id for update;
          insert into public.notification(owner_uid,title,message,category)
            select distinct owner_uid,'Sailing cancelled','Trip ' || s.code || ' was cancelled: ' || trim(args->>'reason') || '. Paid bookings await a cash refund.','TRIP'
            from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          get diagnostics i = row_count;
          update public.sailing set available_seats=available_seats+coalesce((select sum(passenger_count) from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED')),0),status='CANCELLED',updated_at=now() where code=s.code;
          update public.booking set status='CANCELLED',cancellation_reason=trim(args->>'reason'),payment_status=case when payment_status='PAID' then 'REFUND_PENDING' else payment_status end,updated_at=now()
            where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          return jsonb_build_object('sailing_update',jsonb_build_object('code',s.code),'notified',i);
        end if;
        if not coalesce((s.status = 'SCHEDULED' and new_status in ('BOARDING','DELAYED')) or
          (s.status = 'DELAYED' and new_status in ('SCHEDULED','BOARDING')) or
          (s.status = 'BOARDING' and new_status = 'COMPLETED'), false) then raise exception 'This sailing status change is not allowed.'; end if;
        update public.sailing set status = new_status, updated_at = now() where code = s.code;
      else
        if s.status not in ('SCHEDULED','DELAYED') or coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Only pre-boarding trips can be rescheduled to a future time.'; end if;
        update public.sailing set departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, updated_at = now() where code = s.code;
      end if;
      update public.booking set payment_deadline=least(payment_deadline,(args->>'departureAt')::timestamptz) where sailing_code=s.code and payment_status='UNPAID' and status in ('PENDING','CONFIRMED') and operation='AdminRescheduleSailing';
      insert into public.notification(owner_uid, title, message)
        select distinct owner_uid, 'Sailing updated', 'Sailing ' || s.code || ' has changed. Check your booking for the updated schedule and status.'
        from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED');
      get diagnostics i = row_count;
      result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code), 'notified', i);
    when 'CollectBookingPayment' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.payment_deadline <= now() then raise exception 'Payment deadline passed. Refresh this reservation.'; end if;
      if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED') or s.departure_at <= now() or s.status not in ('SCHEDULED','BOARDING') or args->>'method' is distinct from 'CASH' then
        raise exception 'Booking must be unpaid and active, with cash payment before departure.';
      end if;
      if exists(select 1 from public.booking_passenger bp where bp.booking_id=b.id and bp.fare<s.regular_fare and bp.discount_verified_at is null) then raise exception 'Verify each discounted passenger before collecting payment.'; end if;
      update public.booking set status = 'CONFIRMED', payment_status = 'PAID', payment_method = 'CASH', paid_at = now(), collected_by_uid = actor_uid, updated_at = now() where id = b.id;
      update public.booking_passenger bp set ticket_status = 'ISSUED', issued_at = now() where bp.booking_id = b.id and bp.ticket_status = 'PENDING';
      insert into public.notification(owner_uid, title, message, category) values (b.owner_uid, 'Payment received', 'Your passenger e-tickets are ready in My Bookings.', 'BOOKING');
      result := '{}';
    when 'CancelMyBooking', 'AdminCancelBooking' then
      select * into b from public.booking where id = coalesce(args->>'bookingId', args->>'id')::uuid for update;
      if not found or (operation = 'CancelMyBooking' and b.owner_uid <> actor_uid) then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' or s.departure_at <= now() then raise exception 'Only unpaid bookings before departure can be cancelled.'; end if;
      update public.booking set status = 'CANCELLED', updated_at = now() where id = b.id;
      -- Use the stored count and sailing, never caller-supplied seat counts.
      update public.sailing set available_seats = available_seats + b.passenger_count, updated_at = now() where code = b.sailing_code;
      result := '{}';
    when 'CheckInTicket', 'BoardTicket' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      if not found then raise exception 'Ticket was not found.'; end if;
      select * into b from public.booking where id = p.booking_id for update;
      select * into s from public.sailing where code = b.sailing_code for update;
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid for update;
      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then
        if p.ticket_status <> 'ISSUED' or s.status not in ('SCHEDULED','BOARDING') or (s.status <> 'BOARDING' and s.departure_at <= now()) then raise exception 'Only issued tickets on active trips can check in.'; end if;
        update public.booking_passenger set ticket_status = 'CHECKED_IN', checked_in_at = now() where id = p.id;
        new_status := 'CHECKED_IN';
      else
        if p.ticket_status <> 'CHECKED_IN' or s.status <> 'BOARDING' then raise exception 'Check in first and set the trip to BOARDING.'; end if;
        update public.booking_passenger set ticket_status = 'BOARDED', boarded_at = now() where id = p.id;
        new_status := 'BOARDED';
      end if;
      insert into public.boarding_event(passenger_id, staff_uid, event_type) values (p.id, actor_uid, new_status);
      result := '{}';
    when 'AdminReports' then
      result := barkolink_private.reports(args);
    else
      is_walk_in := operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn');
      if operation !~ '^ReserveSailing[1-8]$' and not is_walk_in then raise exception 'Unknown database operation.'; end if;
      passenger_count := case when is_walk_in then 1 else right(operation, 1)::integer end;
      if is_walk_in and args->>'method' is distinct from 'CASH' then raise exception 'Walk-in payment must be cash.'; end if;
      owner_id := case when operation = 'TicketingCreateGuestWalkIn' then args->>'guestUid' when is_walk_in then args->>'ownerUid' else actor_uid end;
      -- Reference is the idempotency key, serialized before seat changes.
      perform pg_advisory_xact_lock(hashtextextended(args->>'reference', 0));
      select * into b from public.booking where reference = args->>'reference';
      if found then
        if b.owner_uid <> owner_id or b.sailing_code <> args->>'sailingCode' or b.passenger_count <> passenger_count or b.status = 'CANCELLED' then raise exception 'Booking reference is already in use.'; end if;
        return jsonb_build_object('booking_insert', jsonb_build_object('id', b.id));
      end if;
      select * into s from public.sailing where code = args->>'sailingCode' for update;
      if not found or s.status <> 'SCHEDULED' or s.departure_at <= now() or s.available_seats < passenger_count then raise exception 'This sailing no longer has enough available seats.'; end if;
      if operation = 'TicketingCreateGuestWalkIn' then
        insert into public.app_user(uid, email, full_name, phone, role) values (owner_id, args->>'guestEmail', trim(args->>'passengerName'), args->>'passengerPhone', 'WALK_IN');
      elsif not exists (select 1 from public.app_user where uid = owner_id and role = 'PASSENGER') then
        raise exception 'Choose a passenger account.';
      end if;
      for i in 1..passenger_count loop
        person := case when is_walk_in then jsonb_build_object('full_name', trim(args->>'passengerName'), 'passenger_type', args->>'passengerType',
          'birth_date', args->>'birthDate', 'sex', args->>'sex', 'phone', args->>'passengerPhone', 'nationality', args->>'nationality')
        else jsonb_build_object('full_name', trim(args->>('passenger' || i || 'Name')), 'passenger_type', args->>('passenger' || i || 'Type'),
          'birth_date', args->>('passenger' || i || 'BirthDate'), 'sex', args->>('passenger' || i || 'Sex'),
          'phone', args->>('passenger' || i || 'Phone'), 'nationality', args->>('passenger' || i || 'Nationality')) end;
        fare_value := barkolink_private.fare(s, person->>'passenger_type');
        if is_walk_in and fare_value < s.regular_fare and (not coalesce((args->>'discountVerified')::boolean,false) or length(trim(coalesce(args->>'verificationNote',''))) not between 3 and 160) then raise exception 'Check the discount eligibility and enter a verification note before issuing a discounted walk-in ticket.'; end if;
        fare_total := fare_total + fare_value;
        passenger_list := passenger_list || jsonb_build_array(person || jsonb_build_object('fare', fare_value));
      end loop;
      insert into public.booking(reference, owner_uid, sailing_code, passenger_count, passenger_fare_total, total, status, booking_channel, payment_status, payment_method, paid_at, collected_by_uid, payment_deadline)
      values (args->>'reference', owner_id, s.code, passenger_count, fare_total, fare_total,
        case when is_walk_in then 'CONFIRMED' else 'PENDING' end, case when is_walk_in then 'WALK_IN' else 'ONLINE' end,
        case when is_walk_in then 'PAID' else 'UNPAID' end, case when is_walk_in then 'CASH' end,
        case when is_walk_in then now() end, case when is_walk_in then actor_uid end, case when not is_walk_in then least(s.departure_at,now() + make_interval(mins => (select reservation_minutes from public.operation_settings where id))) end) returning id into booking_id;
      for person in select value from jsonb_array_elements(passenger_list) loop
        insert into public.booking_passenger(booking_id, full_name, passenger_type, birth_date, sex, phone, nationality, fare, ticket_status, ticket_code)
        values (booking_id, person->>'full_name', person->>'passenger_type', nullif(person->>'birth_date','')::date,
          person->>'sex', person->>'phone', person->>'nationality', (person->>'fare')::integer,
          case when is_walk_in then 'ISSUED' else 'PENDING' end,
          case when operation = 'TicketingCreateGuestWalkIn' then (args->>'ticketCode')::uuid else gen_random_uuid() end);
      end loop;
      if is_walk_in and coalesce((args->>'discountVerified')::boolean,false) then
        update public.booking_passenger set discount_verified_at=now(),discount_verified_by_uid=actor_uid,discount_verification_note=trim(args->>'verificationNote') where booking_passenger.booking_id=(select bb.id from public.booking bb where bb.reference=args->>'reference') and fare<s.regular_fare;
      end if;
      update public.sailing set available_seats = available_seats - passenger_count, updated_at = now() where code = s.code;
      insert into public.notification(owner_uid, title, message, category)
      values (owner_id, case when is_walk_in then 'Walk-in ticket issued' else 'Reservation awaiting payment' end,
        case when is_walk_in then 'Your walk-in ticket has been issued.' else 'Pay at the ticketing desk to receive your e-ticket.' end, 'BOOKING');
      result := jsonb_build_object('booking_insert', jsonb_build_object('id', booking_id));
  end case;
  return result;
end $$;


revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 008_active_terminal_counts.sql
-- Keep terminal dashboard counts restricted to paid active bookings after a trip cancellation.
create or replace function barkolink_private.execute(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  result jsonb; s public.sailing; b public.booking; p public.booking_passenger;
  v public.vessel; f public.fare_settings; owner_id text; booking_id uuid;
  passenger_list jsonb := '[]'; person jsonb; fare_value integer; fare_total integer := 0;
  passenger_count integer; i integer; new_code text; new_status text; is_walk_in boolean;
begin
  if operation not in ('BrowseActivePorts', 'BrowseSailings') then
    if actor_uid is null or actor_uid = '' then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
    if actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') or actor_role is null then
      raise exception 'Invalid access role.' using errcode = '42501';
    end if;
    if operation like 'Admin%' or operation = 'CreateManagedUserProfile' then
      if actor_role <> 'ADMIN' then raise exception 'Administrator access required.' using errcode = '42501'; end if;
    elsif operation like 'Ticketing%' or operation in ('StaffBookings','CollectBookingPayment','VerifyPassengerDiscount','RefundBooking') then
      if actor_role not in ('TICKETING','ADMIN') then raise exception 'Ticketing access required.' using errcode = '42501'; end if;
    elsif operation like 'Boarding%' or operation in ('CheckInTicket','BoardTicket') then
      if actor_role not in ('BOARDING','ADMIN') then raise exception 'Boarding access required.' using errcode = '42501'; end if;
    elsif operation ~ '^ReserveSailing[1-8]$' or operation in ('MyBookings','MyTickets','CancelMyBooking') then
      if actor_role <> 'PASSENGER' then raise exception 'Passenger access required.' using errcode = '42501'; end if;
    end if;
  end if;

  case operation
    when 'AdminOperationsSettings' then
      select to_jsonb(x) into result from public.operation_settings x where id;
    when 'AdminSaveOperationsSettings' then
      update public.operation_settings set reservation_minutes = (args->>'reservationMinutes')::integer where id;
      result := '{}';
    when 'AdminActivityLog' then
      select jsonb_build_object('records',coalesce(jsonb_agg(to_jsonb(q)), '[]'), 'totalCount',(select count(*) from public.activity_log)) into result
      from (select a.*, coalesce(u.full_name,'System') as actor_name from public.activity_log a left join public.app_user u on u.uid = a.actor_uid
        order by a.created_at desc,a.id limit 30 offset greatest(0,coalesce((args->>'page')::integer,0))*30) q;
    when 'VerifyPassengerDiscount' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      select * into b from public.booking where id = p.booking_id for update;
      if p.id is null or b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' then raise exception 'Verify discounts only on active unpaid reservations.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a verification note of 3 to 160 characters; do not copy ID numbers.'; end if;
      update public.booking_passenger set discount_verified_at = now(), discount_verified_by_uid = actor_uid,
        discount_verification_note = trim(args->>'note') where id = p.id;
      result := '{}';
    when 'RefundBooking' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found or b.status <> 'CANCELLED' or b.payment_status <> 'REFUND_PENDING' then raise exception 'Only cancelled bookings awaiting a refund can be refunded.'; end if;
      if length(trim(coalesce(args->>'note',''))) not between 3 and 160 then raise exception 'Enter a refund receipt or reason (3 to 160 characters).'; end if;
      update public.booking set payment_status='REFUNDED',refunded_at=now(),refunded_by_uid=actor_uid,refund_note=trim(args->>'note'),updated_at=now() where id=b.id;
      insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,'Cash refund recorded','A cash refund of PHP ' || b.total || ' was recorded for ' || b.reference || '.','BOOKING');
      result := '{}';
    when 'BrowseActivePorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select id, code, name, city from public.port where is_active order by name limit 100) q;
    when 'BrowseSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() order by departure_at limit 50) q;
    when 'MyProfile' then
      select jsonb_build_object('user', (select to_jsonb(u) from public.app_user u where uid = actor_uid)) into result;
    when 'CreateMyProfile' then
      insert into public.app_user(uid, email, full_name, phone, role)
      values (actor_uid, lower(args->>'email'), trim(args->>'fullName'), args->>'phone', 'PASSENGER')
      on conflict (uid) do nothing;
      result := jsonb_build_object('user_insert', jsonb_build_object('uid', actor_uid));
    when 'UpdateMyProfile' then
      update public.app_user set full_name = trim(args->>'fullName'), phone = args->>'phone', updated_at = now() where uid = actor_uid;
      if not found then raise exception 'Profile was not found.'; end if;
      result := jsonb_build_object('user_update', jsonb_build_object('uid', actor_uid));
    when 'CreateManagedUserProfile' then
      if args->>'role' not in ('PASSENGER','TICKETING','BOARDING') then raise exception 'Invalid managed account role.'; end if;
      insert into public.app_user(uid, email, full_name, phone, role)
      values (args->>'uid', lower(args->>'email'), trim(args->>'fullName'), args->>'phone', args->>'role');
      result := jsonb_build_object('uid', args->>'uid');
    when 'MyBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking where owner_uid = actor_uid order by created_at desc) q;
    when 'MyTickets' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc), '[]')) into result
      from public.booking_passenger p join public.booking b on b.id = p.booking_id
      where b.owner_uid = actor_uid and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'MyNotifications' then
      select jsonb_build_object('notifications', coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')) into result
      from public.notification n where n.owner_uid = actor_uid;
    when 'MarkNotificationRead' then
      update public.notification set read_at = now() where id = (args->>'id')::uuid and owner_uid = actor_uid;
      if not found then raise exception 'Notification was not found.'; end if;
      result := '{}';
    when 'StaffBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(q)), '[]')) into result
      from (select * from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')
        order by created_at desc,id limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking b where
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')));
    when 'TicketingPassengerAccounts' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select uid, full_name, email from public.app_user where role = 'PASSENGER' order by full_name limit 500) q;
    when 'TicketingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status = 'SCHEDULED' and departure_at > now() and available_seats >= 1 order by departure_at limit 100) q;
    when 'BoardingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where status in ('SCHEDULED','BOARDING') order by departure_at limit 100) q;
    when 'BoardingManifest' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(b) order by b.created_at), '[]')) into result
      from public.booking b where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'BoardingActivity' then
      select jsonb_build_object('boardingEvents', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select e.*, barkolink_private.passenger_json(p) as passenger from public.boarding_event e
        join public.booking_passenger p on p.id = e.passenger_id join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' order by e.created_at desc limit 100) q;
    when 'AdminSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where true order by departure_at desc,code limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.sailing where true));
    when 'AdminUsers' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select * from public.app_user where role <> 'WALK_IN' order by created_at desc,uid limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.app_user where role <> 'WALK_IN'));
    when 'AdminPassengerRecords' then
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select * from public.booking_passenger where true order by created_at desc,id limit least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(1000,greatest(1,coalesce((args->>'pageSize')::integer,1000)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking_passenger where true));
    when 'AdminExportManifest' then
      if coalesce((args->>'offset')::integer, -1) < 0 then raise exception 'Invalid manifest offset.'; end if;
      select jsonb_build_object('bookingPassengers', coalesce(jsonb_agg(barkolink_private.passenger_json(q)), '[]')) into result
      from (select p.* from public.booking_passenger p join public.booking b on b.id = p.booking_id
        where b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID'
        order by p.created_at, p.id limit 500 offset (args->>'offset')::integer) q;
    when 'AdminPorts' then
      select jsonb_build_object('ports', coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]')) into result from public.port p;
    when 'AdminVessels' then
      select jsonb_build_object('vessels', coalesce(jsonb_agg(to_jsonb(v) order by v.name), '[]')) into result from public.vessel v;
    when 'AdminFareSettings' then
      select jsonb_build_object('fareSettings', (select to_jsonb(f) from public.fare_settings f where code = 'DEFAULT'),
        'vesselFareSettings', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.fare_settings f where code <> 'DEFAULT')) into result;
    when 'AdminNextTripCode' then
      result := jsonb_build_object('nextTripCode', jsonb_build_object('code', barkolink_private.next_trip_code()));
    when 'AdminSailingBookings' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(to_jsonb(b)), '[]')) into result from public.booking b
      where sailing_code = args->>'code' and status in ('PENDING','CONFIRMED');
    when 'AdminDashboardStats' then
      if (args->>'dayEnd')::timestamptz <= (args->>'dayStart')::timestamptz then raise exception 'Invalid date range.'; end if;
      select jsonb_build_object(
        'todaySailings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.sailing where departure_at >= (args->>'dayStart')::timestamptz and departure_at < (args->>'dayEnd')::timestamptz))),
        'todayBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where created_at >= (args->>'dayStart')::timestamptz and created_at < (args->>'dayEnd')::timestamptz))),
        'cancelledBookings', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking where status = 'CANCELLED'))),
        'allPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger p join public.booking b on b.id = p.booking_id where b.status = 'CONFIRMED' and b.payment_status = 'PAID'))),
        'checkedInPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger bp join public.booking bb on bb.id=bp.booking_id where bb.status='CONFIRMED' and bb.payment_status='PAID' and bp.ticket_status in ('CHECKED_IN','BOARDED')))),
        'boardedPassengers', jsonb_build_array(jsonb_build_object('_count', (select count(*) from public.booking_passenger bp join public.booking bb on bb.id=bp.booking_id where bb.status='CONFIRMED' and bb.payment_status='PAID' and bp.ticket_status = 'BOARDED')))
      ) into result;
    when 'AdminCreatePort' then
      insert into public.port(code, name, city, region) values (upper(trim(args->>'code')), trim(args->>'name'), trim(args->>'city'), args->>'region') returning id into booking_id;
      result := jsonb_build_object('port_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdatePort' then
      update public.port set name = trim(args->>'name'), city = trim(args->>'city'), region = args->>'region', is_active = (args->>'isActive')::boolean where id = (args->>'id')::uuid;
      if not found then raise exception 'Port was not found.'; end if;
      result := '{}';
    when 'AdminCreateVessel' then
      insert into public.vessel(code, name, passenger_capacity) values (upper(trim(args->>'code')), trim(args->>'name'), (args->>'capacity')::integer) returning id into booking_id;
      result := jsonb_build_object('vessel_insert', jsonb_build_object('id', booking_id));
    when 'AdminUpdateVessel' then
      select * into v from public.vessel where id = (args->>'id')::uuid for update;
      if not found then raise exception 'Vessel was not found.'; end if;
      if (args->>'capacity')::integer <> v.passenger_capacity and exists (select 1 from public.sailing where vessel_id = v.id and status in ('SCHEDULED','DELAYED','BOARDING')) then
        raise exception 'Change capacity only when this vessel has no active sailings.';
      end if;
      update public.vessel set name = trim(args->>'name'), passenger_capacity = (args->>'capacity')::integer, is_active = (args->>'isActive')::boolean where id = v.id;
      result := '{}';
    when 'AdminSaveFareSettings' then
      if not exists (select 1 from public.vessel where id = (args->>'vesselId')::uuid and is_active) then raise exception 'Select an active vessel.'; end if;
      insert into public.fare_settings(code, regular_fare, student_discount, senior_discount, child_discount, pwd_discount, pregnant_discount)
      values (args->>'vesselId', (args->>'regularFare')::integer, (args->>'studentDiscount')::integer, (args->>'seniorDiscount')::integer, (args->>'childDiscount')::integer, (args->>'pwdDiscount')::integer, coalesce((args->>'pregnantDiscount')::integer,0))
      on conflict (code) do update set regular_fare = excluded.regular_fare, student_discount = excluded.student_discount,
        senior_discount = excluded.senior_discount, child_discount = excluded.child_discount, pwd_discount = excluded.pwd_discount, pregnant_discount = excluded.pregnant_discount, updated_at = now();
      result := '{}';
    when 'AdminCreateSailing', 'AdminUpdateUnbookedSailing' then
      -- Lock vessel before sailing consistently, including capacity changes.
      select * into v from public.vessel where id = (args->>'vesselId')::uuid and is_active for update;
      if not found or (select count(*) from public.port where id in ((args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid) and is_active) <> 2 then
        raise exception 'Select active ports and an active vessel.';
      end if;
      if coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Departure must be in the future.'; end if;
      if operation = 'AdminCreateSailing' then
        perform pg_advisory_xact_lock(4281001);
        select * into f from public.fare_settings where code = v.id::text;
        if not found then raise exception 'Save fare settings for this vessel first.'; end if;
        new_code := barkolink_private.next_trip_code();
        insert into public.sailing(code, origin_port_id, destination_port_id, vessel_id, departure_at, arrival_at, duration_minutes,
          regular_fare, student_fare, senior_fare, child_fare, pwd_fare, pregnant_fare, available_seats)
        values (new_code, (args->>'originPortId')::uuid, (args->>'destinationPortId')::uuid, v.id,
          (args->>'departureAt')::timestamptz, (args->>'arrivalAt')::timestamptz, (args->>'durationMinutes')::integer,
          f.regular_fare, greatest(1, round(f.regular_fare * (100 - f.student_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.senior_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.child_discount)::numeric / 100)::integer),
          greatest(1, round(f.regular_fare * (100 - f.pwd_discount)::numeric / 100)::integer), greatest(1, round(f.regular_fare * (100 - f.pregnant_discount)::numeric / 100)::integer), v.passenger_capacity);
        result := jsonb_build_object('sailing_insert', jsonb_build_object('code', new_code));
      else
        select * into s from public.sailing where code = args->>'code' for update;
        if not found or s.status not in ('SCHEDULED','DELAYED') or exists (select 1 from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED')) then
          raise exception 'Only unbooked, pre-boarding sailings can change route, vessel, time, and fares.';
        end if;
        update public.sailing set origin_port_id = (args->>'originPortId')::uuid, destination_port_id = (args->>'destinationPortId')::uuid,
          vessel_id = v.id, departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, regular_fare = (args->>'regularFare')::integer,
          student_fare = (args->>'studentFare')::integer, senior_fare = (args->>'seniorFare')::integer,
          child_fare = (args->>'childFare')::integer, pwd_fare = (args->>'pwdFare')::integer, pregnant_fare = coalesce((args->>'pregnantFare')::integer,(args->>'regularFare')::integer),
          available_seats = v.passenger_capacity, updated_at = now() where code = s.code;
        result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code));
      end if;
    when 'AdminUpdateSailingStatus', 'AdminRescheduleSailing' then
      if args->>'status' = 'CANCELLED' or operation = 'AdminRescheduleSailing' then perform 1 from public.booking where sailing_code=args->>'code' and status in ('PENDING','CONFIRMED') order by id for update; end if;
      select * into s from public.sailing where code = args->>'code' for update;
      if not found then raise exception 'Sailing was not found.'; end if;
      if operation = 'AdminUpdateSailingStatus' then
        new_status := args->>'status';
        if new_status = 'CANCELLED' then
          if s.status not in ('SCHEDULED','DELAYED','BOARDING') then raise exception 'Only active trips can be cancelled.'; end if;
          if length(trim(coalesce(args->>'reason',''))) not between 3 and 160 then raise exception 'Enter a cancellation reason (3 to 160 characters).'; end if;
          if exists(select 1 from public.booking_passenger bp join public.booking bb on bb.id=bp.booking_id where bb.sailing_code=s.code and bp.ticket_status='BOARDED') then raise exception 'Cannot cancel a trip with boarded passengers. Resolve the voyage with the operator first.'; end if;
          -- Lock bookings before their sailing, matching payment/cancellation order.
          perform 1 from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED') order by id for update;
          insert into public.notification(owner_uid,title,message,category)
            select distinct owner_uid,'Sailing cancelled','Trip ' || s.code || ' was cancelled: ' || trim(args->>'reason') || '. Paid bookings await a cash refund.','TRIP'
            from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          get diagnostics i = row_count;
          update public.sailing set available_seats=available_seats+coalesce((select sum(passenger_count) from public.booking where sailing_code=s.code and status in ('PENDING','CONFIRMED')),0),status='CANCELLED',updated_at=now() where code=s.code;
          update public.booking set status='CANCELLED',cancellation_reason=trim(args->>'reason'),payment_status=case when payment_status='PAID' then 'REFUND_PENDING' else payment_status end,updated_at=now()
            where sailing_code=s.code and status in ('PENDING','CONFIRMED');
          return jsonb_build_object('sailing_update',jsonb_build_object('code',s.code),'notified',i);
        end if;
        if not coalesce((s.status = 'SCHEDULED' and new_status in ('BOARDING','DELAYED')) or
          (s.status = 'DELAYED' and new_status in ('SCHEDULED','BOARDING')) or
          (s.status = 'BOARDING' and new_status = 'COMPLETED'), false) then raise exception 'This sailing status change is not allowed.'; end if;
        update public.sailing set status = new_status, updated_at = now() where code = s.code;
      else
        if s.status not in ('SCHEDULED','DELAYED') or coalesce((args->>'departureAt')::timestamptz <= now(), true) then raise exception 'Only pre-boarding trips can be rescheduled to a future time.'; end if;
        update public.sailing set departure_at = (args->>'departureAt')::timestamptz, arrival_at = (args->>'arrivalAt')::timestamptz,
          duration_minutes = (args->>'durationMinutes')::integer, updated_at = now() where code = s.code;
      end if;
      update public.booking set payment_deadline=least(payment_deadline,(args->>'departureAt')::timestamptz) where sailing_code=s.code and payment_status='UNPAID' and status in ('PENDING','CONFIRMED') and operation='AdminRescheduleSailing';
      insert into public.notification(owner_uid, title, message)
        select distinct owner_uid, 'Sailing updated', 'Sailing ' || s.code || ' has changed. Check your booking for the updated schedule and status.'
        from public.booking where sailing_code = s.code and status in ('PENDING','CONFIRMED');
      get diagnostics i = row_count;
      result := jsonb_build_object('sailing_update', jsonb_build_object('code', s.code), 'notified', i);
    when 'CollectBookingPayment' then
      select * into b from public.booking where id = (args->>'bookingId')::uuid for update;
      if not found then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.payment_deadline <= now() then raise exception 'Payment deadline passed. Refresh this reservation.'; end if;
      if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED') or s.departure_at <= now() or s.status not in ('SCHEDULED','BOARDING') or args->>'method' is distinct from 'CASH' then
        raise exception 'Booking must be unpaid and active, with cash payment before departure.';
      end if;
      if exists(select 1 from public.booking_passenger bp where bp.booking_id=b.id and bp.fare<s.regular_fare and bp.discount_verified_at is null) then raise exception 'Verify each discounted passenger before collecting payment.'; end if;
      update public.booking set status = 'CONFIRMED', payment_status = 'PAID', payment_method = 'CASH', paid_at = now(), collected_by_uid = actor_uid, updated_at = now() where id = b.id;
      update public.booking_passenger bp set ticket_status = 'ISSUED', issued_at = now() where bp.booking_id = b.id and bp.ticket_status = 'PENDING';
      insert into public.notification(owner_uid, title, message, category) values (b.owner_uid, 'Payment received', 'Your passenger e-tickets are ready in My Bookings.', 'BOOKING');
      result := '{}';
    when 'CancelMyBooking', 'AdminCancelBooking' then
      select * into b from public.booking where id = coalesce(args->>'bookingId', args->>'id')::uuid for update;
      if not found or (operation = 'CancelMyBooking' and b.owner_uid <> actor_uid) then raise exception 'Booking was not found.'; end if;
      select * into s from public.sailing where code = b.sailing_code for update;
      if b.status not in ('PENDING','CONFIRMED') or b.payment_status <> 'UNPAID' or s.departure_at <= now() then raise exception 'Only unpaid bookings before departure can be cancelled.'; end if;
      update public.booking set status = 'CANCELLED', updated_at = now() where id = b.id;
      -- Use the stored count and sailing, never caller-supplied seat counts.
      update public.sailing set available_seats = available_seats + b.passenger_count, updated_at = now() where code = b.sailing_code;
      result := '{}';
    when 'CheckInTicket', 'BoardTicket' then
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid;
      if not found then raise exception 'Ticket was not found.'; end if;
      select * into b from public.booking where id = p.booking_id for update;
      select * into s from public.sailing where code = b.sailing_code for update;
      select * into p from public.booking_passenger where id = (args->>'passengerId')::uuid for update;
      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then
        if p.ticket_status <> 'ISSUED' or s.status not in ('SCHEDULED','BOARDING') or (s.status <> 'BOARDING' and s.departure_at <= now()) then raise exception 'Only issued tickets on active trips can check in.'; end if;
        update public.booking_passenger set ticket_status = 'CHECKED_IN', checked_in_at = now() where id = p.id;
        new_status := 'CHECKED_IN';
      else
        if p.ticket_status <> 'CHECKED_IN' or s.status <> 'BOARDING' then raise exception 'Check in first and set the trip to BOARDING.'; end if;
        update public.booking_passenger set ticket_status = 'BOARDED', boarded_at = now() where id = p.id;
        new_status := 'BOARDED';
      end if;
      insert into public.boarding_event(passenger_id, staff_uid, event_type) values (p.id, actor_uid, new_status);
      result := '{}';
    when 'AdminReports' then
      result := barkolink_private.reports(args);
    else
      is_walk_in := operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn');
      if operation !~ '^ReserveSailing[1-8]$' and not is_walk_in then raise exception 'Unknown database operation.'; end if;
      passenger_count := case when is_walk_in then 1 else right(operation, 1)::integer end;
      if is_walk_in and args->>'method' is distinct from 'CASH' then raise exception 'Walk-in payment must be cash.'; end if;
      owner_id := case when operation = 'TicketingCreateGuestWalkIn' then args->>'guestUid' when is_walk_in then args->>'ownerUid' else actor_uid end;
      -- Reference is the idempotency key, serialized before seat changes.
      perform pg_advisory_xact_lock(hashtextextended(args->>'reference', 0));
      select * into b from public.booking where reference = args->>'reference';
      if found then
        if b.owner_uid <> owner_id or b.sailing_code <> args->>'sailingCode' or b.passenger_count <> passenger_count or b.status = 'CANCELLED' then raise exception 'Booking reference is already in use.'; end if;
        return jsonb_build_object('booking_insert', jsonb_build_object('id', b.id));
      end if;
      select * into s from public.sailing where code = args->>'sailingCode' for update;
      if not found or s.status <> 'SCHEDULED' or s.departure_at <= now() or s.available_seats < passenger_count then raise exception 'This sailing no longer has enough available seats.'; end if;
      if operation = 'TicketingCreateGuestWalkIn' then
        insert into public.app_user(uid, email, full_name, phone, role) values (owner_id, args->>'guestEmail', trim(args->>'passengerName'), args->>'passengerPhone', 'WALK_IN');
      elsif not exists (select 1 from public.app_user where uid = owner_id and role = 'PASSENGER') then
        raise exception 'Choose a passenger account.';
      end if;
      for i in 1..passenger_count loop
        person := case when is_walk_in then jsonb_build_object('full_name', trim(args->>'passengerName'), 'passenger_type', args->>'passengerType',
          'birth_date', args->>'birthDate', 'sex', args->>'sex', 'phone', args->>'passengerPhone', 'nationality', args->>'nationality')
        else jsonb_build_object('full_name', trim(args->>('passenger' || i || 'Name')), 'passenger_type', args->>('passenger' || i || 'Type'),
          'birth_date', args->>('passenger' || i || 'BirthDate'), 'sex', args->>('passenger' || i || 'Sex'),
          'phone', args->>('passenger' || i || 'Phone'), 'nationality', args->>('passenger' || i || 'Nationality')) end;
        fare_value := barkolink_private.fare(s, person->>'passenger_type');
        if is_walk_in and fare_value < s.regular_fare and (not coalesce((args->>'discountVerified')::boolean,false) or length(trim(coalesce(args->>'verificationNote',''))) not between 3 and 160) then raise exception 'Check the discount eligibility and enter a verification note before issuing a discounted walk-in ticket.'; end if;
        fare_total := fare_total + fare_value;
        passenger_list := passenger_list || jsonb_build_array(person || jsonb_build_object('fare', fare_value));
      end loop;
      insert into public.booking(reference, owner_uid, sailing_code, passenger_count, passenger_fare_total, total, status, booking_channel, payment_status, payment_method, paid_at, collected_by_uid, payment_deadline)
      values (args->>'reference', owner_id, s.code, passenger_count, fare_total, fare_total,
        case when is_walk_in then 'CONFIRMED' else 'PENDING' end, case when is_walk_in then 'WALK_IN' else 'ONLINE' end,
        case when is_walk_in then 'PAID' else 'UNPAID' end, case when is_walk_in then 'CASH' end,
        case when is_walk_in then now() end, case when is_walk_in then actor_uid end, case when not is_walk_in then least(s.departure_at,now() + make_interval(mins => (select reservation_minutes from public.operation_settings where id))) end) returning id into booking_id;
      for person in select value from jsonb_array_elements(passenger_list) loop
        insert into public.booking_passenger(booking_id, full_name, passenger_type, birth_date, sex, phone, nationality, fare, ticket_status, ticket_code)
        values (booking_id, person->>'full_name', person->>'passenger_type', nullif(person->>'birth_date','')::date,
          person->>'sex', person->>'phone', person->>'nationality', (person->>'fare')::integer,
          case when is_walk_in then 'ISSUED' else 'PENDING' end,
          case when operation = 'TicketingCreateGuestWalkIn' then (args->>'ticketCode')::uuid else gen_random_uuid() end);
      end loop;
      if is_walk_in and coalesce((args->>'discountVerified')::boolean,false) then
        update public.booking_passenger set discount_verified_at=now(),discount_verified_by_uid=actor_uid,discount_verification_note=trim(args->>'verificationNote') where booking_passenger.booking_id=(select bb.id from public.booking bb where bb.reference=args->>'reference') and fare<s.regular_fare;
      end if;
      update public.sailing set available_seats = available_seats - passenger_count, updated_at = now() where code = s.code;
      insert into public.notification(owner_uid, title, message, category)
      values (owner_id, case when is_walk_in then 'Walk-in ticket issued' else 'Reservation awaiting payment' end,
        case when is_walk_in then 'Your walk-in ticket has been issued.' else 'Pay at the ticketing desk to receive your e-ticket.' end, 'BOOKING');
      result := jsonb_build_object('booking_insert', jsonb_build_object('id', booking_id));
  end case;
  return result;
end $$;


revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 009_experience_upgrade.sql
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


-- 010_atomic_profile.sql
-- Update the application profile and Auth display name together, preserving roles and other metadata.
create function barkolink_private.save_profile(args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
declare name_value text := regexp_replace(trim(args->>'fullName'),'\s+',' ','g');
  phone_value text := nullif(regexp_replace(trim(coalesce(args->>'phone','')),'[-()[:space:]]','','g'),'');
begin
  if actor_uid is null or actor_uid='' then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  if actor_role is null or actor_role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then raise exception 'Invalid access role.' using errcode='42501'; end if;
  if name_value is null or length(name_value) not between 1 and 120 then raise exception 'Enter your full name using 1 to 120 characters.'; end if;
  if phone_value is not null and phone_value !~ '^\+?[0-9]{7,15}$' then raise exception 'Enter a valid contact number with 7 to 15 digits, optionally starting with +.'; end if;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('fullName',name_value)
    where id::text=actor_uid;
  if not found then raise exception 'Account was not found.' using errcode='42501'; end if;
  update public.app_user set full_name=name_value,phone=phone_value,updated_at=now() where uid=actor_uid;
  if not found then raise exception 'Profile was not found.'; end if;
  return jsonb_build_object('user_update',jsonb_build_object('uid',actor_uid));
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
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_experience(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 011_workspace_audit.sql
-- Add server-side audit search before pagination; preserve the existing dispatchers.
create index activity_log_action_created_idx on public.activity_log(action, created_at desc, id);
create function barkolink_private.execute_workspace(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb; search_text text; action_filter text; start_at timestamptz; end_at timestamptz;
  page_number integer; page_size integer;
begin
  if operation <> 'AdminAuditLog' then
    return barkolink_private.execute_experience(operation,args,actor_uid,actor_role);
  end if;
  if actor_uid is null or actor_uid = '' or actor_role is distinct from 'ADMIN' then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  search_text := lower(trim(coalesce(args->>'search','')));
  action_filter := nullif(trim(args->>'action'),'');
  if length(search_text)>120 or length(coalesce(action_filter,''))>80 then raise exception 'Search is too long.'; end if;
  page_number := coalesce((args->>'page')::integer,0);
  page_size := coalesce((args->>'pageSize')::integer,30);
  if page_number<0 or page_number>100000 or page_size<1 or page_size>100 then raise exception 'Invalid records page.'; end if;
  start_at := nullif(args->>'fromDate','')::date::timestamp at time zone 'Asia/Manila';
  end_at := (nullif(args->>'toDate','')::date + 1)::timestamp at time zone 'Asia/Manila';
  if start_at is not null and end_at is not null and start_at>=end_at then raise exception 'Choose a valid date range.'; end if;
  with filtered as materialized (
    select a.*,coalesce(u.full_name,'System') as actor_name from public.activity_log a
    left join public.app_user u on u.uid=a.actor_uid
    where (action_filter is null or a.action=action_filter)
      and (start_at is null or a.created_at>=start_at) and (end_at is null or a.created_at<end_at)
      and (search_text='' or strpos(lower(concat_ws(' ',u.full_name,a.action,a.entity_type,a.entity_id)),search_text)>0)
  ), records_page as (
    select * from filtered order by created_at desc,id desc limit page_size offset page_number*page_size
  )
  select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from records_page p),'[]'::jsonb),
    'totalCount',(select count(*) from filtered),
    'actions',(select coalesce(jsonb_agg(action order by action),'[]'::jsonb) from (select distinct action from public.activity_log) actions)) into result;
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
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_workspace(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema barkolink_private from public, anon, authenticated;


-- 012_accommodation_inventory.sql
-- Vessel classes with independent inventory and snapshotted per-passenger surcharges.
create table public.accommodation (
  id uuid primary key default gen_random_uuid(), vessel_id uuid not null references public.vessel,
  name text not null check(length(trim(name)) between 1 and 60),
  description text not null default '' check(length(description)<=500),
  capacity integer not null check(capacity>0), surcharge integer not null default 0 check(surcharge between 0 and 1000000),
  is_active boolean not null default true, unique(vessel_id,name)
);
alter table public.booking add column accommodation_id uuid references public.accommodation;
alter table public.booking add column accommodation_name text;
alter table public.booking add column accommodation_surcharge integer not null default 0 check(accommodation_surcharge>=0);
create index booking_accommodation_idx on public.booking(accommodation_id,sailing_code) where status in ('PENDING','CONFIRMED');
alter table public.accommodation enable row level security;
revoke all on public.accommodation from anon,authenticated;
grant all on public.accommodation to service_role;

create or replace function barkolink_private.sailing_json(s public.sailing) returns jsonb
language sql stable set search_path='' as $$
  select to_jsonb(s)||jsonb_build_object(
    'origin',(select to_jsonb(p) from public.port p where p.id=s.origin_port_id),
    'destination',(select to_jsonb(p) from public.port p where p.id=s.destination_port_id),
    'vessel',(select to_jsonb(v) from public.vessel v where v.id=s.vessel_id),
    'accommodations',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('availableSeats',
      least(s.available_seats,greatest(0,a.capacity-coalesce((select sum(b.passenger_count) from public.booking b
        where b.sailing_code=s.code and b.accommodation_id=a.id and b.status in ('PENDING','CONFIRMED')),0)))) order by a.surcharge,a.name),'[]')
      from public.accommodation a where a.vessel_id=s.vessel_id and a.is_active))
$$;

create function barkolink_private.execute_accommodation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.sailing; locked_sailing public.sailing; a public.accommodation; existing public.booking; result jsonb; wanted uuid;
  requested_count integer; booking_id uuid; record_id uuid; allocated integer; vessel_id_value uuid;
begin
  if operation in ('AdminUpdateVessel','AdminCreateSailing','AdminUpdateUnbookedSailing') and actor_role='ADMIN' then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(args->>'vesselId',args->>'id'),42));
    return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
  end if;
  if operation='AdminAccommodations' or operation='AdminSaveAccommodation' then
    if actor_uid is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminAccommodations' then
      return jsonb_build_object('accommodations',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('vesselName',v.name) order by v.name,a.surcharge,a.name),'[]')
        from public.accommodation a join public.vessel v on v.id=a.vessel_id));
    end if;
    vessel_id_value:=(args->>'vesselId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(vessel_id_value::text,42));
    if not exists(select 1 from public.vessel where id=vessel_id_value and is_active) then raise exception 'Choose an active vessel.'; end if;
    record_id:=nullif(args->>'id','')::uuid;
    if record_id is not null then
      select * into a from public.accommodation where id=record_id;
      if not found or a.vessel_id<>vessel_id_value then raise exception 'Accommodation was not found for this vessel.'; end if;
    end if;
    select coalesce(sum(capacity),0) into allocated from public.accommodation where vessel_id=vessel_id_value and is_active and id is distinct from record_id;
    if coalesce((args->>'isActive')::boolean,true) and allocated+(args->>'capacity')::integer>(select passenger_capacity from public.vessel where id=vessel_id_value) then
      raise exception 'Accommodation capacities must fit within the vessel capacity.';
    end if;
    if exists(select 1 from public.booking where accommodation_id=record_id and status in ('PENDING','CONFIRMED')
      group by sailing_code having sum(passenger_count)>(args->>'capacity')::integer) then raise exception 'Capacity cannot be below seats already reserved in this class.'; end if;
    if record_id is null then
      insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(vessel_id_value,trim(args->>'name'),coalesce(args->>'description',''),(args->>'capacity')::integer,(args->>'surcharge')::integer,coalesce((args->>'isActive')::boolean,true)) returning id into record_id;
    else
      update public.accommodation set name=trim(args->>'name'),description=coalesce(args->>'description',''),capacity=(args->>'capacity')::integer,
        surcharge=(args->>'surcharge')::integer,is_active=coalesce((args->>'isActive')::boolean,true) where id=record_id;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'ACCOMMODATION_SAVED','accommodation',record_id::text,jsonb_build_object('name',trim(args->>'name'),'capacity',(args->>'capacity')::integer,'surcharge',(args->>'surcharge')::integer));
    return jsonb_build_object('id',record_id);
  end if;
  if operation ~ '^ReserveSailing[1-8]$' or operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn') then
    if actor_uid is null or actor_uid='' or (operation like 'Reserve%' and actor_role is distinct from 'PASSENGER')
      or (operation like 'Ticketing%' and coalesce(actor_role,'') not in ('TICKETING','ADMIN')) then raise exception 'Booking access required.' using errcode='42501'; end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    -- The same lock order applies to class edits, bookings, and vessel capacity updates.
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    select * into locked_sailing from public.sailing where code=s.code for update;
    if locked_sailing.vessel_id is distinct from s.vessel_id then raise exception 'The trip vessel changed. Refresh the trip and try again.'; end if;
    s:=locked_sailing;
    wanted:=nullif(args->>'accommodationId','')::uuid;
    select * into existing from public.booking where reference=args->>'reference';
    if found then
      if existing.accommodation_id is distinct from wanted then raise exception 'Booking reference already uses a different accommodation.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    if wanted is null then
      if exists(select 1 from public.accommodation where vessel_id=s.vessel_id and is_active) then raise exception 'Choose an accommodation class for this trip.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    select * into a from public.accommodation where id=wanted and vessel_id=s.vessel_id and is_active;
    if not found then raise exception 'Choose an available accommodation for this vessel.'; end if;
    requested_count:=case when operation like 'Ticketing%' then 1 else right(operation,1)::integer end;
    select coalesce(sum(b.passenger_count),0) into allocated from public.booking b where b.sailing_code=s.code and b.accommodation_id=wanted and b.status in ('PENDING','CONFIRMED');
    if allocated+requested_count>a.capacity then raise exception 'This accommodation no longer has enough available seats.'; end if;
    result:=barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    booking_id:=(result->'booking_insert'->>'id')::uuid;
    update public.booking set accommodation_id=a.id,accommodation_name=a.name,accommodation_surcharge=a.surcharge,
      service_fee=requested_count*a.surcharge,total=passenger_fare_total+requested_count*a.surcharge where id=booking_id;
    return result;
  end if;
  return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
end $$;

create function barkolink_private.check_accommodation_capacity() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,42));
  if (select coalesce(sum(capacity),0) from public.accommodation where vessel_id=new.id and is_active)>new.passenger_capacity then
    raise exception 'Vessel capacity cannot be below its allocated accommodation seats.';
  end if;
  return new;
end $$;
create trigger accommodation_vessel_capacity before update of passenger_capacity on public.vessel for each row execute function barkolink_private.check_accommodation_capacity();
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 013_base44_workspaces.sql
create table public.ferry_route (
  id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code)) between 1 and 30),
  origin_port_id uuid not null references public.port, destination_port_id uuid not null references public.port,
  duration_minutes integer not null check(duration_minutes between 1 and 10080), is_active boolean not null default true,
  check(origin_port_id<>destination_port_id),unique(origin_port_id,destination_port_id)
);
create table public.notification_campaign (
  id uuid primary key, title text not null check(length(trim(title)) between 3 and 120), message text not null check(length(trim(message)) between 3 and 2000),
  audience text not null check(audience in ('PASSENGERS','STAFF','ALL','TRIP')), sailing_code text references public.sailing,
  sent_by_uid text not null, recipient_count integer not null default 0, created_at timestamptz not null default now(),
  check((audience='TRIP')=(sailing_code is not null))
);
alter table public.notification add column campaign_id uuid references public.notification_campaign;
create unique index notification_campaign_owner_idx on public.notification(campaign_id,owner_uid) where campaign_id is not null;
do $$ declare t text; begin foreach t in array array['ferry_route','notification_campaign'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
end loop; end $$;

create function barkolink_private.notification_recipients(audience text,sailing_code text)
returns table(uid text) language sql stable set search_path='' as $$
  select u.uid from public.app_user u where
    (audience='PASSENGERS' and u.role='PASSENGER') or (audience='STAFF' and u.role in ('TICKETING','BOARDING','ADMIN'))
    or (audience='ALL' and u.role in ('PASSENGER','TICKETING','BOARDING','ADMIN'))
    or (audience='TRIP' and u.role='PASSENGER' and exists(select 1 from public.booking b where b.owner_uid=u.uid and b.sailing_code=$2 and b.status in ('PENDING','CONFIRMED')))
$$;

create function barkolink_private.execute_workspaces(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_column
declare result jsonb; s public.sailing; record_id uuid; changed integer; campaign public.notification_campaign;
  audience_value text; code_value text; page_number integer; search_text text;
  today date:=(now() at time zone 'Asia/Manila')::date;
begin
  if operation not in ('AdminOverview','StaffSailings','StaffPassengers','StaffFares','StaffNoShows','StaffMarkNoShow',
    'AdminRoutes','AdminSaveRoute','AdminNotificationCampaigns','AdminNotificationRecipients','AdminSendNotification','StaffDashboard') then
    return barkolink_private.execute_accommodation(operation,args,actor_uid,actor_role);
  end if;
  if actor_uid is null or actor_uid='' or coalesce(actor_role,'') not in ('ADMIN','TICKETING','BOARDING') then raise exception 'Staff access required.' using errcode='42501'; end if;
  if operation like 'Admin%' and actor_role<>'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation in ('StaffNoShows','StaffMarkNoShow') and actor_role not in ('ADMIN','BOARDING') then raise exception 'Boarding access required.' using errcode='42501'; end if;
  if operation in ('StaffPassengers','StaffFares') and actor_role not in ('ADMIN','TICKETING') then raise exception 'Ticketing access required.' using errcode='42501'; end if;
  page_number:=coalesce((args->>'page')::integer,0); search_text:=lower(trim(coalesce(args->>'search','')));
  if page_number<0 or page_number>100000 or length(search_text)>120 then raise exception 'Invalid records search.'; end if;
  case operation
    when 'StaffSailings' then
      with filtered as (select s.* from public.sailing s join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id
        where (coalesce(args->>'status','')='' or s.status=args->>'status') and (search_text='' or strpos(lower(concat_ws(' ',s.code,o.name,d.name)),search_text)>0))
      select jsonb_build_object('sailings',(select coalesce(jsonb_agg(barkolink_private.sailing_json(p) order by p.departure_at desc),'[]') from (select * from filtered order by departure_at desc,code limit 30 offset page_number*30) p),
        'totalCount',(select count(*) from filtered)) into result;
    when 'StaffPassengers' then
      with filtered as (select p.* from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where (nullif(args->>'sailingCode','') is null or b.sailing_code=args->>'sailingCode')
        and (search_text='' or strpos(lower(concat_ws(' ',p.full_name,b.reference,p.ticket_code::text)),search_text)>0))
      select jsonb_build_object('passengers',(select coalesce(jsonb_agg(barkolink_private.passenger_json(p)),'[]') from (select * from filtered order by created_at desc,id limit 30 offset page_number*30) p),
        'totalCount',(select count(*) from filtered)) into result;
    when 'StaffFares' then
      result:=jsonb_build_object('fares',(select coalesce(jsonb_agg(jsonb_build_object('vesselName',v.name,'regularFare',f.regular_fare,'studentDiscount',f.student_discount,'seniorDiscount',f.senior_discount,'childDiscount',f.child_discount,'pwdDiscount',f.pwd_discount,'pregnantDiscount',f.pregnant_discount,
        'accommodations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.surcharge,a.name),'[]') from public.accommodation a where a.vessel_id=v.id and a.is_active)) order by v.name),'[]')
        from public.vessel v join public.fare_settings f on f.code=v.id::text where v.is_active));
    when 'StaffDashboard' then
      result:=jsonb_build_object('bookings',(select count(*) from public.booking),'paid',(select count(*) from public.booking where payment_status='PAID' and status='CONFIRMED'),
        'unpaid',(select count(*) from public.booking where payment_status='UNPAID' and status in ('PENDING','CONFIRMED')),
        'trips',(select count(*) from public.sailing where status in ('SCHEDULED','BOARDING','DELAYED') and departure_at>=today::timestamp at time zone 'Asia/Manila'));
    when 'StaffNoShows' then
      result:=jsonb_build_object('passengers',(select coalesce(jsonb_agg(barkolink_private.passenger_json(p)||jsonb_build_object('noShow',n.passenger_id is not null) order by p.full_name,p.id),'[]')
        from public.booking_passenger p join public.booking b on b.id=p.booking_id left join public.passenger_no_show n on n.passenger_id=p.id
        where b.sailing_code=args->>'sailingCode' and b.status='CONFIRMED' and b.payment_status='PAID' and p.ticket_status<>'BOARDED'),
        'sailing',(select barkolink_private.sailing_json(s) from public.sailing s where s.code=args->>'sailingCode'));
    when 'StaffMarkNoShow' then
      select * into s from public.sailing where code=args->>'sailingCode' for update;
      if not found or s.status<>'COMPLETED' or s.departure_at>now() then raise exception 'Complete the departed trip before recording no-shows.'; end if;
      insert into public.passenger_no_show(passenger_id,marked_by_uid)
        select p.id,actor_uid from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where b.sailing_code=s.code and b.status='CONFIRMED' and b.payment_status='PAID' and p.ticket_status in ('ISSUED','CHECKED_IN')
          and (nullif(args->>'passengerId','') is null or p.id=(args->>'passengerId')::uuid)
        on conflict(passenger_id) do nothing;
      get diagnostics changed=row_count;
      if changed>0 then insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'NO_SHOW_RECONCILED','sailing',s.code,jsonb_build_object('marked',changed)); end if;
      result:=jsonb_build_object('marked',changed);
    when 'AdminRoutes' then
      result:=jsonb_build_object('routes',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('origin',to_jsonb(o),'destination',to_jsonb(d)) order by r.code),'[]')
        from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id));
    when 'AdminSaveRoute' then
      if not exists(select 1 from public.port where id=(args->>'originPortId')::uuid and is_active) or not exists(select 1 from public.port where id=(args->>'destinationPortId')::uuid and is_active) then raise exception 'Choose active ports.'; end if;
      record_id:=nullif(args->>'id','')::uuid;
      if record_id is null then
        insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes,is_active) values(trim(args->>'code'),(args->>'originPortId')::uuid,(args->>'destinationPortId')::uuid,(args->>'durationMinutes')::integer,coalesce((args->>'isActive')::boolean,true)) returning id into record_id;
      else
        update public.ferry_route set code=trim(args->>'code'),origin_port_id=(args->>'originPortId')::uuid,destination_port_id=(args->>'destinationPortId')::uuid,duration_minutes=(args->>'durationMinutes')::integer,is_active=coalesce((args->>'isActive')::boolean,true) where id=record_id;
        if not found then raise exception 'Route was not found.'; end if;
      end if;
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'ROUTE_SAVED','ferry_route',record_id::text,jsonb_build_object('code',args->>'code'));
      result:=jsonb_build_object('id',record_id);
    when 'AdminNotificationCampaigns' then
      result:=jsonb_build_object('campaigns',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]') from (select * from public.notification_campaign order by created_at desc limit 30 offset page_number*30) c), 'totalCount',(select count(*) from public.notification_campaign));
    when 'AdminNotificationRecipients','AdminSendNotification' then
      audience_value:=args->>'audience'; code_value:=nullif(args->>'sailingCode','');
      if audience_value not in ('PASSENGERS','STAFF','ALL','TRIP') or audience_value is null or (audience_value='TRIP') is distinct from (code_value is not null) then raise exception 'Choose a notification audience.'; end if;
      select count(*) into changed from barkolink_private.notification_recipients(audience_value,code_value);
      if operation='AdminNotificationRecipients' then return jsonb_build_object('recipients',changed); end if;
      if changed>5000 then raise exception 'Choose a smaller notification audience (up to 5,000 accounts).'; end if;
      record_id:=(args->>'requestId')::uuid;
      if record_id is null then raise exception 'Notification request is missing.'; end if;
      perform pg_advisory_xact_lock(hashtextextended(record_id::text,99));
      select * into campaign from public.notification_campaign where id=record_id;
      if found then
        if campaign.title<>trim(args->>'title') or campaign.message<>trim(args->>'message') or campaign.audience<>audience_value or campaign.sailing_code is distinct from code_value then raise exception 'This notification request already contains different content.'; end if;
        return jsonb_build_object('sent',campaign.recipient_count);
      end if;
      insert into public.notification_campaign(id,title,message,audience,sailing_code,sent_by_uid) values(record_id,trim(args->>'title'),trim(args->>'message'),audience_value,code_value,actor_uid);
      insert into public.notification(owner_uid,title,message,category,campaign_id) select uid,trim(args->>'title'),trim(args->>'message'),'GENERAL',record_id from barkolink_private.notification_recipients(audience_value,code_value);
      get diagnostics changed=row_count;
      update public.notification_campaign set recipient_count=changed where id=record_id;
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'NOTIFICATION_SENT','notification_campaign',record_id::text,jsonb_build_object('title',trim(args->>'title'),'recipients',changed));
      result:=jsonb_build_object('sent',changed);
    when 'AdminOverview' then
      with day_trips as (select * from public.sailing where (departure_at at time zone 'Asia/Manila')::date=today), active_passengers as (
        select p.* from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.sailing_code in (select code from day_trips) and b.status in ('PENDING','CONFIRMED'))
      select jsonb_build_object('stats',jsonb_build_object('todayTrips',(select count(*) from day_trips),'todayBookings',(select count(*) from public.booking where (created_at at time zone 'Asia/Manila')::date=today),
        'todayPassengers',(select count(*) from active_passengers),'checkedIn',(select count(*) from active_passengers where ticket_status in ('CHECKED_IN','BOARDED')),
        'boarded',(select count(*) from active_passengers where ticket_status='BOARDED'),'noShow',(select count(*) from public.passenger_no_show n join active_passengers p on p.id=n.passenger_id),
        'cancelled',(select count(*) from public.booking where status='CANCELLED' and (updated_at at time zone 'Asia/Manila')::date=today),
        'utilization',coalesce((select round(100.0*sum(v.passenger_capacity-s.available_seats)/nullif(sum(v.passenger_capacity),0),1) from day_trips s join public.vessel v on v.id=s.vessel_id where s.status<>'CANCELLED'),0)),
        'trips',(select coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at),'[]') from day_trips s),
        'monthly',(select coalesce(jsonb_agg(jsonb_build_object('month',to_char(m,'Mon'),'bookings',(select count(*) from public.booking b where date_trunc('month',b.created_at at time zone 'Asia/Manila')=m),'passengers',(select coalesce(sum(passenger_count),0) from public.booking b where date_trunc('month',b.created_at at time zone 'Asia/Manila')=m)) order by m),'[]') from generate_series(date_trunc('month',today::timestamp)-interval '5 months',date_trunc('month',today::timestamp),interval '1 month') m),
        'bookingStatus',(select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'value',q.total)),'[]') from (select case when b.status='CONFIRMED' and s.status='COMPLETED' then 'Completed' else initcap(b.status) end name,count(*) total from public.booking b join public.sailing s on s.code=b.sailing_code group by 1 order by 1) q),
        'categories',(select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'value',q.total)),'[]') from (select p.passenger_type name,count(*) total from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.status='CONFIRMED' and b.payment_status='PAID' group by 1 order by 1) q),
        'routes',(select coalesce(jsonb_agg(jsonb_build_object('route',q.route,'passengers',q.total) order by q.total desc),'[]') from (select o.city||' → '||d.city route,sum(b.passenger_count) total from public.booking b join public.sailing s on s.code=b.sailing_code join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id where b.status in ('PENDING','CONFIRMED') group by 1 order by 2 desc limit 5) q)) into result;
  end case;
  return result;
end $$;
create or replace function public.barkolink_execute(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_uid text; actor_role text:='PASSENGER'; begin
  actor_uid:=auth.uid()::text;
  if operation is null or length(operation)>80 or args is null or jsonb_typeof(args)<>'object' then raise exception 'Invalid database request.'; end if;
  if actor_uid is not null then select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid; if not found then raise exception 'Account was not found.' using errcode='42501'; end if; end if;
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  perform barkolink_private.expire_reservations();
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_workspaces(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon,authenticated,service_role;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 014_accommodation_alias_fix.sql
-- Keep the selected row variable distinct from SQL table aliases.
-- Replaces only the dispatcher; existing inventory and bookings are preserved.
create or replace function barkolink_private.execute_accommodation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.sailing; locked_sailing public.sailing; selected_accommodation public.accommodation; existing public.booking; result jsonb; wanted uuid;
  requested_count integer; booking_id uuid; record_id uuid; allocated integer; vessel_id_value uuid;
begin
  if operation in ('AdminUpdateVessel','AdminCreateSailing','AdminUpdateUnbookedSailing') and actor_role='ADMIN' then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(args->>'vesselId',args->>'id'),42));
    return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
  end if;
  if operation='AdminAccommodations' or operation='AdminSaveAccommodation' then
    if actor_uid is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminAccommodations' then
      return jsonb_build_object('accommodations',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('vesselName',v.name) order by v.name,a.surcharge,a.name),'[]')
        from public.accommodation a join public.vessel v on v.id=a.vessel_id));
    end if;
    vessel_id_value:=(args->>'vesselId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(vessel_id_value::text,42));
    if not exists(select 1 from public.vessel where id=vessel_id_value and is_active) then raise exception 'Choose an active vessel.'; end if;
    record_id:=nullif(args->>'id','')::uuid;
    if record_id is not null then
      select * into selected_accommodation from public.accommodation where id=record_id;
      if not found or selected_accommodation.vessel_id<>vessel_id_value then raise exception 'Accommodation was not found for this vessel.'; end if;
    end if;
    select coalesce(sum(capacity),0) into allocated from public.accommodation where vessel_id=vessel_id_value and is_active and id is distinct from record_id;
    if coalesce((args->>'isActive')::boolean,true) and allocated+(args->>'capacity')::integer>(select passenger_capacity from public.vessel where id=vessel_id_value) then
      raise exception 'Accommodation capacities must fit within the vessel capacity.';
    end if;
    if exists(select 1 from public.booking where accommodation_id=record_id and status in ('PENDING','CONFIRMED')
      group by sailing_code having sum(passenger_count)>(args->>'capacity')::integer) then raise exception 'Capacity cannot be below seats already reserved in this class.'; end if;
    if record_id is null then
      insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(vessel_id_value,trim(args->>'name'),coalesce(args->>'description',''),(args->>'capacity')::integer,(args->>'surcharge')::integer,coalesce((args->>'isActive')::boolean,true)) returning id into record_id;
    else
      update public.accommodation set name=trim(args->>'name'),description=coalesce(args->>'description',''),capacity=(args->>'capacity')::integer,
        surcharge=(args->>'surcharge')::integer,is_active=coalesce((args->>'isActive')::boolean,true) where id=record_id;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'ACCOMMODATION_SAVED','accommodation',record_id::text,jsonb_build_object('name',trim(args->>'name'),'capacity',(args->>'capacity')::integer,'surcharge',(args->>'surcharge')::integer));
    return jsonb_build_object('id',record_id);
  end if;
  if operation ~ '^ReserveSailing[1-8]$' or operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn') then
    if actor_uid is null or actor_uid='' or (operation like 'Reserve%' and actor_role is distinct from 'PASSENGER')
      or (operation like 'Ticketing%' and coalesce(actor_role,'') not in ('TICKETING','ADMIN')) then raise exception 'Booking access required.' using errcode='42501'; end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    -- The same lock order applies to class edits, bookings, and vessel capacity updates.
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    select * into locked_sailing from public.sailing where code=s.code for update;
    if locked_sailing.vessel_id is distinct from s.vessel_id then raise exception 'The trip vessel changed. Refresh the trip and try again.'; end if;
    s:=locked_sailing;
    wanted:=nullif(args->>'accommodationId','')::uuid;
    select * into existing from public.booking where reference=args->>'reference';
    if found then
      if existing.accommodation_id is distinct from wanted then raise exception 'Booking reference already uses a different accommodation.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    if wanted is null then
      if exists(select 1 from public.accommodation where vessel_id=s.vessel_id and is_active) then raise exception 'Choose an accommodation class for this trip.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    select * into selected_accommodation from public.accommodation where id=wanted and vessel_id=s.vessel_id and is_active;
    if not found then raise exception 'Choose an available accommodation for this vessel.'; end if;
    requested_count:=case when operation like 'Ticketing%' then 1 else right(operation,1)::integer end;
    select coalesce(sum(b.passenger_count),0) into allocated from public.booking b where b.sailing_code=s.code and b.accommodation_id=wanted and b.status in ('PENDING','CONFIRMED');
    if allocated+requested_count>selected_accommodation.capacity then raise exception 'This accommodation no longer has enough available seats.'; end if;
    result:=barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    booking_id:=(result->'booking_insert'->>'id')::uuid;
    update public.booking set accommodation_id=selected_accommodation.id,accommodation_name=selected_accommodation.name,accommodation_surcharge=selected_accommodation.surcharge,
      service_fee=requested_count*selected_accommodation.surcharge,total=passenger_fare_total+requested_count*selected_accommodation.surcharge where id=booking_id;
    return result;
  end if;
  return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
end $$;

revoke all on function barkolink_private.execute_accommodation(text,jsonb,text,text) from public,anon,authenticated;


-- 015_audit_actor_roles.sql
-- Centralize settings history in Audit Logs and capture trusted actor roles for future events.
-- Existing rows retain their history; role lookup for legacy events is marked as current.
alter table public.activity_log add column actor_role text;
create function barkolink_private.capture_audit_actor_role() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.actor_uid is null then
    new.actor_role := 'SYSTEM';
  else
    select coalesce(u.raw_app_meta_data->>'role','PASSENGER') into new.actor_role
      from auth.users u where u.id::text=new.actor_uid;
    if not found then new.actor_role := 'UNKNOWN'; end if;
  end if;
  return new;
end $$;
create trigger activity_log_actor_role before insert on public.activity_log
for each row execute function barkolink_private.capture_audit_actor_role();

create or replace function barkolink_private.execute_workspace(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb; search_text text; action_filter text; entity_filter text; start_at timestamptz; end_at timestamptz;
  page_number integer; page_size integer;
begin
  if operation <> 'AdminAuditLog' then
    return barkolink_private.execute_experience(operation,args,actor_uid,actor_role);
  end if;
  if actor_uid is null or actor_uid = '' or actor_role is distinct from 'ADMIN' then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  search_text := lower(trim(coalesce(args->>'search','')));
  entity_filter := nullif(trim(args->>'entityType'),'');
  if length(coalesce(entity_filter,''))>80 then raise exception 'Record type is too long.'; end if;
  action_filter := nullif(trim(args->>'action'),'');
  if length(search_text)>120 or length(coalesce(action_filter,''))>80 then raise exception 'Search is too long.'; end if;
  page_number := coalesce((args->>'page')::integer,0);
  page_size := coalesce((args->>'pageSize')::integer,30);
  if page_number<0 or page_number>100000 or page_size<1 or page_size>100 then raise exception 'Invalid records page.'; end if;
  start_at := nullif(args->>'fromDate','')::date::timestamp at time zone 'Asia/Manila';
  end_at := (nullif(args->>'toDate','')::date + 1)::timestamp at time zone 'Asia/Manila';
  if start_at is not null and end_at is not null and start_at>=end_at then raise exception 'Choose a valid date range.'; end if;
  with filtered as materialized (
    select a.*,coalesce(u.full_name,case when a.actor_uid is null then 'System' else 'Unknown account' end) as actor_name,
      coalesce(a.actor_role,u.role,case when a.actor_uid is null then 'SYSTEM' else 'UNKNOWN' end) as resolved_actor_role,
      a.actor_role is not null as actor_role_recorded from public.activity_log a
    left join public.app_user u on u.uid=a.actor_uid
    where (entity_filter is null or a.entity_type=entity_filter)
      and (action_filter is null or a.action=action_filter)
      and (start_at is null or a.created_at>=start_at) and (end_at is null or a.created_at<end_at)
      and (search_text='' or strpos(lower(concat_ws(' ',u.full_name,coalesce(a.actor_role,u.role),a.action,a.entity_type,a.entity_id)),search_text)>0)
  ), records_page as (
    select * from filtered order by created_at desc,id desc limit page_size offset page_number*page_size
  )
  select jsonb_build_object('records',coalesce((select jsonb_agg((to_jsonb(p)-'resolved_actor_role')||jsonb_build_object('actor_role',p.resolved_actor_role) order by p.created_at desc,p.id desc) from records_page p),'[]'::jsonb),
    'totalCount',(select count(*) from filtered),
    'actions',(select coalesce(jsonb_agg(action order by action),'[]'::jsonb) from (select distinct action from public.activity_log) actions)) into result;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 016_custom_discounts.sql
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


-- 017_editable_passenger_discounts.sql
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


-- 018_admin_directory_filters.sql
-- Filter complete directories before pagination. Existing role checks are retained.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v17;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb; take integer:=least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)));
  skip integer:=greatest(0,coalesce((args->>'page')::integer,0));
  query text:=trim(coalesce(args->>'search','')); state text:=coalesce(args->>'status','ALL');
begin
  if operation in ('AdminSailings','AdminUsers','AdminPassengerRecords','AdminSailingOptions') then
    if actor_uid is null or actor_role<>'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminSailingOptions' then
      select jsonb_build_object('sailings',coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at desc),'[]')) into result from public.sailing s;
    elsif operation='AdminSailings' then
      with filtered as (select s.* from public.sailing s where (state='ALL' or s.status=state)
        and (query='' or barkolink_private.sailing_json(s)::text ilike '%'||query||'%')),
      paged as (select * from filtered order by departure_at desc,code limit take offset skip*take)
      select jsonb_build_object('sailings',coalesce((select jsonb_agg(barkolink_private.sailing_json(p) order by p.departure_at desc,p.code) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    elsif operation='AdminUsers' then
      with filtered as (select u.* from public.app_user u where u.role<>'WALK_IN' and (state='ALL' or u.role=state)
        and (query='' or concat_ws(' ',u.full_name,u.email,u.phone,u.uid) ilike '%'||query||'%')),
      paged as (select * from filtered order by created_at desc,uid limit take offset skip*take)
      select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.uid) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    else
      with filtered as (select p.* from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where (coalesce(args->>'sailingCode','ALL')='ALL' or b.sailing_code=args->>'sailingCode')
        and (not coalesce((args->>'paidOnly')::boolean,false) or (b.status='CONFIRMED' and b.payment_status='PAID'))
        and (state='ALL' or case when b.status in ('CANCELLED','EXPIRED') then b.status when b.payment_status<>'PAID' then 'PAYMENT PENDING' else p.ticket_status end=state)
        and (query='' or barkolink_private.passenger_json(p)::text ilike '%'||query||'%')),
      paged as (select * from filtered order by created_at desc,id limit take offset skip*take)
      select jsonb_build_object('bookingPassengers',coalesce((select jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc,p.id) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    end if;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v17(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;

commit;

-- 019_paymongo_test_payments.sql
-- Test payments are explicitly distinct from real cash collections.
alter table public.booking drop constraint booking_payment_method_check;
alter table public.booking add constraint booking_payment_method_check
  check (payment_method is null or payment_method in ('CASH','PAYMONGO_TEST'));

create table public.online_payment (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking,
  session_id text unique, checkout_url text,
  amount integer not null check (amount > 0),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','PAID','REVIEW')),
  provider_payment_id text unique, provider_method text,
  created_at timestamptz not null default now(), paid_at timestamptz
);
alter table public.online_payment enable row level security;
revoke all on public.online_payment from public, anon, authenticated;
grant all on public.online_payment to service_role;

-- Only the authenticated Edge Function may call these service-only RPCs.
create function public.prepare_paymongo_test(p_booking uuid, p_owner text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment;
begin
  select * into b from public.booking where id=p_booking for update;
  if not found or b.owner_uid <> p_owner then raise exception 'Booking was not found.'; end if;
  select * into s from public.sailing where code=b.sailing_code for update;
  if b.payment_status <> 'UNPAID' or b.status not in ('PENDING','CONFIRMED')
    or b.payment_deadline <= now() or s.departure_at <= now()
    or s.status not in ('SCHEDULED','BOARDING') then
    raise exception 'Only active unpaid reservations before the deadline can be paid.';
  end if;
  if exists(select 1 from public.booking_passenger where booking_id=b.id
    and fare<s.regular_fare and discount_verified_at is null) then
    raise exception 'Visit ticketing to verify discounted passengers before paying online.';
  end if;
  insert into public.online_payment(booking_id,amount) values(b.id,b.total*100)
    on conflict(booking_id) do nothing;
  select * into p from public.online_payment where booking_id=b.id;
  if p.amount <> b.total*100 then raise exception 'Fare changed. Close this checkout and pay cash at ticketing.'; end if;
  if p.status <> 'OPEN' then raise exception 'This checkout is closed. Use cash at ticketing or create a new reservation.'; end if;
  return to_jsonb(p) || jsonb_build_object('reference',b.reference);
end $$;

create function public.complete_paymongo_test(p_session text, p_payment text, p_amount integer, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment; active boolean;
begin
  -- Follow the existing booking -> sailing lock order.
  select * into p from public.online_payment where session_id=p_session;
  if not found then raise exception 'Checkout was not found.'; end if;
  select * into b from public.booking where id=p.booking_id for update;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where id=p.id for update;
  if p.amount <> p_amount or b.total*100 <> p_amount then raise exception 'Payment amount does not match.'; end if;
  if p.status in ('PAID','REVIEW') then return jsonb_build_object('status',p.status); end if;
  if b.payment_status <> 'UNPAID' then
    update public.online_payment set status='REVIEW',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
    return '{"status":"REVIEW"}'::jsonb;
  end if;
  active := b.status in ('PENDING','CONFIRMED') and b.payment_deadline>now()
    and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
  update public.online_payment set status='PAID',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
  if active then
    update public.booking set status='CONFIRMED',payment_status='PAID',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
    update public.booking_passenger set ticket_status='ISSUED',issued_at=now() where booking_id=b.id and ticket_status='PENDING';
  else
    -- Late sandbox payments never restore released seats or issue a ticket.
    if b.status in ('PENDING','CONFIRMED') then
      update public.sailing set available_seats=available_seats+b.passenger_count,updated_at=now() where code=s.code;
    end if;
    update public.booking set status='CANCELLED',payment_status='REFUND_PENDING',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
  end if;
  insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,
    'Sandbox payment confirmed',case when active then 'Test payment only; no real money moved. Your demo e-tickets are ready.'
    else 'Test payment arrived after the reservation closed. No ticket was issued and no real cash refund is due.' end,'BOOKING');
  insert into public.activity_log(action,entity_type,entity_id,details) values('PAYMONGO_TEST_PAID','booking',b.reference,
    jsonb_build_object('amount',b.total,'sessionId',p_session,'testMode',true));
  return jsonb_build_object('status','PAID','ticketIssued',active);
end $$;

-- Prevent staff from collecting cash while an online checkout can still be paid.
create function barkolink_private.guard_online_cash() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.total <> old.total or new.sailing_code <> old.sailing_code)
    and exists(select 1 from public.online_payment where booking_id=old.id and status='OPEN') then
    raise exception 'Close the online checkout before changing the fare or sailing.';
  end if;
  if new.payment_method='CASH' and new.payment_status='PAID' and old.payment_status='UNPAID'
    and exists(select 1 from public.online_payment where booking_id=old.id and status='OPEN') then
    raise exception 'Close the online checkout from the passenger payment panel before collecting cash.';
  end if;
  if old.payment_method='PAYMONGO_TEST' and new.payment_status='REFUNDED' then
    raise exception 'Sandbox payments have no real cash refund. Do not return cash for a test payment.';
  end if;
  return new;
end $$;
create trigger guard_online_cash before update on public.booking
for each row execute function barkolink_private.guard_online_cash();
revoke all on function public.prepare_paymongo_test(uuid,text), public.complete_paymongo_test(text,text,integer,text) from public, anon, authenticated;
grant execute on function public.prepare_paymongo_test(uuid,text), public.complete_paymongo_test(text,text,integer,text) to service_role;

-- 020_booking_payment_details.sql
-- Return the verified provider method alongside the existing booking fields.
-- Payment status is still controlled by the service-only confirmation RPC.
create or replace function barkolink_private.booking_json(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select barkolink_private.booking_base(b) || jsonb_build_object(
    'paymentProviderMethod', (select p.provider_method from public.online_payment p
      where p.booking_id=b.id and p.status='PAID'),
    'bookingPassengers_on_booking',
    (select coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at, p.id), '[]'::jsonb)
     from public.booking_passenger p where p.booking_id = b.id))
$$;

-- Preserve payment-provider confirmation separately from staff approval.
alter table public.booking add column payment_verified_at timestamptz;
alter table public.booking add column payment_verified_by text references public.app_user(uid);
-- Previously issued tickets stay valid. New online payments require staff approval.
update public.booking b set payment_verified_at=b.paid_at
where b.payment_method='PAYMONGO_TEST' and b.payment_status='PAID'
  and exists(select 1 from public.booking_passenger p where p.booking_id=b.id and p.ticket_status in ('ISSUED','CHECKED-IN','BOARDED'));

create or replace function barkolink_private.booking_base(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(b) || jsonb_build_object(
    'paymentVerificationRequired', b.payment_method='PAYMONGO_TEST' and b.payment_status='PAID' and b.payment_verified_at is null,
    'owner', (select to_jsonb(u) from public.app_user u where u.uid=b.owner_uid),
    'sailing', (select barkolink_private.sailing_json(s) from public.sailing s where s.code=b.sailing_code))
$$;

create or replace function barkolink_private.booking_json(b public.booking) returns jsonb
language sql stable set search_path = '' as $$
  select barkolink_private.booking_base(b) || jsonb_build_object(
    'paymentProviderMethod', (select provider_method from public.online_payment where booking_id=b.id and status='PAID'),
    'paymentTransactionId', (select provider_payment_id from public.online_payment where booking_id=b.id and status='PAID'),
    'bookingPassengers_on_booking', (select coalesce(jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at,p.id),'[]'::jsonb) from public.booking_passenger p where p.booking_id=b.id))
$$;

create or replace function public.complete_paymongo_test(p_session text, p_payment text, p_amount integer, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.booking; s public.sailing; p public.online_payment; active boolean;
begin
  select * into p from public.online_payment where session_id=p_session;
  if not found then raise exception 'Checkout was not found.'; end if;
  select * into b from public.booking where id=p.booking_id for update;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where id=p.id for update;
  if p.amount<>p_amount or b.total*100<>p_amount then raise exception 'Payment amount does not match.'; end if;
  if p.status in ('PAID','REVIEW') then return jsonb_build_object('status',p.status); end if;
  if b.payment_status<>'UNPAID' then
    update public.online_payment set status='REVIEW',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
    return '{"status":"REVIEW"}'::jsonb;
  end if;
  active := b.status in ('PENDING','CONFIRMED') and b.payment_deadline>now()
    and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
  update public.online_payment set status='PAID',provider_payment_id=p_payment,provider_method=p_method,paid_at=now() where id=p.id;
  if active then
    update public.booking set status='CONFIRMED',payment_status='PAID',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
    -- Tickets remain PENDING until an authorized ticketing staff member verifies payment.
  else
    if b.status in ('PENDING','CONFIRMED') then
      update public.sailing set available_seats=available_seats+b.passenger_count,updated_at=now() where code=s.code;
    end if;
    update public.booking set status='CANCELLED',payment_status='REFUND_PENDING',payment_method='PAYMONGO_TEST',paid_at=now(),updated_at=now() where id=b.id;
  end if;
  insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,
    'Payment received',case when active then 'Your online payment was received. Awaiting staff verification before your e-ticket is issued.'
    else 'Payment arrived after the reservation closed. Contact ticketing for assistance. No ticket was issued.' end,'BOOKING');
  insert into public.activity_log(action,entity_type,entity_id,details) values('PAYMONGO_TEST_PAID','booking',b.reference,
    jsonb_build_object('amount',b.total,'sessionId',p_session,'testMode',true,'awaitingStaffVerification',active));
  return jsonb_build_object('status','PAID','ticketIssued',false);
end $$;

create function public.verify_online_payment(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor text := auth.uid()::text; b public.booking; s public.sailing; p public.online_payment;
begin
  if actor is null or not exists(select 1 from public.app_user where uid=actor and role in ('TICKETING','ADMIN')) then
    raise exception 'Ticketing access required.' using errcode='42501';
  end if;
  select * into b from public.booking where id=p_booking for update;
  if not found then raise exception 'Booking was not found.'; end if;
  select * into s from public.sailing where code=b.sailing_code for update;
  select * into p from public.online_payment where booking_id=b.id for update;
  if b.payment_method<>'PAYMONGO_TEST' or b.payment_status<>'PAID' or p.id is null or p.status<>'PAID'
    or p.provider_payment_id is null or p.amount<>b.total*100 then
    raise exception 'A confirmed online payment is required.';
  end if;
  if b.status<>'CONFIRMED' or s.departure_at<=now() or s.status not in ('SCHEDULED','BOARDING') then
    raise exception 'Only an active booking before departure can be verified.';
  end if;
  if b.payment_verified_at is not null then return '{"verified":true}'::jsonb; end if;
  update public.booking set payment_verified_at=now(),payment_verified_by=actor,updated_at=now() where id=b.id;
  update public.booking_passenger set ticket_status='ISSUED',issued_at=now() where booking_id=b.id and ticket_status='PENDING';
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor,'ONLINE_PAYMENT_VERIFIED','booking',b.reference,jsonb_build_object('amount',b.total,'method',p.provider_method,'paymentId',p.provider_payment_id));
  insert into public.notification(owner_uid,title,message,category)
    values(b.owner_uid,'Payment verified','Staff verified your payment. Your e-ticket is now available.','BOOKING');
  return '{"verified":true}'::jsonb;
end $$;
revoke all on function public.verify_online_payment(uuid) from public, anon;
grant execute on function public.verify_online_payment(uuid) to authenticated;

create function barkolink_private.reservation_person_key(person_name text, person_type text, birth_date text, sex text, phone text, nationality text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_array(
    lower(regexp_replace(trim(coalesce(person_name,'')),'\s+',' ','g')),
    upper(trim(coalesce(person_type,''))),
    coalesce(nullif(birth_date,'')::date::text,''),
    lower(trim(coalesce(sex,''))),
    regexp_replace(coalesce(phone,''),'[^0-9]','','g'),
    lower(regexp_replace(trim(coalesce(nationality,'')),'\s+',' ','g')))
$$;

alter function barkolink_private.execute_accommodation(text,jsonb,text,text) rename to execute_accommodation_v21;
create function barkolink_private.execute_accommodation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.sailing; requested jsonb; duplicate_reference text; requested_count integer;
begin
  if operation ~ '^ReserveSailing[1-8]$' then
    if actor_uid is null or actor_uid='' or actor_role is distinct from 'PASSENGER' then
      raise exception 'Booking access required.' using errcode='42501';
    end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    -- Match the existing vessel -> reference -> sailing lock order. Concurrent
    -- requests with different references must check duplicates after serialization.
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    perform 1 from public.sailing where code=s.code for update;
    if not exists(select 1 from public.booking where reference=args->>'reference') then
      requested_count:=right(operation,1)::integer;
      select jsonb_agg(k order by k::text) into requested from (
        select barkolink_private.reservation_person_key(args->>('passenger'||n||'Name'),args->>('passenger'||n||'Type'),
          args->>('passenger'||n||'BirthDate'),args->>('passenger'||n||'Sex'),args->>('passenger'||n||'Phone'),args->>('passenger'||n||'Nationality')) as k
        from generate_series(1,requested_count) n) people;
      select b.reference into duplicate_reference from public.booking b
        where b.owner_uid=actor_uid and b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')
        and b.passenger_count=requested_count and s.departure_at>now()
        and (b.payment_status='PAID' or (b.payment_status='UNPAID' and b.payment_deadline>now()))
        and requested=(select jsonb_agg(k order by k::text) from (
          select barkolink_private.reservation_person_key(p.full_name,p.passenger_type,p.birth_date::text,p.sex,p.phone,p.nationality) k
          from public.booking_passenger p where p.booking_id=b.id) people)
        order by b.created_at,b.id limit 1;
      if duplicate_reference is not null then
        raise exception 'Duplicate booking: %. You already have an active reservation with these passenger details for this trip. Open the existing booking.',duplicate_reference;
      end if;
    end if;
  end if;
  return barkolink_private.execute_accommodation_v21(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.reservation_person_key(text,text,text,text,text,text),
  barkolink_private.execute_accommodation(text,jsonb,text,text) from public,anon,authenticated;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v22;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; pending bigint;
begin
  if operation='StaffBookings' and args->>'status' in ('ACTION_REQUIRED','AWAITING_VERIFICATION') then
    if actor_uid is null or actor_uid='' or coalesce(actor_role,'') not in ('TICKETING','ADMIN') then
      raise exception 'Ticketing access required.' using errcode='42501';
    end if;
    with filtered as (
      select b.*, (b.payment_status='PAID') as needs_verification from public.booking b join public.sailing s on s.code=b.sailing_code
      where b.status in ('PENDING','CONFIRMED') and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING')
      and ((b.payment_status='PAID' and b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null)
        or (args->>'status'='ACTION_REQUIRED' and b.payment_status='UNPAID' and b.payment_deadline>now()))
      and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%'||(args->>'search')||'%')
    ), paged as (
      select id from filtered order by needs_verification desc,created_at,id
      limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))
      offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))
    )
    select jsonb_build_object('bookings',coalesce((select jsonb_agg(barkolink_private.booking_json(b) order by (b.payment_status='PAID') desc,b.created_at,b.id)
      from public.booking b join paged p on p.id=b.id),'[]'::jsonb),'totalCount',(select count(*) from filtered)) into result;
    return result;
  end if;
  result:=barkolink_private.execute_flexible_discounts_v22(operation,args,actor_uid,actor_role);
  if operation='StaffDashboard' then
    select count(*) into pending from public.booking b join public.sailing s on s.code=b.sailing_code
      where b.status='CONFIRMED' and b.payment_status='PAID' and b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null
      and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
    result:=result || jsonb_build_object('awaitingVerification',pending);
  end if;
  return result;
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;

create table public.port_weather_cache (
  port_id uuid primary key references public.port(id) on delete cascade,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.port_weather_cache enable row level security;
revoke all on public.port_weather_cache from public,anon,authenticated;
grant all on public.port_weather_cache to service_role;

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
