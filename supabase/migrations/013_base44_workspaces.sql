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
