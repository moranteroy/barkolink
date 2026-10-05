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
