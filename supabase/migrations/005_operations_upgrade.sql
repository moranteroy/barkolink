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
