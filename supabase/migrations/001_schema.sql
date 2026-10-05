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
