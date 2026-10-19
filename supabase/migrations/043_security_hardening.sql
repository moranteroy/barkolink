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
