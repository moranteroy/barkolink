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
