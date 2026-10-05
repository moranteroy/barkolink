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
