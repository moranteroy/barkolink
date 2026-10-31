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
