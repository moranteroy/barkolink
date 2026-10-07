alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v22;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; pending bigint;
begin
  if operation='StaffBookings' and args->>'status' in ('ACTION_REQUIRED','AWAITING_VERIFICATION') then
    if actor_uid is null or actor_uid='' or coalesce(actor_role,'') not in ('TICKETING','ADMIN') then
      raise exception 'Ticketing access required.' using errcode='42501';
    end if;
    with filtered as (
      select b.*, (b.payment_status='PAID') as needs_verification from public.booking b join public.sailing s on s.code=b.sailing_code
      where b.status in ('PENDING','CONFIRMED') and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING')
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
      where b.status='CONFIRMED' and b.payment_status='PAID' and b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null
      and s.departure_at>now() and s.status in ('SCHEDULED','BOARDING');
    result:=result || jsonb_build_object('awaitingVerification',pending);
  end if;
  return result;
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;
