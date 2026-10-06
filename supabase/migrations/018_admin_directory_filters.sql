-- Filter complete directories before pagination. Existing role checks are retained.
alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v17;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb; take integer:=least(100,greatest(1,coalesce((args->>'pageSize')::integer,100)));
  skip integer:=greatest(0,coalesce((args->>'page')::integer,0));
  query text:=trim(coalesce(args->>'search','')); state text:=coalesce(args->>'status','ALL');
begin
  if operation in ('AdminSailings','AdminUsers','AdminPassengerRecords','AdminSailingOptions') then
    if actor_uid is null or actor_role<>'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminSailingOptions' then
      select jsonb_build_object('sailings',coalesce(jsonb_agg(barkolink_private.sailing_json(s) order by s.departure_at desc),'[]')) into result from public.sailing s;
    elsif operation='AdminSailings' then
      with filtered as (select s.* from public.sailing s where (state='ALL' or s.status=state)
        and (query='' or barkolink_private.sailing_json(s)::text ilike '%'||query||'%')),
      paged as (select * from filtered order by departure_at desc,code limit take offset skip*take)
      select jsonb_build_object('sailings',coalesce((select jsonb_agg(barkolink_private.sailing_json(p) order by p.departure_at desc,p.code) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    elsif operation='AdminUsers' then
      with filtered as (select u.* from public.app_user u where u.role<>'WALK_IN' and (state='ALL' or u.role=state)
        and (query='' or concat_ws(' ',u.full_name,u.email,u.phone,u.uid) ilike '%'||query||'%')),
      paged as (select * from filtered order by created_at desc,uid limit take offset skip*take)
      select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.uid) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    else
      with filtered as (select p.* from public.booking_passenger p join public.booking b on b.id=p.booking_id
        where (coalesce(args->>'sailingCode','ALL')='ALL' or b.sailing_code=args->>'sailingCode')
        and (not coalesce((args->>'paidOnly')::boolean,false) or (b.status='CONFIRMED' and b.payment_status='PAID'))
        and (state='ALL' or case when b.status in ('CANCELLED','EXPIRED') then b.status when b.payment_status<>'PAID' then 'PAYMENT PENDING' else p.ticket_status end=state)
        and (query='' or barkolink_private.passenger_json(p)::text ilike '%'||query||'%')),
      paged as (select * from filtered order by created_at desc,id limit take offset skip*take)
      select jsonb_build_object('bookingPassengers',coalesce((select jsonb_agg(barkolink_private.passenger_json(p) order by p.created_at desc,p.id) from paged p),'[]'),'totalCount',(select count(*) from filtered)) into result;
    end if;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v17(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;
