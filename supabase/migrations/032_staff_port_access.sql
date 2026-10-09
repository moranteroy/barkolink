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
