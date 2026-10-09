-- Separate staff assignment directory; passengers never appear here.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v32;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; query text:=trim(coalesce(args->>'search','')); staff_role text:=coalesce(args->>'role','ALL');
  take integer:=least(100,greatest(1,coalesce((args->>'pageSize')::integer,30)));
  skip integer:=greatest(0,coalesce((args->>'page')::integer,0));
begin
  if operation='AdminStaffPortAssignments' then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if length(query)>120 or staff_role not in ('ALL','TICKETING','BOARDING') or skip>100000 then raise exception 'Invalid staff directory filter.'; end if;
    with filtered as (select u.* from public.app_user u where u.role in ('TICKETING','BOARDING')
      and (staff_role='ALL' or u.role=staff_role) and (query='' or strpos(lower(concat_ws(' ',u.full_name,u.email)),lower(query))>0)),
    paged as (select * from filtered order by full_name,uid limit take offset skip*take)
    select jsonb_build_object('staff',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('assigned_port',
      (select to_jsonb(p) from public.port p where p.id=u.assigned_port_id)) order by u.full_name,u.uid) from paged u),'[]'),
      'totalCount',(select count(*) from filtered),
      'ports',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name,p.id),'[]') from public.port p where p.is_active)) into result;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v32(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
