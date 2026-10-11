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
