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


-- 021_staff_online_payment_verification.sql
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


-- 022_prevent_duplicate_reservations.sql
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


-- 023_ticketing_payment_verification_queue.sql
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


-- 024_port_weather_cache.sql
create table public.port_weather_cache (
  port_id uuid primary key references public.port(id) on delete cascade,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.port_weather_cache enable row level security;
revoke all on public.port_weather_cache from public,anon,authenticated;
grant all on public.port_weather_cache to service_role;


-- 025_booking_vouchers.sql
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


-- 026_passenger_sailing_board.sql
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v25;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare start_at timestamptz := date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
  if operation='PassengerSailingBoard' then
    if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('PASSENGER','ADMIN','TICKETING','BOARDING') then
      raise exception 'Sign in to view the sailing board.' using errcode='42501';
    end if;
    return jsonb_build_object('updated_at',now(),'date',(now() at time zone 'Asia/Manila')::date,'sailings',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',s.code,'departure_at',s.departure_at,'arrival_at',s.arrival_at,'status',s.status,
        'origin',jsonb_build_object('id',o.id,'name',o.name,'city',o.city),
        'destination',jsonb_build_object('id',d.id,'name',d.name,'city',d.city),
        'vessel',jsonb_build_object('name',v.name)) order by s.departure_at,s.code),'[]'::jsonb)
      from public.sailing s join public.port o on o.id=s.origin_port_id
      join public.port d on d.id=s.destination_port_id join public.vessel v on v.id=s.vessel_id
      where (s.departure_at>=start_at and s.departure_at<start_at+interval '1 day')
        or (s.arrival_at>=start_at and s.arrival_at<start_at+interval '1 day')
    ));
  end if;
  return barkolink_private.execute_flexible_discounts_v25(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;


-- 027_loyalty_vouchers.sql
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


-- 028_loyalty_reward_tiers.sql
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


-- 029_verified_ticket_qr.sql
alter table public.booking_passenger add column qr_verification_token text not null
  default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));

create function barkolink_private.ticket_qr_payload(p public.booking_passenger) returns text
language sql stable set search_path='' as $$
  select jsonb_build_object('BarkoLink','Ticket v2','Name',p.full_name,
    'Date',to_char(s.departure_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI')||' Philippine time',
    'Vessel',v.name,'Route',o.name||' to '||d.name,'Booking',b.reference,
    'Ticket',p.ticket_code::text,'Verification',p.qr_verification_token)::text
  from public.booking b join public.sailing s on s.code=b.sailing_code
  join public.vessel v on v.id=s.vessel_id join public.port o on o.id=s.origin_port_id join public.port d on d.id=s.destination_port_id
  where b.id=p.booking_id and b.status='CONFIRMED' and b.payment_status='PAID'
    and (b.payment_method is distinct from 'PAYMONGO_TEST' or b.payment_verified_at is not null)
    and p.ticket_status in ('ISSUED','CHECKED_IN','BOARDED');
$$;
create or replace function barkolink_private.passenger_json(p public.booking_passenger) returns jsonb
language sql stable set search_path='' as $$
  select (to_jsonb(p)-'qr_verification_token')||jsonb_build_object('ticket_qr_payload',barkolink_private.ticket_qr_payload(p),
    'booking',(select barkolink_private.booking_base(b) from public.booking b where b.id=p.booking_id));
$$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v28;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare raw text; ticket_code_value text; payload jsonb; p public.booking_passenger; b public.booking; s public.sailing;
begin
  if operation='VerifyTicketQr' then
    if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('ADMIN','TICKETING','BOARDING') then
      raise exception 'Staff access required to verify tickets.' using errcode='42501';
    end if;
    raw:=trim(args->>'payload');
    if raw is null or length(raw)>4096 or length(raw)=0 then raise exception 'Enter a valid BarkoLink ticket QR or ticket code.'; end if;
    if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      -- Previously printed tickets and staff-entered codes still undergo live payment and sailing checks.
      ticket_code_value:=lower(raw);
    else
      begin payload:=raw::jsonb; exception when invalid_text_representation then raise exception 'This is not a valid BarkoLink ticket QR.'; end;
      if jsonb_typeof(payload)<>'object' or payload->>'BarkoLink' is distinct from 'Ticket v2' then raise exception 'This is not a valid BarkoLink ticket QR.'; end if;
      ticket_code_value:=payload->>'Ticket';
    end if;
    select * into p from public.booking_passenger where ticket_code::text=ticket_code_value;
    if not found then raise exception 'Ticket was not found. This QR cannot be used to travel.'; end if;
    select * into b from public.booking where id=p.booking_id;
    select * into s from public.sailing where code=b.sailing_code;
    if nullif(args->>'sailingCode','') is null or s.code is distinct from args->>'sailingCode' then raise exception 'This ticket belongs to a different sailing.'; end if;
    if b.status<>'CONFIRMED' or b.payment_status<>'PAID'
      or (b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null)
      or p.ticket_status not in ('ISSUED','CHECKED_IN','BOARDED') then raise exception 'This ticket is unpaid, cancelled, or not issued. Do not admit this passenger.'; end if;
    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then raise exception 'This sailing is not open for check-in or boarding.'; end if;
    if payload is not null and payload is distinct from barkolink_private.ticket_qr_payload(p)::jsonb then
      raise exception 'QR verification failed: ticket details were changed or the trip was updated. Ask the passenger to open their current BarkoLink ticket.';
    end if;
    return jsonb_build_object('passenger',barkolink_private.passenger_json(p),'already_boarded',p.ticket_status='BOARDED','legacy_code',payload is null);
  end if;
  return barkolink_private.execute_flexible_discounts_v28(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 030_chatbot_allowance.sql
create table barkolink_private.chatbot_usage (
  actor_id uuid primary key references auth.users(id) on delete cascade,
  window_at timestamptz not null,
  window_count integer not null,
  usage_day date not null,
  day_count integer not null
);
revoke all on barkolink_private.chatbot_usage from public, anon, authenticated;

create function public.consume_chatbot_allowance() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); usage barkolink_private.chatbot_usage;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then
    raise exception 'Passenger sign-in required.' using errcode='42501';
  end if;
  insert into barkolink_private.chatbot_usage values(actor,now(),1,(now() at time zone 'UTC')::date,1)
  on conflict(actor_id) do update set
    window_at=case when chatbot_usage.window_at<=now()-interval '10 minutes' then now() else chatbot_usage.window_at end,
    window_count=case when chatbot_usage.window_at<=now()-interval '10 minutes' then 1 else chatbot_usage.window_count+1 end,
    usage_day=(now() at time zone 'UTC')::date,
    day_count=case when chatbot_usage.usage_day<>(now() at time zone 'UTC')::date then 1 else chatbot_usage.day_count+1 end
  returning * into usage;
  return usage.window_count<=12 and usage.day_count<=100;
end $$;
revoke all on function public.consume_chatbot_allowance() from public,anon;
grant execute on function public.consume_chatbot_allowance() to authenticated;


-- 031_loyalty_settings.sql
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


-- 032_staff_port_access.sql
-- Terminal staff operate only on sailings DEPARTING their assigned port.
-- Existing staff remain unassigned until an administrator chooses their port.
alter table public.app_user add column assigned_port_id uuid references public.port(id);
create index app_user_assigned_port_idx on public.app_user(assigned_port_id) where assigned_port_id is not null;

create function barkolink_private.staff_port_matches(port_id uuid, actor text, actor_role text)
returns boolean language sql stable set search_path='' as $$
  select case when actor_role in ('TICKETING','BOARDING') then exists(
    select 1 from public.app_user u join public.port p on p.id=u.assigned_port_id
    where u.uid=actor and u.role=actor_role and p.is_active and p.id=port_id
  ) else true end;
$$;

create function barkolink_private.require_staff_sailing(actor text, actor_role text, sailing_code text)
returns void language plpgsql set search_path='' as $$
begin
  if actor_role not in ('TICKETING','BOARDING') then return; end if;
  -- Keep the sailing's origin fixed through the guarded operation.
  perform 1 from public.sailing s where s.code=sailing_code
    and barkolink_private.staff_port_matches(s.origin_port_id,actor,actor_role) for update;
  if not found then raise exception 'This record is outside your assigned port.' using errcode='42501'; end if;
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v31;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare assigned uuid; target_code text; ticket text; payload jsonb; target_role text;
begin
  if operation='AdminAssignStaffPort' then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then
      raise exception 'Administrator access required.' using errcode='42501';
    end if;
    assigned:=nullif(args->>'portId','')::uuid;
    if assigned is null or not exists(select 1 from public.port where id=assigned and is_active) then
      raise exception 'Choose an active staff port.';
    end if;
    select role into target_role from public.app_user where uid=args->>'uid' for update;
    if target_role is null or target_role not in ('TICKETING','BOARDING') then raise exception 'Choose a ticketing or boarding staff account.'; end if;
    update public.app_user set assigned_port_id=assigned,updated_at=now() where uid=args->>'uid';
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'STAFF_PORT_ASSIGNED','app_user',args->>'uid',jsonb_build_object('portId',assigned));
    return jsonb_build_object('uid',args->>'uid','assigned_port_id',assigned);
  end if;
  if operation='MyProfile' then
    if nullif(actor_uid,'') is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
    return jsonb_build_object('user',(select to_jsonb(u)||jsonb_build_object('assigned_port',
      (select to_jsonb(p) from public.port p where p.id=u.assigned_port_id)) from public.app_user u where u.uid=actor_uid));
  end if;
  if actor_role in ('TICKETING','BOARDING') and (
    operation like 'Staff%' or operation like 'Ticketing%' or operation like 'Boarding%'
    or operation in ('CollectBookingPayment','VerifyPassengerDiscount','RefundBooking','VerifyTicketQr','CheckInTicket','BoardTicket')
  ) then
    -- Lock assignment while the request runs; reassignment cannot race an operation.
    select assigned_port_id into assigned from public.app_user where uid=actor_uid and role=actor_role for share;
    if assigned is null or not exists(select 1 from public.port where id=assigned and is_active) then
      raise exception 'No active port is assigned to your staff account. Ask an administrator to assign your port.' using errcode='42501';
    end if;
    if operation in ('CollectBookingPayment','RefundBooking') then
      select sailing_code into target_code from public.booking where id=(args->>'bookingId')::uuid;
      perform barkolink_private.require_staff_sailing(actor_uid,actor_role,target_code);
    elsif operation in ('VerifyPassengerDiscount','CheckInTicket','BoardTicket') then
      select b.sailing_code into target_code from public.booking_passenger p join public.booking b on b.id=p.booking_id where p.id=(args->>'passengerId')::uuid;
      perform barkolink_private.require_staff_sailing(actor_uid,actor_role,target_code);
    elsif operation='VerifyTicketQr' then
      ticket:=args->>'ticketCode';
      if operation='VerifyTicketQr' then
        ticket:=trim(args->>'payload');
        if ticket is null or length(ticket)=0 or length(ticket)>4096 then raise exception 'Enter a valid BarkoLink ticket QR or ticket code.'; end if;
        if left(ticket,1)='{' then
          begin payload:=ticket::jsonb; exception when invalid_text_representation then raise exception 'This is not a valid BarkoLink ticket QR.'; end;
          if jsonb_typeof(payload)<>'object' or payload->>'BarkoLink' is distinct from 'Ticket v2' then raise exception 'This is not a valid BarkoLink ticket QR.'; end if;
          ticket:=payload->>'Ticket';
        end if;
      end if;
      select b.sailing_code into target_code from public.booking_passenger p join public.booking b on b.id=p.booking_id where p.ticket_code::text=lower(ticket);
      if target_code is null then raise exception 'Ticket was not found or is outside your assigned port.' using errcode='42501'; end if;
      perform barkolink_private.require_staff_sailing(actor_uid,actor_role,target_code);
      if nullif(args->>'sailingCode','') is not null then
        perform barkolink_private.require_staff_sailing(actor_uid,actor_role,args->>'sailingCode');
      end if;
    elsif nullif(args->>'sailingCode','') is not null then
      perform barkolink_private.require_staff_sailing(actor_uid,actor_role,args->>'sailingCode');
    end if;
  end if;
  return barkolink_private.execute_flexible_discounts_v31(operation,args,actor_uid,actor_role);
end $$;

-- Online payment verification is also callable directly, outside the dispatcher.
alter function public.verify_online_payment(uuid) rename to verify_online_payment_unscoped;
revoke all on function public.verify_online_payment_unscoped(uuid) from public,anon,authenticated;
create function public.verify_online_payment(p_booking uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; actor_role text; assigned uuid; target_code text;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id::text=actor;
  if actor is null or coalesce(actor_role,'') not in ('TICKETING','ADMIN') then
    raise exception 'Ticketing access required.' using errcode='42501';
  end if;
  if actor_role='TICKETING' then
    select assigned_port_id into assigned from public.app_user where uid=actor and role=actor_role for share;
    if assigned is null then raise exception 'Ask an administrator to assign your staff port.' using errcode='42501'; end if;
    select sailing_code into target_code from public.booking where id=p_booking;
    perform barkolink_private.require_staff_sailing(actor,actor_role,target_code);
  end if;
  return public.verify_online_payment_unscoped(p_booking);
end $$;
revoke all on function public.verify_online_payment(uuid) from public,anon;
grant execute on function public.verify_online_payment(uuid) to authenticated;

-- Existing read operations: apply port filters before pagination and counting.
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
      from (select * from public.booking b where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')
        order by created_at desc,id limit least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)))) q;
      result := result || jsonb_build_object('totalCount',(select count(*) from public.booking b where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and
        (coalesce(args->>'status','ALL')='ALL' or b.status=args->>'status' or (b.payment_status=args->>'status' and (args->>'status' <> 'UNPAID' or b.status in ('PENDING','CONFIRMED'))))
        and (coalesce(args->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%' || (args->>'search') || '%')));
    when 'TicketingPassengerAccounts' then
      select jsonb_build_object('users', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select uid, full_name, email from public.app_user where role = 'PASSENGER' and (actor_role='ADMIN' or exists(select 1 from public.booking b join public.sailing s on s.code=b.sailing_code where b.owner_uid=app_user.uid and barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role))) order by full_name limit 500) q;
    when 'TicketingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where barkolink_private.staff_port_matches(origin_port_id,actor_uid,actor_role) and status = 'SCHEDULED' and departure_at > now() and available_seats >= 1 order by departure_at limit 100) q;
    when 'BoardingSailings' then
      select jsonb_build_object('sailings', coalesce(jsonb_agg(barkolink_private.sailing_json(q)), '[]')) into result
      from (select * from public.sailing where barkolink_private.staff_port_matches(origin_port_id,actor_uid,actor_role) and status in ('SCHEDULED','BOARDING') order by departure_at limit 100) q;
    when 'BoardingManifest' then
      select jsonb_build_object('bookings', coalesce(jsonb_agg(barkolink_private.booking_json(b) order by b.created_at), '[]')) into result
      from public.booking b where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and b.sailing_code = args->>'sailingCode' and b.status = 'CONFIRMED' and b.payment_status = 'PAID';
    when 'BoardingActivity' then
      select jsonb_build_object('boardingEvents', coalesce(jsonb_agg(to_jsonb(q)), '[]')) into result
      from (select e.*, barkolink_private.passenger_json(p) as passenger from public.boarding_event e
        join public.booking_passenger p on p.id = e.passenger_id join public.booking b on b.id = p.booking_id
        where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and b.sailing_code = args->>'sailingCode' order by e.created_at desc limit 100) q;
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
create or replace function barkolink_private.execute_workspaces(operation text,args jsonb,actor_uid text,actor_role text)
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
        where barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role) and (coalesce(args->>'status','')='' or s.status=args->>'status') and (search_text='' or strpos(lower(concat_ws(' ',s.code,o.name,d.name)),search_text)>0))
      select jsonb_build_object('sailings',(select coalesce(jsonb_agg(barkolink_private.sailing_json(p) order by p.departure_at desc),'[]') from (select * from filtered order by departure_at desc,code limit 30 offset page_number*30) p),
        'totalCount',(select count(*) from filtered)) into result;
    when 'StaffPassengers' then
      with filtered as (select p.* from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and (nullif(args->>'sailingCode','') is null or b.sailing_code=args->>'sailingCode')
        and (search_text='' or strpos(lower(concat_ws(' ',p.full_name,b.reference,p.ticket_code::text)),search_text)>0))
      select jsonb_build_object('passengers',(select coalesce(jsonb_agg(barkolink_private.passenger_json(p)),'[]') from (select * from filtered order by created_at desc,id limit 30 offset page_number*30) p),
        'totalCount',(select count(*) from filtered)) into result;
    when 'StaffFares' then
      result:=jsonb_build_object('fares',(select coalesce(jsonb_agg(jsonb_build_object('vesselName',v.name,'regularFare',f.regular_fare,'studentDiscount',f.student_discount,'seniorDiscount',f.senior_discount,'childDiscount',f.child_discount,'pwdDiscount',f.pwd_discount,'pregnantDiscount',f.pregnant_discount,
        'accommodations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.surcharge,a.name),'[]') from public.accommodation a where a.vessel_id=v.id and a.is_active)) order by v.name),'[]')
        from public.vessel v join public.fare_settings f on f.code=v.id::text where v.is_active));
    when 'StaffDashboard' then
      with scoped as (select b.* from public.booking b join public.sailing s on s.code=b.sailing_code where barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role))
      select jsonb_build_object('bookings',(select count(*) from scoped),
        'paid',(select count(*) from scoped where payment_status='PAID' and status='CONFIRMED'),
        'unpaid',(select count(*) from scoped where payment_status='UNPAID' and status in ('PENDING','CONFIRMED')),
        'trips',(select count(*) from public.sailing where barkolink_private.staff_port_matches(origin_port_id,actor_uid,actor_role) and status in ('SCHEDULED','BOARDING','DELAYED') and departure_at>=today::timestamp at time zone 'Asia/Manila')) into result;
    when 'StaffNoShows' then
      result:=jsonb_build_object('passengers',(select coalesce(jsonb_agg(barkolink_private.passenger_json(p)||jsonb_build_object('noShow',n.passenger_id is not null) order by p.full_name,p.id),'[]')
        from public.booking_passenger p join public.booking b on b.id=p.booking_id left join public.passenger_no_show n on n.passenger_id=p.id
        where barkolink_private.staff_port_matches((select origin_port_id from public.sailing where code=b.sailing_code),actor_uid,actor_role) and b.sailing_code=args->>'sailingCode' and b.status='CONFIRMED' and b.payment_status='PAID' and p.ticket_status<>'BOARDED'),
        'sailing',(select barkolink_private.sailing_json(s) from public.sailing s where barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role) and s.code=args->>'sailingCode'));
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
create or replace function barkolink_private.execute_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb
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
      from public.vessel v join public.fare_settings f on f.code=v.id::text where v.is_active and (actor_role='ADMIN' or exists(select 1 from public.sailing s where s.vessel_id=v.id and barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role)))));
  end if;
  return barkolink_private.execute_workspaces(operation,args,actor_uid,actor_role);
end $$;
create or replace function barkolink_private.execute_flexible_discounts_v24(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; pending bigint;
begin
  if operation='StaffBookings' and args->>'status' in ('ACTION_REQUIRED','AWAITING_VERIFICATION') then
    if actor_uid is null or actor_uid='' or coalesce(actor_role,'') not in ('TICKETING','ADMIN') then
      raise exception 'Ticketing access required.' using errcode='42501';
    end if;
    with filtered as (
      select b.*, (b.payment_status='PAID') as needs_verification from public.booking b join public.sailing s on s.code=b.sailing_code
      where barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role) and b.status in ('PENDING','CONFIRMED') and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING')
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
      where barkolink_private.staff_port_matches(s.origin_port_id,actor_uid,actor_role) and b.status='CONFIRMED' and b.payment_status='PAID' and b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null
      and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
    result:=result || jsonb_build_object('awaitingVerification',pending);
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 033_staff_port_directory.sql
-- Separate staff assignment directory; passengers never appear here.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v32;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; query text:=trim(coalesce(args->>'search','')); staff_role text:=coalesce(args->>'role','ALL');
  take integer:=least(100,greatest(1,coalesce((args->>'pageSize')::integer,30)));
  skip integer:=greatest(0,coalesce((args->>'page')::integer,0));
begin
  if operation='AdminStaffPortAssignments' then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if length(query)>120 or staff_role not in ('ALL','TICKETING','BOARDING') or skip>100000 then raise exception 'Invalid staff directory filter.'; end if;
    with filtered as (select u.* from public.app_user u where u.role in ('TICKETING','BOARDING')
      and (staff_role='ALL' or u.role=staff_role) and (query='' or strpos(lower(concat_ws(' ',u.full_name,u.email)),lower(query))>0)),
    paged as (select * from filtered order by full_name,uid limit take offset skip*take)
    select jsonb_build_object('staff',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('assigned_port',
      (select to_jsonb(p) from public.port p where p.id=u.assigned_port_id)) order by u.full_name,u.uid) from paged u),'[]'),
      'totalCount',(select count(*) from filtered),
      'ports',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name,p.id),'[]') from public.port p where p.is_active)) into result;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v32(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 034_verified_ferry_catalog.sql
-- Reference identities and dated vessel/route assignments. This migration creates no sailings or fares.
alter table public.port add column reference_metadata jsonb;
alter table public.vessel add column reference_metadata jsonb;
alter table public.ferry_route add column reference_metadata jsonb;
alter table public.vessel alter column passenger_capacity drop not null;
alter table public.vessel add constraint active_vessel_capacity_required check (not is_active or passenger_capacity is not null);
alter table public.ferry_route alter column duration_minutes drop not null;

create table public.vessel_route (
  vessel_id uuid not null references public.vessel on delete cascade,
  route_id uuid not null references public.ferry_route on delete cascade,
  primary key(vessel_id,route_id)
);
alter table public.vessel_route enable row level security;
revoke all on public.vessel_route from public,anon,authenticated;
grant all on public.vessel_route to service_role;

create function barkolink_private.validate_reference_sailing() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.vessel v where v.id=new.vessel_id and v.reference_metadata->>'kind'='verified-reference')
    and not exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id
      where vr.vessel_id=new.vessel_id and r.origin_port_id=new.origin_port_id and r.destination_port_id=new.destination_port_id and r.is_active)
  then raise exception 'Choose a verified route assigned to this vessel.'; end if;
  return new;
end $$;
create trigger reference_sailing_route before insert or update of vessel_id,origin_port_id,destination_port_id on public.sailing
for each row execute function barkolink_private.validate_reference_sailing();

create function barkolink_private.protect_reference_route() returns trigger
language plpgsql set search_path='' as $$
begin
  if (new.origin_port_id,new.destination_port_id) is distinct from (old.origin_port_id,old.destination_port_id)
    and exists(select 1 from public.vessel_route where route_id=old.id)
  then raise exception 'Create a separate route to change verified endpoints.'; end if;
  return new;
end $$;
create trigger reference_route_endpoints before update of origin_port_id,destination_port_id on public.ferry_route
for each row execute function barkolink_private.protect_reference_route();

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v33;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  if operation in ('AdminVessels','AdminRoutes') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVessels' then
      select jsonb_build_object('vessels',coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('routes',
        (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'originPortId',r.origin_port_id,'destinationPortId',r.destination_port_id,
          'origin',o.name,'destination',d.name,'isActive',r.is_active) order by r.code),'[]')
         from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id join public.port o on o.id=r.origin_port_id
         join public.port d on d.id=r.destination_port_id where vr.vessel_id=v.id)) order by v.name),'[]')) into result from public.vessel v;
    else
      select jsonb_build_object('routes',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('origin',jsonb_build_object('name',o.name),
        'destination',jsonb_build_object('name',d.name),'vessels',
        (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator') order by v.name),'[]')
         from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id where vr.route_id=r.id)) order by r.code),'[]'))
        into result from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id;
    end if;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v33(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 035_active_sailing_ports.sql
-- Keep historical departures untouched; prevent new assignments to disabled ports.
create function barkolink_private.validate_active_sailing_ports() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.port where id=new.origin_port_id and is_active)
    or not exists(select 1 from public.port where id=new.destination_port_id and is_active)
  then raise exception 'Choose active origin and destination ports.'; end if;
  return new;
end $$;
create trigger active_sailing_ports before insert or update of origin_port_id,destination_port_id,vessel_id on public.sailing
for each row execute function barkolink_private.validate_active_sailing_ports();
revoke all on function barkolink_private.validate_active_sailing_ports() from public,anon,authenticated;


-- 036_automatic_sailing_status.sql
-- A database clock drives routine status changes even when no app is open.
-- Operator reporting deadlines and boarding cutoffs are NOT inferred boarding-start times.
alter table public.sailing add column boarding_at timestamptz;
alter table public.sailing add column boarding_time_source text;
alter table public.sailing add constraint confirmed_boarding_time check (
  (boarding_at is null and boarding_time_source is null) or
  (boarding_at is not null and boarding_time_source is not null and boarding_at<departure_at and length(trim(boarding_time_source)) between 3 and 500));
create table barkolink_private.sailing_status_policy (
  operator text primary key,boarding_lead_minutes integer check (boarding_lead_minutes between 1 and 10080),
  boarding_time_source text,auto_complete boolean not null default true,updated_at timestamptz not null default now(),
  check ((boarding_lead_minutes is null and boarding_time_source is null) or
    (boarding_lead_minutes is not null and boarding_time_source is not null and length(trim(boarding_time_source)) between 3 and 500))
);
revoke all on barkolink_private.sailing_status_policy from public,anon,authenticated;
create function barkolink_private.advance_sailing_statuses() returns integer
language plpgsql security definer set search_path='' as $$
declare trip record; target_status text; changed integer:=0; passenger_owner text;
begin
  -- Skip manual delays/cancellations and rows currently being edited by another transaction.
  for trip in select s.*,coalesce(policy.auto_complete,true) as auto_complete from public.sailing s
    join public.vessel v on v.id=s.vessel_id
    left join barkolink_private.sailing_status_policy policy on policy.operator=v.reference_metadata->>'operator'
    where s.status in ('SCHEDULED','BOARDING') and (
      (s.arrival_at<=now() and coalesce(policy.auto_complete,true)) or
      (s.status='SCHEDULED' and coalesce(s.boarding_at,s.departure_at-make_interval(mins=>policy.boarding_lead_minutes))<=now()))
    order by s.code limit 200 for update of s skip locked
  loop
    target_status:=case when trip.arrival_at<=now() and trip.auto_complete then 'COMPLETED' else 'BOARDING' end;
    update public.sailing set status=target_status,updated_at=now() where code=trip.code;
    changed:=changed+1;
    insert into public.notification(owner_uid,title,message,category)
      select distinct owner_uid,
        case when target_status='BOARDING' then 'Boarding time reached' else 'Scheduled arrival reached' end,
        'Trip '||trip.code||case when target_status='BOARDING'
          then ' has reached its operator-confirmed boarding time. Follow the terminal instructions and boarding cutoff.'
          else ' has reached its scheduled arrival and is marked Completed. Contact the operator if the voyage is delayed.' end,'TRIP'
      from public.booking where sailing_code=trip.code and status='CONFIRMED' and payment_status='PAID';
    if target_status='COMPLETED' then
      -- Preserve the existing rewards behavior; only paid, boarded trips qualify.
      for passenger_owner in select distinct owner_uid from public.booking
        where sailing_code=trip.code and status='CONFIRMED' and payment_status='PAID' order by owner_uid
      loop perform barkolink_private.issue_loyalty_vouchers(passenger_owner); end loop;
    end if;
  end loop;
  return changed;
end $$;
revoke all on function barkolink_private.advance_sailing_statuses() from public,anon,authenticated;

-- Admin can pause a boarding/in-progress trip if its actual voyage is delayed.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v35;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare trip public.sailing; notified integer; result jsonb; trip_code text; lead integer; source text;
begin
  if operation in ('AdminSailingStatusPolicies','AdminSaveSailingStatusPolicy') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminSaveSailingStatusPolicy' then
      if not exists(select 1 from public.vessel where reference_metadata->>'operator'=args->>'operator' and reference_metadata->>'kind'<>'demo-archive') then raise exception 'Choose a catalog operator.'; end if;
      lead:=nullif(args->>'boardingLeadMinutes','')::integer;
      source:=case when lead is null then null else nullif(trim(args->>'boardingTimeSource'),'') end;
      if args->>'autoComplete' is null then raise exception 'Set automatic completion.'; end if;
      insert into barkolink_private.sailing_status_policy(operator,boarding_lead_minutes,boarding_time_source,auto_complete)
        values(args->>'operator',lead,source,(args->>'autoComplete')::boolean)
        on conflict(operator) do update set boarding_lead_minutes=excluded.boarding_lead_minutes,boarding_time_source=excluded.boarding_time_source,auto_complete=excluded.auto_complete,updated_at=now();
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
        values(actor_uid,'UPDATE','sailing_status_policy',args->>'operator',jsonb_build_object('boarding_lead_minutes',lead,'auto_complete',(args->>'autoComplete')::boolean));
    end if;
    select jsonb_build_object('policies',coalesce(jsonb_agg(jsonb_build_object('operator',o.operator,'boardingLeadMinutes',p.boarding_lead_minutes,
      'boardingTimeSource',p.boarding_time_source,'autoComplete',coalesce(p.auto_complete,true)) order by o.operator),'[]')) into result
      from (select distinct reference_metadata->>'operator' as operator from public.vessel where reference_metadata->>'operator' is not null and reference_metadata->>'kind'<>'demo-archive') o
      left join barkolink_private.sailing_status_policy p on p.operator=o.operator;
    return result;
  end if;
  if operation in ('AdminUpdateUnbookedSailing','AdminRescheduleSailing') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    perform 1 from public.booking where sailing_code=args->>'code' and status in ('PENDING','CONFIRMED') order by id for update;
    -- Remove the old boarding confirmation before changing departure, in the same transaction.
    update public.sailing set boarding_at=null,boarding_time_source=null where code=args->>'code';
  end if;
  if operation='AdminUpdateSailingStatus' and args->>'status'='DELAYED' then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    select * into trip from public.sailing where code=args->>'code' for update;
    if not found then raise exception 'Sailing was not found.'; end if;
    if trip.status not in ('SCHEDULED','BOARDING') then raise exception 'Only scheduled or boarding trips can be marked Delayed.'; end if;
    update public.sailing set status='DELAYED',updated_at=now() where code=trip.code;
    insert into public.notification(owner_uid,title,message,category)
      select distinct owner_uid,'Sailing delayed','Trip '||trip.code||' is delayed. Check your booking for an updated schedule.','TRIP'
      from public.booking where sailing_code=trip.code and status in ('PENDING','CONFIRMED');
    get diagnostics notified=row_count;
    return jsonb_build_object('sailing_update',jsonb_build_object('code',trip.code),'notified',notified);
  end if;
  result:=barkolink_private.execute_flexible_discounts_v35(operation,args,actor_uid,actor_role);
  if operation in ('AdminCreateSailing','AdminUpdateUnbookedSailing','AdminRescheduleSailing') then
    trip_code:=coalesce(result->'sailing_insert'->>'code',result->'sailing_update'->>'code');
    -- Clearing unknown times is deliberate: rescheduling must not retain an old gate-opening timestamp.
    update public.sailing set boarding_at=nullif(args->>'boardingAt','')::timestamptz,
      boarding_time_source=case when nullif(args->>'boardingAt','') is null then null else nullif(trim(args->>'boardingTimeSource'),'') end
      where code=trip_code;
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;

do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-advance-sailing-statuses','* * * * *','select barkolink_private.advance_sailing_statuses();')$schedule$;
  end if;
end $$;


-- 037_generated_record_codes.sql
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


-- 038_daily_schedule_management.sql
create function barkolink_private.valid_daily_times(times text[]) returns boolean language sql immutable set search_path='' as $$
  select coalesce(cardinality(times) between 1 and 48
    and (select bool_and(t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') from unnest(times) t)
    and cardinality(times)=(select count(distinct t) from unnest(times) t),false);
$$;
create table barkolink_private.daily_schedule (
  id uuid primary key default gen_random_uuid(),
  operator text not null check(length(trim(operator)) between 1 and 100),
  route_id uuid not null references public.ferry_route(id),
  departure_times text[] not null check(barkolink_private.valid_daily_times(departure_times)),
  duration_minutes integer check(duration_minutes between 1 and 10080),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(operator,route_id)
);
revoke all on barkolink_private.daily_schedule from public,anon,authenticated;
insert into barkolink_private.daily_schedule(operator,route_id,departure_times,duration_minutes,is_active)
select item->>'operator',r.id,array(select jsonb_array_elements_text(item->'departureTimes') order by 1),
  (item->>'durationMinutes')::integer,r.is_active and o.is_active and d.is_active
from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
cross join lateral jsonb_array_elements(coalesce(r.reference_metadata->'schedules','[]')) item
where item->>'operator' is not null and jsonb_typeof(item->'departureTimes')='array'
on conflict(operator,route_id) do nothing;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v37;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare record_id uuid; route_id_value uuid; operator_value text; times_value text[]; active_value boolean; result jsonb;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    return barkolink_private.execute_flexible_discounts_v37(operation,args,actor_uid,actor_role);
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation in ('AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    if jsonb_typeof(args->'isActive') is distinct from 'boolean' then raise exception 'Choose Active or Paused.'; end if;
    active_value:=(args->>'isActive')::boolean;record_id:=nullif(args->>'id','')::uuid;
    if operation='AdminSaveDailySchedule' then
      route_id_value:=(args->>'routeId')::uuid;operator_value:=trim(args->>'operator');
      if jsonb_typeof(args->'departureTimes') is distinct from 'array' then raise exception 'Enter daily departure times.'; end if;
      times_value:=array(select jsonb_array_elements_text(args->'departureTimes') order by 1);
      if not barkolink_private.valid_daily_times(times_value) then raise exception 'Enter 1 to 48 unique departure times in HH:MM format.'; end if;
      if not exists(select 1 from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id
        where vr.route_id=route_id_value and v.reference_metadata->>'operator'=operator_value) then
        raise exception 'Choose a route served by this operator.';
      end if;
    else
      select route_id,operator into route_id_value,operator_value from barkolink_private.daily_schedule where id=record_id for update;
      if not found then raise exception 'Daily schedule was not found.'; end if;
    end if;
    if active_value and not exists(select 1 from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
      where r.id=route_id_value and r.is_active and o.is_active and d.is_active) then raise exception 'Activate the route and both ports before resuming this daily schedule.'; end if;
    if operation='AdminSetDailyScheduleActive' then
      update barkolink_private.daily_schedule set is_active=active_value,updated_at=now() where id=record_id;
    elsif record_id is null then
      insert into barkolink_private.daily_schedule(operator,route_id,departure_times,duration_minutes,is_active)
        values(operator_value,route_id_value,times_value,nullif(args->>'durationMinutes','')::integer,active_value) returning id into record_id;
    else
      update barkolink_private.daily_schedule set operator=operator_value,route_id=route_id_value,departure_times=times_value,
        duration_minutes=nullif(args->>'durationMinutes','')::integer,is_active=active_value,updated_at=now() where id=record_id;
      if not found then raise exception 'Daily schedule was not found.'; end if;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'UPDATE','daily_schedule',record_id::text,jsonb_build_object('operator',operator_value,'is_active',active_value));
  end if;
  select jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'operator',s.operator,'routeId',r.id,'routeCode',r.code,
      'origin',o.name,'destination',d.name,'departureTimes',s.departure_times,'durationMinutes',s.duration_minutes,
      'isActive',s.is_active,'routeActive',r.is_active and o.is_active and d.is_active) order by (s.is_active and r.is_active and o.is_active and d.is_active) desc,s.operator,r.code),'[]')
      from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id),
    'routes',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'origin',o.name,'destination',d.name,'isActive',r.is_active and o.is_active and d.is_active,
      'operators',(select coalesce(jsonb_agg(distinct v.reference_metadata->>'operator'),'[]') from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id
        where vr.route_id=r.id and v.reference_metadata->>'operator' is not null)) order by r.code),'[]')
      from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id)) into result;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 039_batangas_calapan_service_area.sql
-- Preserve ticket history while restricting new operations to this corridor.
update public.port set is_active=(code in ('BTG','CAL'));
update public.ferry_route r set is_active=(o.code in ('BTG','CAL') and d.code in ('BTG','CAL'))
from public.port o,public.port d where o.id=r.origin_port_id and d.id=r.destination_port_id;
update public.vessel v set is_active=false where not exists(
  select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id
  where vr.vessel_id=v.id and r.is_active
);
-- Retain pauses set by the administrator on schedules inside the corridor.
update barkolink_private.daily_schedule s set is_active=false,updated_at=now()
where is_active and not exists(select 1 from public.ferry_route r where r.id=s.route_id and r.is_active);

-- Legacy bookings put the cabin surcharge in service_fee. Reclassify it without
-- changing the amount charged, payment state, passenger fares or QR credentials.
update public.booking b set
  passenger_fare_total=b.passenger_fare_total+b.accommodation_surcharge*b.passenger_count,
  service_fee=b.service_fee-b.accommodation_surcharge*b.passenger_count,
  updated_at=now()
where b.accommodation_surcharge>0
  and b.passenger_fare_total=(select sum(p.fare) from public.booking_passenger p where p.booking_id=b.id)
  and b.service_fee>=b.accommodation_surcharge*b.passenger_count;


-- 040_vessel_position_tracking.sql
-- Confirmed terminal observations are separate from estimated sailing positions.
create table barkolink_private.vessel_port_observation (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references public.vessel(id),
  port_id uuid not null references public.port(id),
  observed_at timestamptz not null,
  confirmed_by_uid text not null,
  note text not null check(length(trim(note)) between 3 and 500),
  created_at timestamptz not null default now()
);
create index vessel_observation_latest on barkolink_private.vessel_port_observation(vessel_id,observed_at desc,created_at desc);
revoke all on barkolink_private.vessel_port_observation from public,anon,authenticated;

create function barkolink_private.vessel_position_at(vessel uuid, at_time timestamptz, exclude_code text default null)
returns jsonb language plpgsql stable set search_path='' as $$
declare anchor barkolink_private.vessel_port_observation; trip public.sailing; location uuid; expected boolean:=false;
begin
  select * into anchor from barkolink_private.vessel_port_observation
    where vessel_id=vessel and observed_at<=at_time order by observed_at desc,created_at desc,id desc limit 1;
  if not found then return jsonb_build_object('state','UNKNOWN','reason','Confirm the vessel port before opening bookings.'); end if;
  location:=anchor.port_id;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and code is distinct from exclude_code and departure_at>=anchor.observed_at and departure_at<=at_time
    order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','reason','The vessel itinerary has a port mismatch. Correct its trips or confirm its latest port.','tripCode',trip.code);
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','reason','A previous voyage is delayed. Confirm arrival and reschedule before opening another trip.','tripCode',trip.code);
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','reason','The vessel is assigned to another voyage at this time.','originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,'tripCode',trip.code,'arrivalAt',trip.arrival_at);
    end if;
    location:=trip.destination_port_id;expected:=true;
  end loop;
  return jsonb_build_object('state',case when expected then 'EXPECTED' else 'CONFIRMED' end,'portId',location,
    'portName',(select name from public.port where id=location),'confirmedPortName',(select name from public.port where id=anchor.port_id),
    'confirmedAt',anchor.observed_at,'confirmationNote',anchor.note);
end $$;

create function barkolink_private.vessel_departure_issue(vessel uuid, origin uuid, departure timestamptz, exclude_code text)
returns text language plpgsql stable set search_path='' as $$
declare position jsonb;
begin
  if not exists(select 1 from public.vessel where id=vessel_departure_issue.vessel and is_active) or not exists(select 1 from public.port where id=origin and is_active) then return 'The vessel or departure port is inactive.'; end if;
  -- Exclude the trip being evaluated: its own departure does not make it underway.
  position:=barkolink_private.vessel_position_at(vessel,departure,exclude_code);
  if position->>'state' not in ('EXPECTED','CONFIRMED') then return position->>'reason'; end if;
  if (position->>'portId')::uuid<>origin then return 'The vessel will be at '||coalesce(position->>'portName','another port')||' at departure. Choose a vessel that can reach the origin port.'; end if;
  return null;
end $$;

create function barkolink_private.check_vessel_port_chain() returns trigger language plpgsql set search_path='' as $$
declare issue text; next_trip public.sailing;
begin
  if new.status not in ('SCHEDULED','BOARDING') or new.departure_at<=now() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vessel_id::text,4281));
  -- Unknown position permits draft scheduling, but never a new reservation.
  if exists(select 1 from barkolink_private.vessel_port_observation where vessel_id=new.vessel_id and observed_at<=new.departure_at) then
    issue:=barkolink_private.vessel_departure_issue(new.vessel_id,new.origin_port_id,new.departure_at,new.code);
    if issue is not null then raise exception '%',issue; end if;
  select * into next_trip from public.sailing where vessel_id=new.vessel_id and code<>new.code and status<>'CANCELLED'
    and departure_at>=new.arrival_at order by departure_at,code limit 1;
  if found and next_trip.origin_port_id<>new.destination_port_id then raise exception 'This trip ends at a different port from the vessel next departure. Add its transfer voyage or choose another vessel.'; end if;
  end if;
  return new;
end $$;
create trigger vessel_port_chain before insert or update of vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,status
  on public.sailing for each row execute function barkolink_private.check_vessel_port_chain();

create function barkolink_private.check_booking_vessel_port() returns trigger language plpgsql set search_path='' as $$
declare trip public.sailing; issue text;
begin
  if new.status not in ('PENDING','CONFIRMED') then return new; end if;
  select * into trip from public.sailing where code=new.sailing_code;
  perform pg_advisory_xact_lock(hashtextextended(trip.vessel_id::text,4281));
  issue:=barkolink_private.vessel_departure_issue(trip.vessel_id,trip.origin_port_id,trip.departure_at,trip.code);
  if issue is not null then raise exception '%',issue; end if;
  return new;
end $$;
create trigger booking_vessel_port before insert on public.booking for each row execute function barkolink_private.check_booking_vessel_port();

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v39;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; target_vessel uuid; target_port uuid; observed timestamptz; note_value text;
begin
  if operation in ('AdminVesselPositions','AdminConfirmVesselPort','AdminVesselAvailability') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVesselAvailability' then
      return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'issue',
        barkolink_private.vessel_departure_issue(v.id,(args->>'originPortId')::uuid,(args->>'departureAt')::timestamptz,nullif(args->>'excludeCode','')))), '[]') from public.vessel v where v.is_active));
    end if;
    if operation='AdminConfirmVesselPort' then
      target_vessel:=(args->>'vesselId')::uuid;target_port:=(args->>'portId')::uuid;observed:=(args->>'observedAt')::timestamptz;note_value:=trim(args->>'note');
      if observed is null or observed>now() or observed<now()-interval '24 hours' then raise exception 'Confirm a port observation within the last 24 hours.'; end if;
      if not exists(select 1 from public.port where id=target_port and is_active) then raise exception 'Choose an active port.'; end if;
      if not exists(select 1 from public.vessel where id=target_vessel and is_active) then raise exception 'Choose an active vessel.'; end if;
      perform pg_advisory_xact_lock(hashtextextended(target_vessel::text,4281));
      if exists(select 1 from barkolink_private.vessel_port_observation where vessel_id=target_vessel and observed_at>observed) then raise exception 'A newer port observation exists. Confirm the current location.'; end if;
      insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note) values(target_vessel,target_port,observed,actor_uid,note_value);
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'VESSEL_PORT_CONFIRMED','vessel',target_vessel::text,jsonb_build_object('port_id',target_port,'observed_at',observed,'note',note_value));
    end if;
    return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator','position',barkolink_private.vessel_position_at(v.id,now())) order by v.name),'[]') from public.vessel v where v.is_active),
      'ports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.port where is_active));
  end if;
  if operation='BrowseSailings' then
    return jsonb_build_object('sailings',(select coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at),'[]') from
      (select * from public.sailing where status='SCHEDULED' and departure_at>now() and
        barkolink_private.vessel_departure_issue(vessel_id,origin_port_id,departure_at,code) is null order by departure_at limit 50) s));
  end if;
  result:=barkolink_private.execute_flexible_discounts_v39(operation,args,actor_uid,actor_role);
  if operation='TicketingSailings' then
    result:=jsonb_set(result,'{sailings}',coalesce((select jsonb_agg(s) from jsonb_array_elements(result->'sailings') s join public.sailing t on t.code=s->>'code'
      where barkolink_private.vessel_departure_issue(t.vessel_id,t.origin_port_id,t.departure_at,t.code) is null),'[]'));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 041_vessel_tracking_lock_order.sql
-- Acquire the vessel advisory lock in the booking trigger after the existing sailing-row lock.
-- A pre-lock in ReserveSailing could deadlock with automatic status updates holding that row.
create or replace function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; target_vessel uuid; target_port uuid; observed timestamptz; note_value text;
begin
  if operation in ('AdminVesselPositions','AdminConfirmVesselPort','AdminVesselAvailability') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVesselAvailability' then
      return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'issue',
        barkolink_private.vessel_departure_issue(v.id,(args->>'originPortId')::uuid,(args->>'departureAt')::timestamptz,nullif(args->>'excludeCode','')))), '[]') from public.vessel v where v.is_active));
    end if;
    if operation='AdminConfirmVesselPort' then
      target_vessel:=(args->>'vesselId')::uuid;target_port:=(args->>'portId')::uuid;observed:=(args->>'observedAt')::timestamptz;note_value:=trim(args->>'note');
      if observed is null or observed>now() or observed<now()-interval '24 hours' then raise exception 'Confirm a port observation within the last 24 hours.'; end if;
      if not exists(select 1 from public.port where id=target_port and is_active) then raise exception 'Choose an active port.'; end if;
      if not exists(select 1 from public.vessel where id=target_vessel and is_active) then raise exception 'Choose an active vessel.'; end if;
      perform pg_advisory_xact_lock(hashtextextended(target_vessel::text,4281));
      if exists(select 1 from barkolink_private.vessel_port_observation where vessel_id=target_vessel and observed_at>observed) then raise exception 'A newer port observation exists. Confirm the current location.'; end if;
      insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note) values(target_vessel,target_port,observed,actor_uid,note_value);
      insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'VESSEL_PORT_CONFIRMED','vessel',target_vessel::text,jsonb_build_object('port_id',target_port,'observed_at',observed,'note',note_value));
    end if;
    return jsonb_build_object('vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator','position',barkolink_private.vessel_position_at(v.id,now())) order by v.name),'[]') from public.vessel v where v.is_active),
      'ports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.port where is_active));
  end if;
  if operation='BrowseSailings' then
    return jsonb_build_object('sailings',(select coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at),'[]') from
      (select * from public.sailing where status='SCHEDULED' and departure_at>now() and
        barkolink_private.vessel_departure_issue(vessel_id,origin_port_id,departure_at,code) is null order by departure_at limit 50) s));
  end if;
  result:=barkolink_private.execute_flexible_discounts_v39(operation,args,actor_uid,actor_role);
  if operation='TicketingSailings' then
    result:=jsonb_set(result,'{sailings}',coalesce((select jsonb_agg(s) from jsonb_array_elements(result->'sailings') s join public.sailing t on t.code=s->>'code'
      where barkolink_private.vessel_departure_issue(t.vessel_id,t.origin_port_id,t.departure_at,t.code) is null),'[]'));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 042_port_display.sql
-- Public terminal screens expose schedules and published notices only.
create function public.port_display(p_port uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  selected_port uuid;
begin
  if p_port is not null then
    select id into selected_port from public.port where id = p_port and is_active;
    if selected_port is null then raise exception 'Port is unavailable'; end if;
  else
    select id into selected_port from public.port where is_active order by name, id limit 1;
  end if;
  return jsonb_build_object(
    'date', to_char(day_start at time zone 'Asia/Manila', 'YYYY-MM-DD'),
    'updatedAt', now(), 'portId', selected_port,
    'ports', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'city', city) order by name, id)
      from public.port where is_active), '[]'::jsonb),
    'sailings', coalesce((select jsonb_agg(jsonb_build_object(
      'code', s.code, 'departureAt', s.departure_at, 'arrivalAt', s.arrival_at, 'status', s.status,
      'origin', jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city),
      'destination', jsonb_build_object('id', d.id, 'name', d.name, 'city', d.city),
      'vessel', jsonb_build_object('name', v.name), 'operator', v.reference_metadata->>'operator'
    ) order by s.departure_at, s.code)
    from public.sailing s join public.port o on o.id = s.origin_port_id
      join public.port d on d.id = s.destination_port_id join public.vessel v on v.id = s.vessel_id
    where o.is_active and d.is_active and (
      (s.origin_port_id = selected_port and s.departure_at >= day_start and s.departure_at < day_start + interval '1 day') or
      (s.destination_port_id = selected_port and s.arrival_at >= day_start and s.arrival_at < day_start + interval '1 day')
    )), '[]'::jsonb),
    'advisories', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'message', a.message, 'priority', a.priority, 'endsAt', a.ends_at
    ) order by case a.priority when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, a.starts_at desc, a.id)
    from public.travel_advisory a where selected_port is not null and a.published
      and a.starts_at <= now() and a.ends_at > now() and (
        a.sailing_code is null or exists (select 1 from public.sailing s where s.code = a.sailing_code
          and (s.origin_port_id = selected_port or s.destination_port_id = selected_port))
      )), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.port_display(uuid) from public;
grant execute on function public.port_display(uuid) to anon, authenticated, service_role;


-- 043_security_hardening.sql
-- Enforce business limits at the database boundary, including direct RPC calls.
alter table public.operation_settings alter column reservation_minutes set default 30;
update public.operation_settings set reservation_minutes=30 where reservation_minutes=1440;
-- Keep request-triggered cleanup and the scheduled job bounded.
create or replace function barkolink_private.expire_reservations() returns integer
language plpgsql set search_path='' as $$
declare b public.booking; affected integer:=0;
begin
  for b in select * from public.booking where status in ('PENDING','CONFIRMED') and payment_status='UNPAID'
    and payment_deadline<=now() order by id limit 100 for update skip locked loop
    update public.sailing set available_seats=available_seats+b.passenger_count,updated_at=now() where code=b.sailing_code;
    update public.booking set status='EXPIRED',cancellation_reason='Payment deadline passed',updated_at=now() where id=b.id;
    insert into public.notification(owner_uid,title,message,category) values(b.owner_uid,'Reservation expired',
      'Reservation '||b.reference||' expired because its payment deadline passed. Its seats were released.','BOOKING');
    insert into public.activity_log(action,entity_type,entity_id,details) values('RESERVATION_EXPIRED','booking',b.id::text,
      jsonb_build_object('reference',b.reference,'releasedSeats',b.passenger_count));
    affected:=affected+1;
  end loop;
  return affected;
end $$;
create table barkolink_private.api_usage (
  actor uuid not null, bucket text not null, window_at timestamptz not null default now(),
  requests integer not null default 0, primary key(actor,bucket)
);
revoke all on barkolink_private.api_usage from public,anon,authenticated;

create function public.consume_api_allowance(p_actor uuid,p_bucket text) returns boolean
language plpgsql security definer set search_path='' as $$
declare budget integer; used integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then return false; end if;
  budget:=case p_bucket when 'weather' then 60 when 'paymongo' then 30 when 'manage-account' then 20 else 0 end;
  if budget=0 then return false; end if;
  insert into barkolink_private.api_usage(actor,bucket,requests) values(p_actor,p_bucket,1)
  on conflict(actor,bucket) do update set
    requests=case when api_usage.window_at<=now()-interval '1 minute' then 1 else least(api_usage.requests+1,budget+1) end,
    window_at=case when api_usage.window_at<=now()-interval '1 minute' then now() else api_usage.window_at end
  returning requests into used;
  return used<=budget;
end $$;
revoke all on function public.consume_api_allowance(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_api_allowance(uuid,text) to service_role;

create function barkolink_private.require_staff_mfa(actor_role text) returns void
language plpgsql set search_path='' as $$
begin
  if actor_role in ('ADMIN','TICKETING','BOARDING') and
    coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')<>'aal2' then
    raise exception 'Verify your authenticator code before accessing the staff workspace.' using errcode='42501';
  end if;
end $$;

create function barkolink_private.validate_request(args jsonb) returns void
language plpgsql set search_path='' as $$
declare item record; value text;
begin
  if args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>32768 then raise exception 'Invalid or oversized database request.'; end if;
  for item in select * from jsonb_each(args) loop
    if jsonb_typeof(item.value)='string' then
      value:=item.value#>>'{}';
      if length(value)>6000 then raise exception 'Input is too long.'; end if;
      if item.key ~ '(Name|fullName|passengerName)$' then
        if length(trim(value)) not between 1 and 120 or value ~ '[[:cntrl:]]' then raise exception 'Enter a valid full name using 1 to 120 characters.'; end if;
      elsif item.key ~ '(Phone|phone)$' and trim(value)<>'' then
        if regexp_replace(value,'[-()[:space:]]','','g') !~ '^\+?[0-9]{7,15}$' then raise exception 'Enter a valid contact number with 7 to 15 digits.'; end if;
      elsif item.key ~ '(Nationality|nationality)$' then
        if length(trim(value)) not between 1 and 80 or value ~ '[[:cntrl:]]' then raise exception 'Enter a valid nationality using 1 to 80 characters.'; end if;
      elsif item.key ~ '(BirthDate|birthDate)$' and value<>'' then
        if value !~ '^\d{4}-\d{2}-\d{2}$' or value::date<date '1900-01-01' or value::date>(now() at time zone 'Asia/Manila')::date then raise exception 'Enter a valid birth date that is not in the future.'; end if;
      elsif item.key ~ '(Sex|sex)$' and value<>'' then
        if value not in ('Male','Female','Other','Prefer not to say','MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') then raise exception 'Choose a valid sex.'; end if;
      elsif item.key='reference' then
        if length(trim(value)) not between 1 and 80 or value ~ '[[:cntrl:]]' then raise exception 'Enter a valid booking reference.'; end if;
      end if;
    elsif item.key ~ '(Name|Phone|Nationality|BirthDate|Sex|fullName|phone|nationality|birthDate|sex|reference)$'
      and jsonb_typeof(item.value)<>'null' then raise exception 'Enter text for passenger details.';
    end if;
  end loop;
end $$;

create or replace function public.barkolink_execute(operation text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_uid text:=auth.uid()::text; actor_role text:='PASSENGER'; requested integer; held integer; n integer; field text;
begin
  if operation is null or length(operation)>80 then raise exception 'Invalid database request.'; end if;
  perform barkolink_private.validate_request(args);
  if actor_uid is not null then
    select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id::text=actor_uid;
    if not found then raise exception 'Account was not found.' using errcode='42501'; end if;
  end if;
  perform barkolink_private.require_staff_mfa(actor_role);
  if operation='CreateManagedUserProfile' then raise exception 'Use the account management function.' using errcode='42501'; end if;
  -- Public schedule reads do not perform global cleanup writes.
  if actor_uid is not null then perform barkolink_private.expire_reservations(); end if;
  if operation ~ '^ReserveSailing[1-8]$' then
    if actor_uid is null or actor_role is distinct from 'PASSENGER' then raise exception 'Passenger access required.' using errcode='42501'; end if;
    for n in 1..right(operation,1)::integer loop
      foreach field in array array['Name','Type','BirthDate','Sex','Phone','Nationality'] loop
        if jsonb_typeof(args->('passenger'||n||field)) is distinct from 'string' or
          nullif(trim(args->>('passenger'||n||field)),'') is null then raise exception 'Complete every passenger field before reserving.'; end if;
      end loop;
    end loop;
    -- Serialize holds across different vessels as well as the same sailing.
    perform pg_advisory_xact_lock(hashtextextended(actor_uid,87573));
    if not exists(select 1 from public.booking where reference=args->>'reference' and owner_uid=actor_uid) then
      requested:=right(operation,1)::integer;
      select coalesce(sum(passenger_count),0) into held from public.booking
        where owner_uid=actor_uid and sailing_code=args->>'sailingCode' and status in ('PENDING','CONFIRMED')
          and payment_status='UNPAID' and payment_deadline>now();
      if held+requested>8 then raise exception 'You can hold at most 8 unpaid seats for one sailing. Pay or cancel an existing reservation first.'; end if;
      select coalesce(sum(passenger_count),0) into held from public.booking
        where owner_uid=actor_uid and status in ('PENDING','CONFIRMED') and payment_status='UNPAID' and payment_deadline>now();
      if held+requested>16 then raise exception 'You can hold at most 16 unpaid seats across all sailings. Pay or cancel an existing reservation first.'; end if;
      if (select count(*) from public.booking where owner_uid=actor_uid and payment_status<>'PAID' and created_at>now()-interval '10 minutes')>=10 then
        raise exception 'Too many reservations. Please try again later.';
      end if;
    end if;
  end if;
  if operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn') then
    foreach field in array array['passengerName','passengerType','birthDate','sex','nationality'] loop
      if jsonb_typeof(args->field) is distinct from 'string' or nullif(trim(args->>field),'') is null then raise exception 'Complete the walk-in passenger details.'; end if;
    end loop;
  end if;
  if operation='UpdateMyProfile' then return barkolink_private.camel(barkolink_private.save_profile(args,actor_uid,actor_role)); end if;
  return barkolink_private.camel(barkolink_private.execute_flexible_discounts(operation,args,actor_uid,actor_role));
end $$;
revoke all on function public.barkolink_execute(text,jsonb) from public;
grant execute on function public.barkolink_execute(text,jsonb) to anon,authenticated,service_role;

-- The independently exposed staff payment RPC needs the same MFA gate.
alter function public.verify_online_payment(uuid) rename to verify_online_payment_v42;
revoke all on function public.verify_online_payment_v42(uuid) from public,anon,authenticated;
create function public.verify_online_payment(p_booking uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_role text;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id=auth.uid();
  perform barkolink_private.require_staff_mfa(actor_role);
  return public.verify_online_payment_v42(p_booking);
end $$;
revoke all on function public.verify_online_payment(uuid) from public,anon;
grant execute on function public.verify_online_payment(uuid) to authenticated;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 044_automatic_vessel_tracking.sql
-- Display-only estimates may start from a saved itinerary. Booking eligibility
-- continues to use vessel_position_at and its confirmed starting observation.
create function barkolink_private.vessel_display_position_at(vessel uuid, at_time timestamptz)
returns jsonb language plpgsql stable set search_path='' as $$
declare position jsonb; trip public.sailing; location uuid; last_trip public.sailing;
begin
  position:=barkolink_private.vessel_position_at(vessel,at_time);
  if position->>'state'<>'UNKNOWN' then
    return position || jsonb_build_object('basis',case when position->>'state'='CONFIRMED' then 'TERMINAL' else 'SCHEDULE' end);
  end if;
  select * into trip from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    order by departure_at,code limit 1;
  if not found then
    return jsonb_build_object('state','UNKNOWN','reason','No saved voyage or confirmed port is available.');
  end if;
  location:=trip.origin_port_id;
  last_trip:=trip;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and departure_at<=at_time order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','basis','SCHEDULE','tripCode',trip.code,
        'reason','Scheduled voyages have a port mismatch. Review the itinerary or confirm the current port.');
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','basis','SCHEDULE','tripCode',trip.code,
        'reason','The voyage is delayed. Confirm the current port or correct its schedule.');
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','basis','SCHEDULE','tripCode',trip.code,
        'originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,
        'departureAt',trip.departure_at,'arrivalAt',trip.arrival_at,
        'reason','Estimated from scheduled departure and arrival; actual departure is not confirmed.');
    end if;
    location:=trip.destination_port_id;
    last_trip:=trip;
  end loop;
  return jsonb_build_object('state','EXPECTED','basis','SCHEDULE','portId',location,
    'portName',(select name from public.port where id=location),
    'tripCode',coalesce(last_trip.code,trip.code),
    'reason','Estimated from saved voyages. Confirm the actual port with the terminal.');
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text)
  rename to execute_flexible_discounts_v43;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  -- Delegate identity, permissions, confirmations, and all booking checks unchanged.
  result:=barkolink_private.execute_flexible_discounts_v43(operation,args,actor_uid,actor_role);
  if operation in ('AdminVesselPositions','AdminConfirmVesselPort') then
    result:=jsonb_set(result,'{vessels}',coalesce((select jsonb_agg(
      jsonb_set(item,'{position}',barkolink_private.vessel_display_position_at((item->>'id')::uuid,now()))
      order by item->>'name',item->>'id') from jsonb_array_elements(result->'vessels') item),'[]'::jsonb));
  end if;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 045_schedule_based_vessel_positions.sql
-- Routine tracking and booking availability follow the saved itinerary.
-- A manual port observation is an optional correction, never an automatic arrival.
create or replace function barkolink_private.vessel_position_at(vessel uuid, at_time timestamptz, exclude_code text default null)
returns jsonb language plpgsql stable set search_path='' as $$
declare anchor barkolink_private.vessel_port_observation; trip public.sailing;
  location uuid; expected boolean:=false; observed boolean; since_time timestamptz; latest_code text;
begin
  select * into anchor from barkolink_private.vessel_port_observation
    where vessel_id=vessel and observed_at<=at_time order by observed_at desc,created_at desc,id desc limit 1;
  observed:=found;
  if observed then
    location:=anchor.port_id;since_time:=anchor.observed_at;
  else
    -- The excluded trip still supplies its origin if it is the first voyage;
    -- it must not count as already underway when checking its own departure.
    select * into trip from public.sailing where vessel_id=vessel and status<>'CANCELLED'
      order by departure_at,code limit 1;
    if not found then return jsonb_build_object('state','UNKNOWN','reason','Add a saved trip to establish the vessel itinerary.'); end if;
    location:=trip.origin_port_id;since_time:='-infinity';expected:=true;latest_code:=trip.code;
  end if;
  for trip in select * from public.sailing where vessel_id=vessel and status<>'CANCELLED'
    and code is distinct from exclude_code and departure_at>=since_time and departure_at<=at_time
    order by departure_at,code loop
    if trip.origin_port_id<>location then
      return jsonb_build_object('state','CONFLICT','reason','The vessel itinerary has a port mismatch. Correct its trips or record a location correction.','tripCode',trip.code);
    end if;
    if trip.status='DELAYED' then
      return jsonb_build_object('state','DELAYED','reason','A previous voyage is delayed. Update the voyage schedule before opening a dependent departure.','tripCode',trip.code);
    end if;
    if trip.arrival_at>at_time then
      return jsonb_build_object('state','UNDERWAY','basis','SCHEDULE','reason','The vessel is assigned to another voyage at this time (schedule estimate).',
        'originPortId',trip.origin_port_id,'destinationPortId',trip.destination_port_id,'tripCode',trip.code,'arrivalAt',trip.arrival_at);
    end if;
    location:=trip.destination_port_id;expected:=true;latest_code:=trip.code;
  end loop;
  return jsonb_strip_nulls(jsonb_build_object('state',case when expected then 'EXPECTED' else 'CONFIRMED' end,
    'basis',case when expected then 'SCHEDULE' else 'TERMINAL' end,
    'portId',location,'portName',(select name from public.port where id=location),
    'tripCode',latest_code,
    'confirmedPortName',case when observed then (select name from public.port where id=anchor.port_id) end,
    'confirmedAt',case when observed then anchor.observed_at end,
    'confirmationNote',case when observed then anchor.note end));
end $$;
revoke all on function barkolink_private.vessel_position_at(uuid,timestamptz,text) from public,anon,authenticated;


-- 046_optional_account_mfa.sql
create table barkolink_private.mfa_policy (
  singleton boolean primary key default true check(singleton),
  staff_required boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into barkolink_private.mfa_policy(singleton) values(true);
revoke all on barkolink_private.mfa_policy from public,anon,authenticated;

create function barkolink_private.account_mfa_required(p_actor uuid,p_role text) returns boolean
language plpgsql stable set search_path='' as $$
begin
  if p_role not in ('ADMIN','TICKETING','BOARDING') then return false;end if;
  if p_role in ('TICKETING','BOARDING') and (select staff_required from barkolink_private.mfa_policy where singleton) then return true;end if;
  -- A missing Auth relation must never make an opted-in account less protected.
  if to_regclass('auth.mfa_factors') is null then return true;end if;
  return exists(select 1 from auth.mfa_factors where user_id=p_actor and status='verified');
end $$;

create or replace function barkolink_private.require_staff_mfa(actor_role text) returns void
language plpgsql set search_path='' as $$
begin
  if actor_role in ('ADMIN','TICKETING','BOARDING') and
    coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')<>'aal2' and
    barkolink_private.account_mfa_required(auth.uid(),actor_role) then
    raise exception 'Verify your authenticator code before accessing the staff workspace.' using errcode='42501';
  end if;
end $$;

-- Available before step-up so the router can decide whether setup is required.
create function public.my_mfa_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; enabled boolean; required boolean;
begin
  if actor is null then raise exception 'Sign in first.' using errcode='42501';end if;
  select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id=actor;
  if not found then raise exception 'Account was not found.' using errcode='42501';end if;
  select exists(select 1 from auth.mfa_factors where user_id=actor and status='verified' and factor_type='totp') into enabled;
  select staff_required into required from barkolink_private.mfa_policy where singleton;
  return jsonb_build_object('role',actor_role,'enabled',enabled,'staffRequired',required,
    'policyRequired',actor_role in ('TICKETING','BOARDING') and required,
    'mfaRequired',barkolink_private.account_mfa_required(actor,actor_role));
end $$;
revoke all on function public.my_mfa_settings() from public,anon;
grant execute on function public.my_mfa_settings() to authenticated;

create function public.set_staff_mfa_required(p_required boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id=actor;
  if actor is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501';end if;
  perform barkolink_private.require_staff_mfa(actor_role);
  if p_required is null then raise exception 'Choose whether staff 2FA is required.';end if;
  update barkolink_private.mfa_policy set staff_required=p_required,updated_at=now() where singleton;
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor::text,'MFA_POLICY_UPDATED','mfa_policy','staff',jsonb_build_object('staff_required',p_required));
  return public.my_mfa_settings();
end $$;
revoke all on function public.set_staff_mfa_required(boolean) from public,anon;
grant execute on function public.set_staff_mfa_required(boolean) to authenticated;

-- The account-management Edge Function validates the caller, then consults the
-- same rule using its service role. No caller can query another account directly.
create function public.admin_mfa_requirement(p_actor uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='ADMIN') then
    raise exception 'Administrator access required.' using errcode='42501';end if;
  return barkolink_private.account_mfa_required(p_actor,'ADMIN');
end $$;
revoke all on function public.admin_mfa_requirement(uuid) from public,anon,authenticated;
grant execute on function public.admin_mfa_requirement(uuid) to service_role;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 047_preserve_authenticator_on_toggle.sql
-- Switching the application requirement off must preserve the Auth factor.
create table barkolink_private.account_mfa_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null,
  last_verification bigint not null,
  updated_at timestamptz not null default now()
);
revoke all on barkolink_private.account_mfa_preference from public,anon,authenticated;

create or replace function barkolink_private.account_mfa_required(p_actor uuid,p_role text) returns boolean
language plpgsql stable set search_path='' as $$
begin
  if p_role not in ('ADMIN','TICKETING','BOARDING') then return false;end if;
  if p_role in ('TICKETING','BOARDING') and (select staff_required from barkolink_private.mfa_policy where singleton) then return true;end if;
  if to_regclass('auth.mfa_factors') is null then return true;end if;
  return coalesce((select enabled from barkolink_private.account_mfa_preference where user_id=p_actor),true)
    and exists(select 1 from auth.mfa_factors where user_id=p_actor and status='verified');
end $$;

create or replace function public.my_mfa_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; linked boolean; required boolean; preference boolean;
begin
  if actor is null then raise exception 'Sign in first.' using errcode='42501';end if;
  select coalesce(raw_app_meta_data->>'role','PASSENGER') into actor_role from auth.users where id=actor;
  if not found then raise exception 'Account was not found.' using errcode='42501';end if;
  select exists(select 1 from auth.mfa_factors where user_id=actor and status='verified' and factor_type='totp') into linked;
  select staff_required into required from barkolink_private.mfa_policy where singleton;
  select enabled into preference from barkolink_private.account_mfa_preference where user_id=actor;
  return jsonb_build_object('role',actor_role,'authenticatorLinked',linked,
    'enabled',linked and (coalesce(preference,true) or (actor_role in ('TICKETING','BOARDING') and required)),
    'staffRequired',required,'policyRequired',actor_role in ('TICKETING','BOARDING') and required,
    'mfaRequired',barkolink_private.account_mfa_required(actor,actor_role));
end $$;

create function public.set_account_mfa_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; required boolean; claims jsonb;
  verified_at bigint; last_used bigint;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id=actor;
  if actor is null or actor_role not in ('ADMIN','TICKETING','BOARDING') or actor_role is null then
    raise exception 'Staff or administrator access required.' using errcode='42501';end if;
  if p_enabled is null then raise exception 'Choose On or Off.';end if;
  -- Serialize policy changes and concurrent toggles; one proof cannot be replayed.
  select staff_required into required from barkolink_private.mfa_policy where singleton for share;
  if not p_enabled and actor_role in ('TICKETING','BOARDING') and required then
    raise exception 'Your administrator requires staff two-factor authentication.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,47621));
  claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
  select max((item->>'timestamp')::bigint) into verified_at from jsonb_array_elements(
    case when jsonb_typeof(claims->'amr')='array' then claims->'amr' else '[]'::jsonb end) item
    where item->>'method'='totp' and item->>'timestamp' ~ '^[0-9]{1,12}$';
  if claims->>'aal' is distinct from 'aal2' or verified_at is null
    or verified_at<extract(epoch from now())-300 or verified_at>extract(epoch from now())+30 then
    raise exception 'Verify a fresh authenticator code before changing 2FA.' using errcode='42501';end if;
  if not exists(select 1 from auth.mfa_factors where user_id=actor and factor_type='totp' and status='verified') then
    raise exception 'Link an authenticator before changing 2FA.' using errcode='42501';end if;
  select last_verification into last_used from barkolink_private.account_mfa_preference where user_id=actor;
  if last_used is not null and verified_at<=last_used then
    raise exception 'Use a new authenticator code before changing 2FA again.' using errcode='42501';end if;
  insert into barkolink_private.account_mfa_preference(user_id,enabled,last_verification)
    values(actor,p_enabled,verified_at) on conflict(user_id) do update
    set enabled=excluded.enabled,last_verification=excluded.last_verification,updated_at=now();
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor::text,'ACCOUNT_MFA_UPDATED','account_mfa',actor::text,jsonb_build_object('enabled',p_enabled));
  return public.my_mfa_settings();
end $$;
revoke all on function public.set_account_mfa_enabled(boolean) from public,anon;
grant execute on function public.set_account_mfa_enabled(boolean) to authenticated;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 048_boarding_staff_trip_timing.sql
-- Boarding staff may override one departing trip at their assigned active port.
-- Operator-wide policy and departure/status administration remain Admin-only.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text)
  rename to execute_flexible_discounts_v47;

create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare trip public.sailing; assigned uuid; policy barkolink_private.sailing_status_policy;
  boarding_time timestamptz; reason text; previous_time timestamptz; effective_time timestamptz;
begin
  if operation not in ('BoardingSailingTiming','BoardingSetSailingTiming') then
    return barkolink_private.execute_flexible_discounts_v47(operation,args,actor_uid,actor_role);
  end if;
  if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('BOARDING','ADMIN') then
    raise exception 'Boarding staff access required.' using errcode='42501';
  end if;
  if actor_role='BOARDING' then
    -- Hold the assignment until the read/save finishes, before locking the trip.
    select assigned_port_id into assigned from public.app_user where uid=actor_uid and role='BOARDING' for share;
    if assigned is null or not exists(select 1 from public.port where id=assigned and is_active) then
      raise exception 'No active port is assigned to your staff account. Ask an administrator to assign your port.' using errcode='42501';
    end if;
  end if;
  select * into trip from public.sailing where code=args->>'sailingCode' for update;
  if not found then raise exception 'Sailing was not found.'; end if;
  if actor_role='BOARDING' and trip.origin_port_id is distinct from assigned then
    raise exception 'This record is outside your assigned port.' using errcode='42501';
  end if;
  select p.* into policy from barkolink_private.sailing_status_policy p
    join public.vessel v on v.reference_metadata->>'operator'=p.operator where v.id=trip.vessel_id;
  previous_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  if operation='BoardingSetSailingTiming' then
    if trip.status not in ('SCHEDULED','BOARDING') or trip.departure_at<=now() then
      raise exception 'Adjust boarding time only for scheduled or boarding trips before departure.';
    end if;
    -- A stale dialog must not overwrite an Admin reschedule or another staff edit.
    if nullif(args->>'expectedUpdatedAt','') is null or
      (args->>'expectedUpdatedAt')::timestamptz is distinct from trip.updated_at then
      raise exception 'This trip changed. Reload its boarding details and try again.' using errcode='40001';
    end if;
    boarding_time:=nullif(args->>'boardingAt','')::timestamptz;
    reason:=nullif(trim(args->>'reason'),'');
    if boarding_time is null or not isfinite(boarding_time) or boarding_time>=trip.departure_at or
      boarding_time<trip.departure_at-interval '7 days' then
      raise exception 'Set boarding between 1 minute and 7 days before departure.';
    end if;
    if boarding_time>trip.departure_at-interval '1 minute' then
      raise exception 'Set boarding at least 1 minute before departure.';
    end if;
    if reason is null or length(reason) not between 5 and 500 then
      raise exception 'Enter a reason of 5 to 500 characters for the boarding time change.';
    end if;
    if trip.status='BOARDING' and boarding_time>now() then
      raise exception 'Boarding has already started. Ask an administrator to delay or reschedule the trip instead.';
    end if;
    update public.sailing set boarding_at=boarding_time,boarding_time_source=reason,updated_at=clock_timestamp()
      where code=trip.code returning * into trip;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'BOARDING_TIME_UPDATED','sailing',trip.code,jsonb_build_object(
        'boardingAt',jsonb_build_object('before',previous_time,'after',boarding_time),
        'departureAt',trip.departure_at,'reason',reason));
  end if;
  effective_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  return jsonb_build_object('timing',jsonb_build_object(
    'sailingCode',trip.code,'departureAt',trip.departure_at,'boardingAt',trip.boarding_at,
    'effectiveBoardingAt',effective_time,'boardingTimeSource',coalesce(trip.boarding_time_source,policy.boarding_time_source),
    'usesOperatorDefault',trip.boarding_at is null,'updatedAt',trip.updated_at,'status',trip.status,
    'canEdit',trip.status in ('SCHEDULED','BOARDING') and trip.departure_at>now()));
end $$;

revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;
revoke all on function barkolink_private.execute_flexible_discounts_v47(text,jsonb,text,text) from public,anon,authenticated;


-- 049_starlite_accommodation_catalog.sql
-- Align the current Starlite service catalog without changing booked fares or IDs.
do $$ begin
  if exists(select 1 from public.vessel where code='SL-SWM-STELLA-DEL-MAR' and reference_metadata->>'operator'='Starlite Ferries')
    and exists(select 1 from public.vessel where code='SL-STELLA-DEL-MAR') then
    raise exception 'The normalized Starlite vessel code is already in use.';
  end if;
end $$;
update public.vessel set code='SL-STELLA-DEL-MAR'
where code='SL-SWM-STELLA-DEL-MAR' and reference_metadata->>'operator'='Starlite Ferries';

-- Unsupported classes with booking history stay archived; never delete bookings.
update public.accommodation a set is_active=false
from public.vessel v where a.vessel_id=v.id and v.reference_metadata->>'operator'='Starlite Ferries'
  and a.name not in ('Economy','Tourist Class','Business Class')
  and exists(select 1 from public.booking b where b.accommodation_id=a.id);
delete from public.accommodation a using public.vessel v
where a.vessel_id=v.id and v.reference_metadata->>'operator'='Starlite Ferries'
  and a.name not in ('Economy','Tourist Class','Business Class')
  and not exists(select 1 from public.booking b where b.accommodation_id=a.id);


-- 050_enforce_schedule_vessel_ports.sql
-- Validate connected itineraries even without a manual terminal observation.
create or replace function barkolink_private.check_vessel_port_chain()
returns trigger language plpgsql set search_path='' as $$
declare issue text; next_trip public.sailing;
begin
  if new.status not in ('SCHEDULED','BOARDING') or new.departure_at<=now() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vessel_id::text,4281));
  -- The first saved voyage can establish an itinerary's starting port.
  -- Every later voyage must respect the preceding voyage or terminal observation.
  if exists(select 1 from barkolink_private.vessel_port_observation
      where vessel_id=new.vessel_id and observed_at<=new.departure_at)
    or exists(select 1 from public.sailing where vessel_id=new.vessel_id
      and code<>new.code and status<>'CANCELLED' and departure_at<=new.departure_at) then
    issue:=barkolink_private.vessel_departure_issue(new.vessel_id,new.origin_port_id,new.departure_at,new.code);
    if issue is not null then raise exception '%',issue; end if;
  end if;
  select * into next_trip from public.sailing where vessel_id=new.vessel_id
    and code<>new.code and status<>'CANCELLED' and departure_at>=new.arrival_at
    order by departure_at,code limit 1;
  if found and next_trip.origin_port_id<>new.destination_port_id then
    raise exception 'This trip ends at a different port from the vessel next departure. Add its transfer voyage or choose another vessel.';
  end if;
  return new;
end $$;
revoke all on function barkolink_private.check_vessel_port_chain() from public,anon,authenticated;


-- 051_automatic_daily_trips.sql
-- A saved daily schedule assigns one vessel; a database clock creates actual trips.
alter table barkolink_private.daily_schedule
  add column vessel_id uuid references public.vessel,
  add column generation_issues jsonb not null default '[]',
  add column last_generated_at timestamptz;
alter table public.sailing
  add column daily_schedule_id uuid references barkolink_private.daily_schedule,
  add column daily_service_date date,
  add column daily_departure_time text,
  add constraint daily_trip_source_complete check (
    (daily_schedule_id is null and daily_service_date is null and daily_departure_time is null) or
    (daily_schedule_id is not null and daily_service_date is not null and daily_departure_time is not null)),
  add constraint daily_trip_occurrence unique(daily_schedule_id,daily_service_date,daily_departure_time);

create function barkolink_private.generate_daily_trips() returns integer
language plpgsql security definer set search_path='' as $$
declare slot record; ship public.vessel; fares public.fare_settings; policy barkolink_private.sailing_status_policy;
  minutes integer; trip_code text; created integer:=0;
begin
  if not pg_try_advisory_xact_lock(hashtext('barkolink-generate-daily-trips')) then return 0; end if;
  update barkolink_private.daily_schedule set generation_issues='[]',last_generated_at=now() where is_active;
  -- All routes are processed together chronologically, so outbound/return pairs connect.
  for slot in
    select s.*,r.origin_port_id,r.destination_port_id,r.duration_minutes as route_minutes,
      r.is_active and o.is_active and d.is_active as route_active,
      (now() at time zone 'Asia/Manila')::date + day_offset as service_date, departure_time,
      (((now() at time zone 'Asia/Manila')::date + day_offset) + departure_time::time) at time zone 'Asia/Manila' as departure
    from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id
    join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
    cross join generate_series(0,6) day_offset cross join unnest(s.departure_times) departure_time
    where s.is_active
    order by departure,s.id
  loop
    if slot.departure<=now() or exists(select 1 from public.sailing where daily_schedule_id=slot.id
      and daily_service_date=slot.service_date and daily_departure_time=slot.departure_time) then continue; end if;
    begin
      if not slot.route_active then raise exception 'Activate the route and both ports.'; end if;
      if slot.vessel_id is null then raise exception 'Assign a vessel in Edit schedule to start automatic trips.'; end if;
      select * into ship from public.vessel where id=slot.vessel_id for update;
      if not found or not ship.is_active or ship.passenger_capacity is null then raise exception 'Choose an active vessel with passenger capacity.'; end if;
      if ship.reference_metadata->>'operator' is distinct from slot.operator or not exists(
        select 1 from public.vessel_route where vessel_id=ship.id and route_id=slot.route_id) then
        raise exception 'Assign a vessel that serves this operator and route.';
      end if;
      minutes:=coalesce(slot.route_minutes,slot.duration_minutes);
      if minutes is null or minutes<=0 then raise exception 'Set the route duration before generating trips.'; end if;
      select * into fares from public.fare_settings where code=ship.id::text;
      if not found then raise exception 'Save fare settings for the assigned vessel.'; end if;
      select * into policy from barkolink_private.sailing_status_policy where operator=slot.operator;
      if not found or policy.boarding_lead_minutes is null then raise exception 'Set the operator-confirmed boarding policy.'; end if;
      -- Link a matching manual trip rather than duplicate it. Cancelled occurrences stay cancelled.
      if exists(select 1 from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
        and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null) then
        update public.sailing set daily_schedule_id=slot.id,daily_service_date=slot.service_date,daily_departure_time=slot.departure_time
          where code=(select code from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
            and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null order by code limit 1);
        continue;
      end if;
      trip_code:='DLY'||to_char(slot.service_date,'YYYYMMDD')||'-'||upper(substr(md5(slot.id::text||slot.departure_time),1,12));
      insert into public.sailing(code,vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,duration_minutes,
        regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,boarding_at,boarding_time_source,
        daily_schedule_id,daily_service_date,daily_departure_time)
      values(trip_code,ship.id,slot.origin_port_id,slot.destination_port_id,slot.departure,slot.departure+make_interval(mins=>minutes),minutes,
        fares.regular_fare,greatest(1,round(fares.regular_fare*(100-fares.student_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.senior_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.child_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pwd_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pregnant_discount)::numeric/100)::integer),ship.passenger_capacity,
        slot.departure-make_interval(mins=>policy.boarding_lead_minutes),policy.boarding_time_source,
        slot.id,slot.service_date,slot.departure_time);
      created:=created+1;
    exception when others then
      -- One blocked departure must not prevent other vessels from being scheduled.
      update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(
        jsonb_build_object('departureAt',slot.departure,'reason',sqlerrm))
        where id=slot.id and jsonb_array_length(generation_issues)<10;
    end;
  end loop;
  return created;
end $$;

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v50;
create function barkolink_private.execute_daily_automation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; schedule_id uuid; selected_vessel uuid;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    raise exception 'Unknown daily schedule operation.';
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation='AdminSaveDailySchedule' then
    selected_vessel:=nullif(args->>'vesselId','')::uuid;
    if coalesce((args->>'isActive')::boolean,false) and selected_vessel is null then raise exception 'Assign a vessel before activating automatic daily trips.'; end if;
    if selected_vessel is not null and not exists(select 1 from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
      where v.id=selected_vessel and v.is_active and v.reference_metadata->>'operator'=args->>'operator'
      and vr.route_id=(args->>'routeId')::uuid) then raise exception 'Choose an active vessel assigned to this operator and route.'; end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
    select id into schedule_id from barkolink_private.daily_schedule where operator=trim(args->>'operator') and route_id=(args->>'routeId')::uuid;
    update barkolink_private.daily_schedule set vessel_id=selected_vessel where id=schedule_id;
  elsif operation='AdminSetDailyScheduleActive' then
    if (args->>'isActive')::boolean and exists(select 1 from barkolink_private.daily_schedule where id=(args->>'id')::uuid and vessel_id is null) then
      raise exception 'Assign a vessel in Edit schedule before resuming automatic trips.';
    end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
  end if;
  if operation<>'AdminDailySchedules' then perform barkolink_private.generate_daily_trips(); end if;
  result:=barkolink_private.execute_flexible_discounts_v50('AdminDailySchedules','{}',actor_uid,actor_role);
  return result || jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(item||jsonb_build_object('vesselId',s.vessel_id,'vesselName',v.name,
      'generationIssues',s.generation_issues,'lastGeneratedAt',s.last_generated_at,
      'generatedCount',(select count(*) from public.sailing t where t.daily_schedule_id=s.id and t.departure_at>now() and t.status<>'CANCELLED')) order by position),'[]')
      from jsonb_array_elements(result->'schedules') with ordinality entries(item,position)
      join barkolink_private.daily_schedule s on s.id=(item->>'id')::uuid left join public.vessel v on v.id=s.vessel_id),
    'vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator',
      'routeIds',(select coalesce(jsonb_agg(vr.route_id),'[]') from public.vessel_route vr where vr.vessel_id=v.id)) order by v.name),'[]')
      from public.vessel v where v.is_active and v.passenger_capacity is not null));
end $$;
-- Keep the existing non-daily dispatch depth and Boarding authorization unchanged.
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare trip public.sailing; assigned uuid; policy barkolink_private.sailing_status_policy;
  boarding_time timestamptz; reason text; previous_time timestamptz; effective_time timestamptz;
begin
  if operation in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    return barkolink_private.execute_daily_automation(operation,args,actor_uid,actor_role);
  end if;
  if operation not in ('BoardingSailingTiming','BoardingSetSailingTiming') then
    return barkolink_private.execute_flexible_discounts_v47(operation,args,actor_uid,actor_role);
  end if;
  if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('BOARDING','ADMIN') then
    raise exception 'Boarding staff access required.' using errcode='42501';
  end if;
  if actor_role='BOARDING' then
    -- Hold the assignment until the read/save finishes, before locking the trip.
    select assigned_port_id into assigned from public.app_user where uid=actor_uid and role='BOARDING' for share;
    if assigned is null or not exists(select 1 from public.port where id=assigned and is_active) then
      raise exception 'No active port is assigned to your staff account. Ask an administrator to assign your port.' using errcode='42501';
    end if;
  end if;
  select * into trip from public.sailing where code=args->>'sailingCode' for update;
  if not found then raise exception 'Sailing was not found.'; end if;
  if actor_role='BOARDING' and trip.origin_port_id is distinct from assigned then
    raise exception 'This record is outside your assigned port.' using errcode='42501';
  end if;
  select p.* into policy from barkolink_private.sailing_status_policy p
    join public.vessel v on v.reference_metadata->>'operator'=p.operator where v.id=trip.vessel_id;
  previous_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  if operation='BoardingSetSailingTiming' then
    if trip.status not in ('SCHEDULED','BOARDING') or trip.departure_at<=now() then
      raise exception 'Adjust boarding time only for scheduled or boarding trips before departure.';
    end if;
    -- A stale dialog must not overwrite an Admin reschedule or another staff edit.
    if nullif(args->>'expectedUpdatedAt','') is null or
      (args->>'expectedUpdatedAt')::timestamptz is distinct from trip.updated_at then
      raise exception 'This trip changed. Reload its boarding details and try again.' using errcode='40001';
    end if;
    boarding_time:=nullif(args->>'boardingAt','')::timestamptz;
    reason:=nullif(trim(args->>'reason'),'');
    if boarding_time is null or not isfinite(boarding_time) or boarding_time>=trip.departure_at or
      boarding_time<trip.departure_at-interval '7 days' then
      raise exception 'Set boarding between 1 minute and 7 days before departure.';
    end if;
    if boarding_time>trip.departure_at-interval '1 minute' then
      raise exception 'Set boarding at least 1 minute before departure.';
    end if;
    if reason is null or length(reason) not between 5 and 500 then
      raise exception 'Enter a reason of 5 to 500 characters for the boarding time change.';
    end if;
    if trip.status='BOARDING' and boarding_time>now() then
      raise exception 'Boarding has already started. Ask an administrator to delay or reschedule the trip instead.';
    end if;
    update public.sailing set boarding_at=boarding_time,boarding_time_source=reason,updated_at=clock_timestamp()
      where code=trip.code returning * into trip;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
      values(actor_uid,'BOARDING_TIME_UPDATED','sailing',trip.code,jsonb_build_object(
        'boardingAt',jsonb_build_object('before',previous_time,'after',boarding_time),
        'departureAt',trip.departure_at,'reason',reason));
  end if;
  effective_time:=coalesce(trip.boarding_at,trip.departure_at-make_interval(mins=>policy.boarding_lead_minutes));
  return jsonb_build_object('timing',jsonb_build_object(
    'sailingCode',trip.code,'departureAt',trip.departure_at,'boardingAt',trip.boarding_at,
    'effectiveBoardingAt',effective_time,'boardingTimeSource',coalesce(trip.boarding_time_source,policy.boarding_time_source),
    'usesOperatorDefault',trip.boarding_at is null,'updatedAt',trip.updated_at,'status',trip.status,
    'canEdit',trip.status in ('SCHEDULED','BOARDING') and trip.departure_at>now()));
end $$;

revoke all on all functions in schema barkolink_private from public,anon,authenticated;

do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-generate-daily-trips','* * * * *','select barkolink_private.generate_daily_trips();')$schedule$;
  end if;
end $$;


-- 052_daily_fleet_rotation.sql
-- Rotate eligible vessels instead of assigning every route departure to one ship.
alter table barkolink_private.daily_schedule add column assignment_mode text not null default 'FIXED'
  check(assignment_mode in ('FIXED','FLEET'));

create or replace function barkolink_private.generate_daily_trips() returns integer
language plpgsql security definer set search_path='' as $$
declare slot record; ship public.vessel; fares public.fare_settings; policy barkolink_private.sailing_status_policy;
  minutes integer; trip_code text; created integer:=0; chosen boolean; attempts jsonb; matched_code text;
begin
  if not pg_try_advisory_xact_lock(hashtext('barkolink-generate-daily-trips')) then return 0; end if;
  update barkolink_private.daily_schedule set generation_issues='[]',last_generated_at=now() where is_active;
  -- All routes are processed together chronologically, so outbound/return pairs connect.
  for slot in
    select s.*,r.origin_port_id,r.destination_port_id,r.duration_minutes as route_minutes,
      r.is_active and o.is_active and d.is_active as route_active,
      (now() at time zone 'Asia/Manila')::date + day_offset as service_date, departure_time,
      (((now() at time zone 'Asia/Manila')::date + day_offset) + departure_time::time) at time zone 'Asia/Manila' as departure
    from barkolink_private.daily_schedule s join public.ferry_route r on r.id=s.route_id
    join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id
    cross join generate_series(0,6) day_offset cross join unnest(s.departure_times) departure_time
    where s.is_active
    order by departure,s.id
  loop
    if slot.departure<=now() or exists(select 1 from public.sailing where daily_schedule_id=slot.id
      and daily_service_date=slot.service_date and daily_departure_time=slot.departure_time) then continue; end if;
    begin
      if not slot.route_active then raise exception 'Activate the route and both ports.'; end if;
      if slot.assignment_mode='FIXED' and slot.vessel_id is null then raise exception 'Assign a vessel in Edit schedule to start automatic trips.'; end if;
      minutes:=coalesce(slot.route_minutes,slot.duration_minutes);
      if minutes is null or minutes<=0 then raise exception 'Set the route duration before generating trips.'; end if;
      select * into policy from barkolink_private.sailing_status_policy where operator=slot.operator;
      if not found or policy.boarding_lead_minutes is null then raise exception 'Set the operator-confirmed boarding policy.'; end if;
      chosen:=false;attempts:='[]';
      for ship in
        select v.* from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
        where vr.route_id=slot.route_id and v.is_active and v.passenger_capacity is not null
          and v.reference_metadata->>'operator'=slot.operator
          and (slot.assignment_mode='FLEET' or v.id=slot.vessel_id)
        order by
          case when exists(select 1 from public.sailing t where t.vessel_id=v.id and t.departure_at=slot.departure
            and t.origin_port_id=slot.origin_port_id and t.destination_port_id=slot.destination_port_id and t.daily_schedule_id is null) then 0 else 1 end,
          (select count(*) from public.sailing t where t.vessel_id=v.id and t.departure_at>=now() and t.status<>'CANCELLED'),v.id
        for update of v
      loop
        begin
          select * into fares from public.fare_settings where code=ship.id::text;
          if not found then raise exception 'Save fare settings for this vessel.'; end if;
          select code into matched_code from public.sailing where vessel_id=ship.id and origin_port_id=slot.origin_port_id
            and destination_port_id=slot.destination_port_id and departure_at=slot.departure and daily_schedule_id is null order by code limit 1;
          if found then
            update public.sailing set daily_schedule_id=slot.id,daily_service_date=slot.service_date,daily_departure_time=slot.departure_time where code=matched_code;
            chosen:=true;exit;
          end if;
      trip_code:='DLY'||to_char(slot.service_date,'YYYYMMDD')||'-'||upper(substr(md5(slot.id::text||slot.departure_time),1,12));
      insert into public.sailing(code,vessel_id,origin_port_id,destination_port_id,departure_at,arrival_at,duration_minutes,
        regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,boarding_at,boarding_time_source,
        daily_schedule_id,daily_service_date,daily_departure_time)
      values(trip_code,ship.id,slot.origin_port_id,slot.destination_port_id,slot.departure,slot.departure+make_interval(mins=>minutes),minutes,
        fares.regular_fare,greatest(1,round(fares.regular_fare*(100-fares.student_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.senior_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.child_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pwd_discount)::numeric/100)::integer),
        greatest(1,round(fares.regular_fare*(100-fares.pregnant_discount)::numeric/100)::integer),ship.passenger_capacity,
        slot.departure-make_interval(mins=>policy.boarding_lead_minutes),policy.boarding_time_source,
        slot.id,slot.service_date,slot.departure_time);
          created:=created+1;chosen:=true;exit;
        exception when others then
          attempts:=attempts||jsonb_build_array(jsonb_build_object('vessel',ship.name,'reason',sqlerrm));
        end;
      end loop;
      if not chosen then
        update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(jsonb_build_object(
          'departureAt',slot.departure,
          'reason',case when jsonb_array_length(attempts)=0 then 'No active vessel is assigned to this operator and route.'
            when slot.assignment_mode='FIXED' then attempts->0->>'reason'
            else 'No vessel is available at the departure port for this time. Review vessel locations and conflicting trips.' end,
          'vesselIssues',attempts)) where id=slot.id and jsonb_array_length(generation_issues)<10;
      end if;
    exception when others then
      -- One blocked departure must not prevent other vessels from being scheduled.
      update barkolink_private.daily_schedule set generation_issues=generation_issues||jsonb_build_array(
        jsonb_build_object('departureAt',slot.departure,'reason',sqlerrm))
        where id=slot.id and jsonb_array_length(generation_issues)<10;
    end;
  end loop;
  return created;
end $$;

create or replace function barkolink_private.execute_daily_automation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; schedule_id uuid; selected_vessel uuid; selected_mode text;
begin
  if operation not in ('AdminDailySchedules','AdminSaveDailySchedule','AdminSetDailyScheduleActive') then
    raise exception 'Unknown daily schedule operation.';
  end if;
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if operation='AdminSaveDailySchedule' then
    selected_mode:=coalesce(nullif(args->>'assignmentMode',''),case when nullif(args->>'vesselId','') is not null then 'FIXED' end,
      (select assignment_mode from barkolink_private.daily_schedule where id=nullif(args->>'id','')::uuid),'FLEET');
    if selected_mode not in ('FIXED','FLEET') then raise exception 'Choose automatic fleet rotation or a fixed vessel.'; end if;
    selected_vessel:=case when selected_mode='FIXED' then nullif(args->>'vesselId','')::uuid end;
    if selected_mode='FIXED' and coalesce((args->>'isActive')::boolean,false) and selected_vessel is null then raise exception 'Assign a vessel before activating automatic daily trips.'; end if;
    if selected_vessel is not null and not exists(select 1 from public.vessel v join public.vessel_route vr on vr.vessel_id=v.id
      where v.id=selected_vessel and v.is_active and v.reference_metadata->>'operator'=args->>'operator'
      and vr.route_id=(args->>'routeId')::uuid) then raise exception 'Choose an active vessel assigned to this operator and route.'; end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
    select id into schedule_id from barkolink_private.daily_schedule where operator=trim(args->>'operator') and route_id=(args->>'routeId')::uuid;
    update barkolink_private.daily_schedule set vessel_id=selected_vessel,assignment_mode=selected_mode where id=schedule_id;
  elsif operation='AdminSetDailyScheduleActive' then
    if (args->>'isActive')::boolean and exists(select 1 from barkolink_private.daily_schedule where id=(args->>'id')::uuid and vessel_id is null and assignment_mode='FIXED') then
      raise exception 'Assign a vessel in Edit schedule before resuming automatic trips.';
    end if;
    result:=barkolink_private.execute_flexible_discounts_v50(operation,args,actor_uid,actor_role);
  end if;
  if operation<>'AdminDailySchedules' then perform barkolink_private.generate_daily_trips(); end if;
  result:=barkolink_private.execute_flexible_discounts_v50('AdminDailySchedules','{}',actor_uid,actor_role);
  return result || jsonb_build_object(
    'schedules',(select coalesce(jsonb_agg(item||jsonb_build_object('vesselId',s.vessel_id,'vesselName',v.name,'assignmentMode',s.assignment_mode,
      'fleetCount',(select count(*) from public.vessel fv join public.vessel_route vr on vr.vessel_id=fv.id
        where vr.route_id=s.route_id and fv.is_active and fv.passenger_capacity is not null and fv.reference_metadata->>'operator'=s.operator),
      'generationIssues',s.generation_issues,'lastGeneratedAt',s.last_generated_at,
      'generatedCount',(select count(*) from public.sailing t where t.daily_schedule_id=s.id and t.departure_at>now() and t.status<>'CANCELLED')) order by position),'[]')
      from jsonb_array_elements(result->'schedules') with ordinality entries(item,position)
      join barkolink_private.daily_schedule s on s.id=(item->>'id')::uuid left join public.vessel v on v.id=s.vessel_id),
    'vessels',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator',
      'routeIds',(select coalesce(jsonb_agg(vr.route_id),'[]') from public.vessel_route vr where vr.vessel_id=v.id)) order by v.name),'[]')
      from public.vessel v where v.is_active and v.passenger_capacity is not null));
end $$;

revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 053_shared_trp_codes.sql
-- Manual and recurring trips share a non-blocking sequence-backed TRP allocator.
-- Sequence values are never reused, including after failed/cancelled operations.
create sequence barkolink_private.trip_code_serial;
select setval('barkolink_private.trip_code_serial',coalesce((select max(substring(code from 13)::bigint)
  from public.sailing where code ~ '^TRP[0-9]{4}-[0-9]{7,}$'),0)+1,false);

create function barkolink_private.allocate_trip_code() returns text
language plpgsql volatile set search_path='' as $$
declare serial bigint;
begin
  serial:=nextval('barkolink_private.trip_code_serial');
  return to_char(now() at time zone 'Asia/Manila','"TRP"YYYY-MMDD')||
    case when serial<1000 then lpad(serial::text,3,'0') else serial::text end;
end $$;
create or replace function barkolink_private.next_trip_code() returns text
language sql stable set search_path='' as $$
  select to_char(now() at time zone 'Asia/Manila','"TRP"YYYY-MMDD')||
    case when serial<1000 then lpad(serial::text,3,'0') else serial::text end
  from (select last_value+case when is_called then 1 else 0 end serial from barkolink_private.trip_code_serial) candidate;
$$;

do $$ declare definition text; begin
  definition:=pg_get_functiondef('barkolink_private.generate_daily_trips()'::regprocedure);
  if position('trip_code:=''DLY''' in definition)=0 then raise exception 'Expected the fleet generator before installing TRP allocation.';end if;
  execute replace(definition,
    'trip_code:=''DLY''||to_char(slot.service_date,''YYYYMMDD'')||''-''||upper(substr(md5(slot.id::text||slot.departure_time),1,12));',
    'trip_code:=barkolink_private.allocate_trip_code();');
  definition:=pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure);
  if position('new_code := barkolink_private.next_trip_code();' in definition)=0 then raise exception 'Expected the manual trip creation allocator.';end if;
  execute replace(definition,'new_code := barkolink_private.next_trip_code();','new_code := barkolink_private.allocate_trip_code();');
end $$;
revoke all on sequence barkolink_private.trip_code_serial from public,anon,authenticated;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;


-- 054_initial_vessel_accommodation_classes.sql
-- Editable application allocations, not certified physical class capacities.
-- Complete the current Starlite catalog once. Never reset a complete, edited catalog.
do $$
declare ship record; class record; reserved integer;
begin
  for ship in select v.* from public.vessel v where v.is_active and v.passenger_capacity >= 3
    and v.reference_metadata->>'operator'='Starlite Ferries'
    and (select count(*) from public.accommodation a where a.vessel_id=v.id
      and a.name in ('Economy','Tourist Class','Business Class')) < 3
    order by v.id for update
  loop
    perform pg_advisory_xact_lock(hashtextextended(ship.id::text,42));
    if exists(select 1 from public.accommodation where vessel_id=ship.id and is_active
      and name not in ('Economy','Tourist Class','Business Class')) then
      raise exception 'Review other active accommodation classes on % before allocating seats.',ship.name;
    end if;
    for class in select * from (values
      ('Economy',ship.passenger_capacity-greatest(1,floor(ship.passenger_capacity*.2)::integer)-greatest(1,floor(ship.passenger_capacity*.1)::integer),
        'Standard passenger seating in the Economy accommodation.'),
      ('Tourist Class',greatest(1,floor(ship.passenger_capacity*.2)::integer),
        'Passenger seating in the Tourist Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.'),
      ('Business Class',greatest(1,floor(ship.passenger_capacity*.1)::integer),
        'Passenger seating in the Business Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.')
    ) as classes(name,capacity,description)
    loop
      select coalesce(max(seats),0) into reserved from (
        select sum(b.passenger_count) seats from public.booking b join public.accommodation a on a.id=b.accommodation_id
        where a.vessel_id=ship.id and a.name=class.name and b.status in ('PENDING','CONFIRMED') group by b.sailing_code
      ) occupied;
      if reserved>class.capacity then raise exception 'Allocation for % on % would be below reserved seats.',class.name,ship.name; end if;
      insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(ship.id,class.name,class.description,class.capacity,0,true)
      on conflict(vessel_id,name) do update set capacity=excluded.capacity,is_active=true;
    end loop;
  end loop;
end $$;


-- 055_automatic_welcome_notification.sql
-- Only the designated welcome campaign follows future account registrations.
alter table public.notification_campaign add column is_welcome boolean not null default false;
alter table public.notification_campaign add constraint welcome_audience check (not is_welcome or (audience='ALL' and sailing_code is null));
create unique index notification_one_welcome on public.notification_campaign(is_welcome) where is_welcome;

create function barkolink_private.welcome_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare campaign public.notification_campaign; delivered integer;
begin
  if new.role not in ('PASSENGER','TICKETING','BOARDING','ADMIN') then return new; end if;
  select * into campaign from public.notification_campaign where is_welcome;
  if not found then return new; end if;
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    values(new.uid,campaign.title,campaign.message,'GENERAL',campaign.id)
    on conflict(campaign_id,owner_uid) where campaign_id is not null do nothing;
  get diagnostics delivered=row_count;
  if delivered>0 then
    update public.notification_campaign set recipient_count=recipient_count+delivered where id=campaign.id;
  end if;
  return new;
end $$;
revoke all on function barkolink_private.welcome_account() from public,anon,authenticated;
create trigger account_welcome after insert or update of role on public.app_user
  for each row execute function barkolink_private.welcome_account();

create function barkolink_private.welcome_existing_accounts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.is_welcome then return new; end if;
  insert into public.notification(owner_uid,title,message,category,campaign_id)
    select uid,new.title,new.message,'GENERAL',new.id from public.app_user
    where role in ('PASSENGER','TICKETING','BOARDING','ADMIN')
    on conflict(campaign_id,owner_uid) where campaign_id is not null do nothing;
  update public.notification_campaign set recipient_count=(select count(*) from public.notification where campaign_id=new.id) where id=new.id;
  return new;
end $$;
revoke all on function barkolink_private.welcome_existing_accounts() from public,anon,authenticated;
create trigger campaign_welcome after insert or update of is_welcome on public.notification_campaign
  for each row when(new.is_welcome) execute function barkolink_private.welcome_existing_accounts();

-- Hold registrations until both the backfill and future-registration trigger are ready.
lock table public.app_user in share row exclusive mode;
update public.notification_campaign set is_welcome=true
where id=(select id from public.notification_campaign
  where title='Welcome aboard BarkoLink' and audience='ALL' and sailing_code is null
  order by created_at,id limit 1);


-- 056_claimable_vouchers.sql
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


-- 057_edit_voucher_details.sql
create function barkolink_private.update_voucher_details(args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare offer public.voucher; reserved integer; required integer; limit_value integer; title_value text; description_value text;
begin
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into offer from public.voucher where id=(args->>'id')::uuid for update;
  if not found then raise exception 'Voucher was not found.'; end if;
  if offer.owner_uid is not null then raise exception 'Personal loyalty rewards keep their original reward terms.'; end if;
  title_value:=trim(coalesce(args->>'title','')); description_value:=trim(coalesce(args->>'description',''));
  required:=(args->>'requiredTrips')::integer; limit_value:=(args->>'usageLimit')::integer;
  if length(title_value) not between 3 and 120 or length(description_value)>1000 then raise exception 'Enter a promo name (3 to 120 characters) and description (up to 1,000 characters).'; end if;
  if required is null or required not between 0 and 1000 or (not offer.claimable and required<>0) then raise exception 'Choose a valid voucher mission.'; end if;
  reserved:=barkolink_private.voucher_allocations(offer.id);
  if limit_value is null or limit_value<greatest(1,reserved) then raise exception 'The limit must be at least % to cover existing claims and uses.',greatest(1,reserved); end if;
  if reserved>0 and required<>offer.required_trips then raise exception 'The mission cannot change after a passenger has claimed or used this voucher.'; end if;
  update public.voucher set title=title_value,description=description_value,required_trips=required,usage_limit=limit_value where id=offer.id;
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor_uid,'VOUCHER_DETAILS_UPDATED','voucher',offer.id::text,jsonb_build_object('requiredTrips',required,'usageLimit',limit_value));
  return jsonb_build_object('id',offer.id);
end $$;
do $$
declare definition text; insertion integer;
begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure),E'\r\n',E'\n');
  insertion:=position(E'\nbegin\n' in definition);
  if insertion=0 then raise exception 'Voucher dispatcher insertion point was not found.'; end if;
  execute overlay(definition placing E'  if operation=\'AdminUpdateVoucherDetails\' then return barkolink_private.update_voucher_details(args,actor_uid,actor_role); end if;\n' from insertion+length(E'\nbegin\n') for 0);
end $$;
revoke all on function barkolink_private.update_voucher_details(jsonb,text,text) from public,anon,authenticated;


-- 058_voucher_availability_errors.sql
-- Report voucher availability before asking for a claim; all quote and booking
-- eligibility rules continue through the existing validator.
create or replace function barkolink_private.voucher_quote(args jsonb,actor text) returns jsonb
language plpgsql set search_path='' as $$
declare offer public.voucher; claimed boolean;
begin
  select * into offer from public.voucher where code=upper(trim(args->>'voucherCode'));
  if offer.owner_uid is not null and offer.owner_uid is distinct from actor then
    raise exception 'This loyalty voucher belongs to another passenger.' using errcode='42501';
  end if;
  if found then
    if now()>=offer.expires_at then raise exception 'This voucher has expired. Choose another voucher.';end if;
    if now()<offer.starts_at then raise exception 'This voucher is not available yet. Check its start date.';end if;
    if not offer.is_active then raise exception 'This voucher is inactive. Choose another voucher.';end if;
    if offer.claimable then
      select exists(select 1 from public.voucher_claim c where c.voucher_id=offer.id and c.owner_uid=actor) into claimed;
      if not claimed then raise exception 'Claim this voucher on the Claim vouchers page before using it.';end if;
    end if;
  end if;
  return barkolink_private.voucher_quote_v25(args,actor);
end $$;
revoke all on function barkolink_private.voucher_quote(jsonb,text) from public,anon,authenticated;


-- 059_loyalty_voucher_code_notifications.sql
create or replace function barkolink_private.issue_loyalty_vouchers(actor text) returns void language plpgsql set search_path='' as $$
declare earned integer; reward integer; created_id uuid; created_code text; amount integer; config barkolink_private.loyalty_settings;
begin
  if not exists(select 1 from auth.users where id::text=actor and coalesce(raw_app_meta_data->>'role','PASSENGER')='PASSENGER') then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('loyalty:'||actor,0));
  select * into config from barkolink_private.loyalty_settings where code='DEFAULT' for share;
  earned:=barkolink_private.loyalty_trip_count(actor)/config.trips_per_reward;
  for reward in 1..earned loop
    created_id:=null; amount:=case when reward=1 then config.silver_reward when reward=2 then config.gold_reward else config.platinum_reward end;
    insert into public.voucher(code,discount_type,value,minimum_spend,usage_limit,starts_at,expires_at,is_active,owner_uid,loyalty_reward_number)
    values(barkolink_private.new_voucher_code(),'FIXED',amount,0,1,now(),now()+make_interval(days=>config.expiry_days),true,actor,reward)
    on conflict (owner_uid,loyalty_reward_number) where owner_uid is not null do nothing returning id,code into created_id,created_code;
    if created_id is not null then
      insert into public.notification(owner_uid,title,message,category) values(actor,'Your loyalty voucher is ready',
        'Voucher code: '||created_code||'. You earned PHP '||amount||' off regular fares after '||(reward*config.trips_per_reward)||' completed, paid trips. Your personal voucher applies automatically to your next eligible booking and is valid for '||config.expiry_days||' days.','PROMO');
    end if;
  end loop;
end $$;

revoke all on function barkolink_private.issue_loyalty_vouchers(text) from public,anon,authenticated;


-- 060_role_scoped_notifications.sql
-- Role- and departure-port-scoped operational alerts. Existing notifications stay
-- personal to their owner; legacy staff broadcasts are also checked on every read.
alter table public.notification add column event_key text;
alter table public.notification add column recipient_role text;
alter table public.notification add column port_id uuid references public.port(id);
alter table public.notification add column booking_reference text;
alter table public.notification add column sailing_code text;
alter table public.notification add constraint notification_recipient_role check(recipient_role is null or recipient_role in('PASSENGER','ADMIN','TICKETING','BOARDING'));
create unique index notification_event_owner on public.notification(owner_uid,event_key) where event_key is not null;

create function barkolink_private.notification_visible(n public.notification,actor text,actor_role text) returns boolean
language sql stable set search_path='' as $$
  select n.owner_uid=actor and exists(select 1 from public.app_user u where u.uid=actor and u.role=actor_role)
    and (n.recipient_role is null or n.recipient_role=actor_role)
    and (n.port_id is null or (actor_role in('TICKETING','BOARDING') and barkolink_private.staff_port_matches(n.port_id,actor,actor_role)))
    and (n.campaign_id is null or exists(select 1 from public.notification_campaign c where c.id=n.campaign_id and (
      c.audience='ALL' or (c.audience='STAFF' and actor_role in('ADMIN','TICKETING','BOARDING'))
      or (c.audience in('PASSENGERS','TRIP') and actor_role='PASSENGER'))));
$$;
create function barkolink_private.execute_notifications(operation text,args jsonb,actor text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb;changed integer;
begin
  if nullif(actor,'') is null or actor_role not in('PASSENGER','ADMIN','TICKETING','BOARDING')
    or not exists(select 1 from public.app_user u where u.uid=actor and u.role=actor_role)
    then raise exception 'Your account access changed. Sign in again.' using errcode='42501';end if;
  if operation='MyNotifications' then
    perform barkolink_private.deliver_due_advisory_notifications();
    select jsonb_build_object('notifications',coalesce(jsonb_agg(to_jsonb(n)||jsonb_build_object('category',case when n.category='TRIP' then 'TRIPS' else n.category end) order by n.created_at desc,n.id),'[]')) into result
      from public.notification n where barkolink_private.notification_visible(n,actor,actor_role);
    return result;
  elsif operation='MarkNotificationRead' then
    update public.notification n set read_at=coalesce(read_at,now()) where id=(args->>'id')::uuid and barkolink_private.notification_visible(n,actor,actor_role);
    if not found then raise exception 'Notification was not found.' using errcode='42501';end if;
    return '{}';
  elsif operation='MyMarkAllNotificationsRead' then
    update public.notification n set read_at=now() where read_at is null and barkolink_private.notification_visible(n,actor,actor_role);
    get diagnostics changed=row_count;return jsonb_build_object('marked',changed);
  end if;
  raise exception 'Unsupported notification operation.';
end $$;

do $$declare definition text;insertion integer;begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure),E'\r\n',E'\n');
  insertion:=position(E'\nbegin\n' in definition);
  if insertion=0 then raise exception 'Notification dispatcher insertion point was not found.';end if;
  execute overlay(definition placing E'  if operation in(\'MyNotifications\',\'MarkNotificationRead\',\'MyMarkAllNotificationsRead\') then return barkolink_private.execute_notifications(operation,args,actor_uid,actor_role);end if;\n' from insertion+length(E'\nbegin\n') for 0);
end $$;

create function barkolink_private.notify_booking_staff(b public.booking,event_name text,heading text,detail text,roles text[]) returns void
language plpgsql set search_path='' as $$
declare trip public.sailing;passenger_name text;route_text text;description text;
begin
  select * into trip from public.sailing where code=b.sailing_code;
  select full_name into passenger_name from public.app_user where uid=b.owner_uid;
  select o.name||' to '||d.name into route_text from public.port o,public.port d where o.id=trip.origin_port_id and d.id=trip.destination_port_id;
  description:='Booking '||b.reference||' - '||coalesce(passenger_name,'Passenger')||', '||b.passenger_count||' passenger'||case when b.passenger_count=1 then '' else 's' end||'. '||route_text||', '||to_char(trip.departure_at at time zone 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PH. '||detail;
  insert into public.notification(owner_uid,title,message,category,event_key,recipient_role,port_id,booking_reference,sailing_code)
    select u.uid,heading,description,'BOOKING',b.id::text||':'||event_name,u.role,
      case when u.role='ADMIN' then null else trip.origin_port_id end,b.reference,b.sailing_code
    from public.app_user u where u.role=any(roles) and (u.role='ADMIN' or barkolink_private.staff_port_matches(trip.origin_port_id,u.uid,u.role))
    on conflict(owner_uid,event_key) where event_key is not null do nothing;
end $$;

create function barkolink_private.booking_operational_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status in('PENDING','CONFIRMED') then
      perform barkolink_private.notify_booking_staff(new,'created','New booking received',
        case when new.payment_status='PAID' then 'Payment received.' else 'Awaiting passenger payment.' end,array['ADMIN','TICKETING','BOARDING']);
    end if;
  else
    if new.status is distinct from old.status and new.status in('CANCELLED','EXPIRED') then
      perform barkolink_private.notify_booking_staff(new,lower(new.status),'Reservation '||lower(new.status),
        case when new.status='EXPIRED' then 'Payment deadline passed.' else coalesce(nullif(new.cancellation_reason,''),'The reservation was cancelled.') end,array['ADMIN','TICKETING','BOARDING']);
      if new.status='CANCELLED' and not exists(select 1 from public.sailing s where s.code=new.sailing_code and s.status='CANCELLED') then
        insert into public.notification(owner_uid,title,message,category,event_key,recipient_role,booking_reference,sailing_code)
          select u.uid,'Reservation cancelled','Reservation '||new.reference||' has been cancelled. Check My Bookings for its latest details.','BOOKING',new.id::text||':owner-cancelled','PASSENGER',new.reference,new.sailing_code
          from public.app_user u where u.uid=new.owner_uid and u.role='PASSENGER'
          on conflict(owner_uid,event_key) where event_key is not null do nothing;
      end if;
    end if;
    if new.payment_status='PAID' and old.payment_status is distinct from new.payment_status then
      if new.payment_method='PAYMONGO_TEST' and new.payment_verified_at is null then
        perform barkolink_private.notify_booking_staff(new,'payment-review','Online payment needs verification','The provider confirmed payment. Verify it before issuing passenger tickets.',array['ADMIN','TICKETING']);
      elsif new.status='CONFIRMED' then
        perform barkolink_private.notify_booking_staff(new,'tickets-ready','Passenger tickets ready','Payment is verified. Check the passenger manifest for boarding.',array['ADMIN','BOARDING']);
      end if;
    end if;
    if old.payment_verified_at is null and new.payment_verified_at is not null and new.payment_status='PAID' and new.status='CONFIRMED' then
      perform barkolink_private.notify_booking_staff(new,'tickets-ready','Passenger tickets ready','Payment is verified. Check the passenger manifest for boarding.',array['ADMIN','BOARDING']);
    end if;
    if new.payment_status is distinct from old.payment_status and new.payment_status in('REFUND_PENDING','REFUNDED') then
      perform barkolink_private.notify_booking_staff(new,lower(new.payment_status),case when new.payment_status='REFUND_PENDING' then 'Booking refund needs attention' else 'Booking refund recorded' end,
        case when new.payment_status='REFUND_PENDING' then 'Review the booking and arrange the refund.' else 'The refund has been recorded.' end,array['ADMIN','TICKETING']);
    end if;
  end if;
  return new;
end $$;
create trigger booking_operational_notifications after insert or update of status,payment_status,payment_verified_at on public.booking
  for each row execute function barkolink_private.booking_operational_notifications();

create function barkolink_private.sailing_operational_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare detail text;event_name text;heading text;
begin
  if row(new.status,new.departure_at,new.arrival_at,new.origin_port_id,new.destination_port_id,new.vessel_id) is not distinct from row(old.status,old.departure_at,old.arrival_at,old.origin_port_id,old.destination_port_id,old.vessel_id) then return new;end if;
  event_name:='sailing:'||new.code||':'||md5(jsonb_build_array(new.status,new.departure_at,new.arrival_at,new.origin_port_id,new.destination_port_id,new.vessel_id)::text);
  heading:=case when new.status is distinct from old.status then 'Sailing '||lower(new.status) else 'Sailing schedule updated' end;
  select 'Trip '||new.code||': '||o.name||' to '||d.name||', '||to_char(new.departure_at at time zone 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PH. Status: '||initcap(new.status)||'. Check the latest sailing board and passenger manifest.' into detail
    from public.port o,public.port d where o.id=new.origin_port_id and d.id=new.destination_port_id;
  insert into public.notification(owner_uid,title,message,category,event_key,recipient_role,port_id,sailing_code)
    select u.uid,heading,detail,'TRIPS',event_name,u.role,case when u.role='ADMIN' then null else u.assigned_port_id end,new.code
    from public.app_user u where u.role='ADMIN' or (u.role in('TICKETING','BOARDING') and u.assigned_port_id in(old.origin_port_id,new.origin_port_id) and barkolink_private.staff_port_matches(u.assigned_port_id,u.uid,u.role))
    on conflict(owner_uid,event_key) where event_key is not null do nothing;
  return new;
end $$;
create trigger sailing_operational_notifications after update of status,departure_at,arrival_at,origin_port_id,destination_port_id,vessel_id on public.sailing
  for each row execute function barkolink_private.sailing_operational_notifications();

create function barkolink_private.passenger_attendance_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.booking;
begin
  if new.ticket_status is not distinct from old.ticket_status or new.ticket_status not in('CHECKED_IN','BOARDED') then return new;end if;
  select * into b from public.booking where id=new.booking_id;
  insert into public.notification(owner_uid,title,message,category,event_key,recipient_role,booking_reference,sailing_code)
    select u.uid,case when new.ticket_status='BOARDED' then 'Passenger boarded' else 'Passenger checked in' end,
      new.full_name||case when new.ticket_status='BOARDED' then ' has boarded' else ' has checked in' end||' for booking '||b.reference||', trip '||b.sailing_code||'.',
      'BOOKING',new.id::text||':'||new.ticket_status,'PASSENGER',b.reference,b.sailing_code
    from public.app_user u where u.uid=b.owner_uid and u.role='PASSENGER'
    on conflict(owner_uid,event_key) where event_key is not null do nothing;
  return new;
end $$;
create trigger passenger_attendance_notification after update of ticket_status on public.booking_passenger
  for each row execute function barkolink_private.passenger_attendance_notification();

revoke all on function barkolink_private.notification_visible(public.notification,text,text),barkolink_private.execute_notifications(text,jsonb,text,text),
 barkolink_private.notify_booking_staff(public.booking,text,text,text,text[]),barkolink_private.booking_operational_notifications(),
 barkolink_private.sailing_operational_notifications(),barkolink_private.passenger_attendance_notification() from public,anon,authenticated;

-- Published travel advisories reach passengers only. Drafts stay private; scheduled
-- notices are delivered when active, even if their page is not open.
alter table public.travel_advisory add column notification_revision uuid not null default gen_random_uuid();
alter table public.travel_advisory add column notification_announced_at timestamptz;
update public.travel_advisory set notification_announced_at=now() where published and starts_at<=now();
create function barkolink_private.deliver_due_advisory_notifications() returns integer
language plpgsql set search_path='' as $$
declare advisory public.travel_advisory;delivered integer:=0;changed integer;
begin
  for advisory in select * from public.travel_advisory where published and starts_at<=now() and ends_at>now()
    and notification_announced_at is null order by starts_at,id limit 50 for update skip locked loop
    insert into public.notification(owner_uid,title,message,category,event_key,recipient_role,sailing_code)
      select u.uid,'Travel advisory: '||advisory.title,advisory.message||' Valid until '||to_char(advisory.ends_at at time zone 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PH.',
        'TRIPS','advisory:'||advisory.id::text||':'||advisory.notification_revision::text,'PASSENGER',advisory.sailing_code
      from public.app_user u where u.role='PASSENGER' and (advisory.sailing_code is null or exists(select 1 from public.booking b where b.owner_uid=u.uid and b.sailing_code=advisory.sailing_code and b.status in('PENDING','CONFIRMED')))
      on conflict(owner_uid,event_key) where event_key is not null do nothing;
    get diagnostics changed=row_count;delivered:=delivered+changed;
    update public.travel_advisory set notification_announced_at=now() where id=advisory.id;
  end loop;
  return delivered;
end $$;
create function barkolink_private.advisory_notification_revision() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if row(new.title,new.message,new.category,new.priority,new.sailing_code,new.starts_at,new.ends_at,new.published) is not distinct from row(old.title,old.message,old.category,old.priority,old.sailing_code,old.starts_at,old.ends_at,old.published) then return new;end if;
  end if;
  new.notification_revision:=gen_random_uuid();new.notification_announced_at:=null;return new;
end $$;
create function barkolink_private.advisory_notification_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.published and new.starts_at<=now() and new.ends_at>now() and new.notification_announced_at is null then
    perform barkolink_private.deliver_due_advisory_notifications();
  end if;
  return new;
end $$;
create trigger advisory_notification_revision before insert or update of title,message,category,priority,sailing_code,starts_at,ends_at,published on public.travel_advisory
 for each row execute function barkolink_private.advisory_notification_revision();
create trigger advisory_notification_delivery after insert or update of title,message,category,priority,sailing_code,starts_at,ends_at,published on public.travel_advisory
 for each row execute function barkolink_private.advisory_notification_delivery();
revoke all on function barkolink_private.deliver_due_advisory_notifications(),barkolink_private.advisory_notification_revision(),barkolink_private.advisory_notification_delivery() from public,anon,authenticated;


-- 061_bounded_workspace_reads.sql
-- Sort/filter and page in one database snapshot instead of collecting offset pages.
create function barkolink_private.admin_directory(operation text,args jsonb,actor text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare source text; ordering text; output_key text; result jsonb;
  requested text:=coalesce(args->>'sort','');
  take integer:=least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)));
  skip integer:=greatest(0,coalesce((args->>'page')::integer,0));
begin
  if nullif(actor,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501';end if;
  if operation='AdminSailings' then
    output_key:='sailings';
    source:=$q$select barkolink_private.sailing_json(s) item,s.code identity,s.departure_at created,
      s.departure_at departure,v.name name from public.sailing s join public.vessel v on v.id=s.vessel_id
      where (coalesce($1->>'status','ALL')='ALL' or s.status=$1->>'status')
      and (coalesce($1->>'search','')='' or barkolink_private.sailing_json(s)::text ilike '%'||($1->>'search')||'%')$q$;
    ordering:=case requested when 'name:asc' then 'lower(name) asc' when 'name:desc' then 'lower(name) desc'
      when 'departure:asc' then 'departure asc' when 'departure:desc' then 'departure desc' else 'created desc' end;
  elsif operation='AdminUsers' then
    output_key:='users';
    source:=$q$select to_jsonb(u) item,u.uid identity,u.created_at created,u.full_name name from public.app_user u
      where u.role<>'WALK_IN' and (coalesce($1->>'status','ALL')='ALL' or u.role=$1->>'status')
      and (coalesce($1->>'search','')='' or concat_ws(' ',u.full_name,u.email,u.phone,u.uid) ilike '%'||($1->>'search')||'%')$q$;
    ordering:=case requested when 'name:asc' then 'lower(name) asc' when 'name:desc' then 'lower(name) desc' else 'created desc' end;
  elsif operation='AdminPassengerRecords' then
    output_key:='bookingPassengers';
    source:=$q$select barkolink_private.passenger_json(p) item,p.id::text identity,p.created_at created,p.full_name name
      from public.booking_passenger p join public.booking b on b.id=p.booking_id
      where (coalesce($1->>'sailingCode','ALL')='ALL' or b.sailing_code=$1->>'sailingCode')
      and (not coalesce(($1->>'paidOnly')::boolean,false) or (b.status='CONFIRMED' and b.payment_status='PAID'))
      and (coalesce($1->>'status','ALL')='ALL' or case when b.status in('CANCELLED','EXPIRED') then b.status when b.payment_status<>'PAID' then 'PAYMENT PENDING' else p.ticket_status end=$1->>'status')
      and (coalesce($1->>'search','')='' or barkolink_private.passenger_json(p)::text ilike '%'||($1->>'search')||'%')$q$;
    ordering:=case requested when 'name:asc' then 'lower(name) asc' when 'name:desc' then 'lower(name) desc' else 'created desc' end;
  elsif operation='StaffBookings' then
    output_key:='bookings';
    source:=$q$select barkolink_private.booking_json(b) item,b.id::text identity,b.created_at created,
      b.reference,b.total amount,s.departure_at departure,(b.payment_status='PAID') needs_verification from public.booking b join public.sailing s on s.code=b.sailing_code
      where ((coalesce($1->>'status','ALL') not in('ACTION_REQUIRED','AWAITING_VERIFICATION') and
        (coalesce($1->>'status','ALL')='ALL' or b.status=$1->>'status' or (b.payment_status=$1->>'status' and ($1->>'status'<>'UNPAID' or b.status in('PENDING','CONFIRMED')))))
        or ($1->>'status' in('ACTION_REQUIRED','AWAITING_VERIFICATION') and b.status in('PENDING','CONFIRMED') and s.departure_at>now() and s.status in('SCHEDULED','BOARDING')
          and ((b.payment_status='PAID' and b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null)
            or ($1->>'status'='ACTION_REQUIRED' and b.payment_status='UNPAID' and b.payment_deadline>now()))))
      and (coalesce($1->>'search','')='' or barkolink_private.booking_json(b)::text ilike '%'||($1->>'search')||'%')$q$;
    ordering:=case requested when 'amount:asc' then 'amount asc' when 'amount:desc' then 'amount desc'
      when 'departure:asc' then 'departure asc' when 'departure:desc' then 'departure desc'
      when 'reference:asc' then 'reference asc' when 'reference:desc' then 'reference desc'
      else case when args->>'status' in('ACTION_REQUIRED','AWAITING_VERIFICATION') then 'needs_verification desc,created asc' else 'created desc' end end;
  elsif operation='AdminNotificationCampaigns' then
    output_key:='campaigns';take:=30;
    source:=$q$select to_jsonb(c) item,c.id::text identity,c.created_at created,c.title,c.recipient_count
      from public.notification_campaign c where coalesce($1->>'search','')=''
      or concat_ws(' ',c.title,c.message,c.audience,c.sailing_code) ilike '%'||($1->>'search')||'%'$q$;
    ordering:=case requested when 'createdAt:asc' then 'created asc' when 'title:asc' then 'lower(title) asc'
      when 'recipientCount:desc' then 'recipient_count desc' else 'created desc' end;
  else raise exception 'Unsupported directory.';end if;
  -- ordering/source contain only constants above; all user input remains bound.
  execute format('with filtered as materialized (%s), paged as (select item,row_number() over(order by %s,identity) position from filtered order by %s,identity limit $2 offset $3)
    select jsonb_build_object(%L,coalesce((select jsonb_agg(item order by position) from paged),''[]''::jsonb),''totalCount'',(select count(*) from filtered))',source,ordering,ordering,output_key)
    into result using args,take,skip*take;
  return result;
end $$;

-- Preserve the existing dispatcher depth for reservation/payment operations.
do $$declare definition text;insertion integer;begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure),E'\r\n',E'\n');
  insertion:=position(E'\nbegin\n' in definition);
  if insertion=0 then raise exception 'Directory dispatcher insertion point was not found.';end if;
  execute overlay(definition placing E'  if operation in(\'AdminSailings\',\'AdminUsers\',\'AdminPassengerRecords\',\'AdminNotificationCampaigns\') or (operation=\'StaffBookings\' and actor_role=\'ADMIN\') then return barkolink_private.admin_directory(operation,args,actor_uid,actor_role);end if;\n' from insertion+length(E'\nbegin\n') for 0);
end $$;
revoke all on function barkolink_private.admin_directory(text,jsonb,text,text),barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;

-- A bounded summary is sufficient for the bell; full inbox reads stay explicit.
create or replace function barkolink_private.execute_notifications(operation text,args jsonb,actor text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb;changed integer;
begin
  if nullif(actor,'') is null or actor_role not in('PASSENGER','ADMIN','TICKETING','BOARDING')
    or not exists(select 1 from public.app_user u where u.uid=actor and u.role=actor_role)
    then raise exception 'Your account access changed. Sign in again.' using errcode='42501';end if;
  if operation='MyNotifications' then
    perform barkolink_private.deliver_due_advisory_notifications();
    with visible as materialized (select n.* from public.notification n where n.owner_uid=actor and barkolink_private.notification_visible(n,actor,actor_role)),
    filtered as (select * from visible where (coalesce((args->>'summary')::boolean,false) or (
      (not coalesce((args->>'unreadOnly')::boolean,false) or read_at is null)
      and (coalesce(args->>'category','ALL')='ALL' or case when category='TRIP' then 'TRIPS' else category end=args->>'category')
      and (coalesce(args->>'search','')='' or concat_ws(' ',title,message) ilike '%'||(args->>'search')||'%')))),
    paged as (select * from filtered order by created_at desc,id
      limit case when coalesce((args->>'summary')::boolean,false) then 50 else least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))) end
      offset greatest(0,coalesce((args->>'page')::integer,0))*least(100,greatest(1,coalesce((args->>'pageSize')::integer,100))))
    select jsonb_build_object('notifications',coalesce((select jsonb_agg(to_jsonb(n)||jsonb_build_object('category',case when n.category='TRIP' then 'TRIPS' else n.category end) order by n.created_at desc,n.id) from paged n),'[]'),
      'unreadCount',(select count(*) from visible where read_at is null),'totalCount',(select count(*) from filtered),'inboxCount',(select count(*) from visible),
      'categoryCounts',(select coalesce(jsonb_object_agg(c,n),'{}') from (select case when category='TRIP' then 'TRIPS' else category end c,count(*) n from visible
        where not coalesce((args->>'unreadOnly')::boolean,false) or read_at is null group by 1) counts),
      'categories',(select coalesce(jsonb_agg(c order by c),'[]') from (select distinct case when category='TRIP' then 'TRIPS' else category end c from visible) categories)) into result;
    return result;
  elsif operation='MarkNotificationRead' then
    update public.notification n set read_at=coalesce(read_at,now()) where id=(args->>'id')::uuid and n.owner_uid=actor and barkolink_private.notification_visible(n,actor,actor_role);
    if not found then raise exception 'Notification was not found.' using errcode='42501';end if;return '{}';
  elsif operation='MyMarkAllNotificationsRead' then
    update public.notification n set read_at=now() where read_at is null and n.owner_uid=actor and barkolink_private.notification_visible(n,actor,actor_role);
    get diagnostics changed=row_count;return jsonb_build_object('marked',changed);
  end if;
  raise exception 'Unsupported notification operation.';
end $$;
revoke all on function barkolink_private.execute_notifications(text,jsonb,text,text) from public,anon,authenticated;

-- Scheduled advisories should enter inboxes even when nobody has the app open.
-- The existing authenticated-refresh delivery remains a fallback.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $schedule$select cron.schedule('barkolink-advisory-notifications','* * * * *','select barkolink_private.deliver_due_advisory_notifications();')$schedule$;
  end if;
end $$;


-- 062_today_first_admin_trips.sql
-- Operational trip browsing uses the Philippine calendar day, not the browser
-- or database session timezone. Explicit global sort choices remain available.
create function barkolink_private.admin_sailing_priority(departure timestamptz,state text,at_time timestamptz default now()) returns integer
language sql immutable set search_path='' as $$
  select case
    when (departure at time zone 'Asia/Manila')::date=(at_time at time zone 'Asia/Manila')::date then
      case when state in('SCHEDULED','BOARDING','DELAYED') then 0 else 1 end
    when (departure at time zone 'Asia/Manila')::date>(at_time at time zone 'Asia/Manila')::date then 2
    else 3 end;
$$;
revoke all on function barkolink_private.admin_sailing_priority(timestamptz,text,timestamptz) from public,anon,authenticated;

do $$declare definition text;previous text;begin
  definition:=pg_get_functiondef('barkolink_private.admin_directory(text,jsonb,text,text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,'s.departure_at departure,v.name name from public.sailing',
    's.departure_at departure,barkolink_private.admin_sailing_priority(s.departure_at,s.status) operational_priority,v.name name from public.sailing');
  if definition=previous then raise exception 'Admin sailing source insertion point was not found.';end if;
  previous:=definition;
  definition:=replace(definition,
    'when ''departure:asc'' then ''departure asc'' when ''departure:desc'' then ''departure desc'' else ''created desc'' end;',
    'when ''departure:asc'' then ''departure asc'' when ''departure:desc'' then ''departure desc'' else ''operational_priority asc,case when operational_priority<3 then departure end asc,case when operational_priority=3 then departure end desc'' end;');
  if definition=previous then raise exception 'Admin sailing default-order insertion point was not found.';end if;
  execute definition;
end $$;


-- 063_loyalty_milestone_usage.sql
-- Read-only usage summaries for the three milestone cards. Platinum includes
-- recurring rewards after the third milestone; voucher amounts are not identities.
create function barkolink_private.loyalty_milestone_usage(actor text) returns jsonb
language sql stable set search_path='' as $$
  with rewards as (
    select least(v.loyalty_reward_number,3) reward_number,
      case
        when exists(select 1 from public.booking b where b.voucher_id=v.id) then 'USED'
        when v.expires_at<=now() then 'EXPIRED'
        when not v.is_active then 'UNAVAILABLE'
        when v.starts_at>now() then 'PENDING'
        else 'READY'
      end state
    from public.voucher v where v.owner_uid=actor and v.loyalty_reward_number is not null
  ), summaries as (
    select n.reward_number,
      count(*) filter(where r.state='READY') ready_count,
      count(*) filter(where r.state='USED') used_count,
      count(*) filter(where r.state='EXPIRED') expired_count,
      count(*) filter(where r.state='UNAVAILABLE') unavailable_count,
      count(*) filter(where r.state='PENDING') pending_count
    from generate_series(1,3) n(reward_number)
    left join rewards r using(reward_number) group by n.reward_number
  )
  select jsonb_agg(to_jsonb(s) order by s.reward_number) from summaries s;
$$;
revoke all on function barkolink_private.loyalty_milestone_usage(text) from public,anon,authenticated;

-- Extend the existing MyLoyalty response without another dispatcher wrapper.
-- That branch has already verified PASSENGER and derives actor_uid from Auth.
do $$declare definition text; previous text;begin
  definition:=pg_get_functiondef('barkolink_private.execute_flexible_discounts_v31(text,jsonb,text,text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,
    'return result||jsonb_build_object(''trips_per_reward'',cycle',
    'return result||jsonb_build_object(''milestones'',barkolink_private.loyalty_milestone_usage(actor_uid),''trips_per_reward'',cycle');
  if definition=previous then raise exception 'MyLoyalty milestone insertion point was not found.';end if;
  execute definition;
end $$;


-- 064_manual_loyalty_voucher_copy.sql
-- Rewards are still earned/issued automatically, but passengers choose whether
-- to use them by entering a code and selecting Apply at booking review.
do $$declare definition text;previous text;begin
  definition:=pg_get_functiondef('barkolink_private.issue_loyalty_vouchers(text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,
    'Your personal voucher applies automatically to your next eligible booking and is valid for ',
    'Enter the voucher code at booking review and select Apply. It is valid for ');
  if definition=previous then raise exception 'Loyalty notification wording insertion point was not found.';end if;
  execute definition;
end $$;


-- 065_ticket_travel_window.sql
-- Reject expired travel windows even if the trip status worker has not run.
-- Keep the existing booking/sailing/passenger locks and one-way attendance
-- transitions. Operators must update departure/arrival when rescheduling.
do $$declare definition text; previous text; needle text;begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure),chr(13),'');
  previous:=definition;
  needle:=$needle$      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then$needle$;
  definition:=replace(definition,needle,$replacement$      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null then raise exception 'Staff payment verification is required before admission.'; end if;
      if s.arrival_at<=now() then raise exception 'This ticket travel period has ended. Keep it for transaction records only.'; end if;
      if operation = 'CheckInTicket' then$replacement$);
  if definition=previous then raise exception 'Ticket attendance guard insertion point was not found.';end if;
  execute definition;

  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)'::regprocedure),chr(13),'');
  previous:=definition;
  needle:=$needle$    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then$needle$;
  definition:=replace(definition,needle,$replacement$    if s.arrival_at<=now() then raise exception 'This ticket travel period has ended. Keep it for transaction records only.'; end if;
    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then$replacement$);
  if definition=previous then raise exception 'Ticket QR guard insertion point was not found.';end if;
  execute definition;
end $$;

commit;
