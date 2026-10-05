-- Centralize settings history in Audit Logs and capture trusted actor roles for future events.
-- Existing rows retain their history; role lookup for legacy events is marked as current.
alter table public.activity_log add column actor_role text;
create function barkolink_private.capture_audit_actor_role() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.actor_uid is null then
    new.actor_role := 'SYSTEM';
  else
    select coalesce(u.raw_app_meta_data->>'role','PASSENGER') into new.actor_role
      from auth.users u where u.id::text=new.actor_uid;
    if not found then new.actor_role := 'UNKNOWN'; end if;
  end if;
  return new;
end $$;
create trigger activity_log_actor_role before insert on public.activity_log
for each row execute function barkolink_private.capture_audit_actor_role();

create or replace function barkolink_private.execute_workspace(operation text, args jsonb, actor_uid text, actor_role text)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb; search_text text; action_filter text; entity_filter text; start_at timestamptz; end_at timestamptz;
  page_number integer; page_size integer;
begin
  if operation <> 'AdminAuditLog' then
    return barkolink_private.execute_experience(operation,args,actor_uid,actor_role);
  end if;
  if actor_uid is null or actor_uid = '' or actor_role is distinct from 'ADMIN' then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  search_text := lower(trim(coalesce(args->>'search','')));
  entity_filter := nullif(trim(args->>'entityType'),'');
  if length(coalesce(entity_filter,''))>80 then raise exception 'Record type is too long.'; end if;
  action_filter := nullif(trim(args->>'action'),'');
  if length(search_text)>120 or length(coalesce(action_filter,''))>80 then raise exception 'Search is too long.'; end if;
  page_number := coalesce((args->>'page')::integer,0);
  page_size := coalesce((args->>'pageSize')::integer,30);
  if page_number<0 or page_number>100000 or page_size<1 or page_size>100 then raise exception 'Invalid records page.'; end if;
  start_at := nullif(args->>'fromDate','')::date::timestamp at time zone 'Asia/Manila';
  end_at := (nullif(args->>'toDate','')::date + 1)::timestamp at time zone 'Asia/Manila';
  if start_at is not null and end_at is not null and start_at>=end_at then raise exception 'Choose a valid date range.'; end if;
  with filtered as materialized (
    select a.*,coalesce(u.full_name,case when a.actor_uid is null then 'System' else 'Unknown account' end) as actor_name,
      coalesce(a.actor_role,u.role,case when a.actor_uid is null then 'SYSTEM' else 'UNKNOWN' end) as resolved_actor_role,
      a.actor_role is not null as actor_role_recorded from public.activity_log a
    left join public.app_user u on u.uid=a.actor_uid
    where (entity_filter is null or a.entity_type=entity_filter)
      and (action_filter is null or a.action=action_filter)
      and (start_at is null or a.created_at>=start_at) and (end_at is null or a.created_at<end_at)
      and (search_text='' or strpos(lower(concat_ws(' ',u.full_name,coalesce(a.actor_role,u.role),a.action,a.entity_type,a.entity_id)),search_text)>0)
  ), records_page as (
    select * from filtered order by created_at desc,id desc limit page_size offset page_number*page_size
  )
  select jsonb_build_object('records',coalesce((select jsonb_agg((to_jsonb(p)-'resolved_actor_role')||jsonb_build_object('actor_role',p.resolved_actor_role) order by p.created_at desc,p.id desc) from records_page p),'[]'::jsonb),
    'totalCount',(select count(*) from filtered),
    'actions',(select coalesce(jsonb_agg(action order by action),'[]'::jsonb) from (select distinct action from public.activity_log) actions)) into result;
  return result;
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
