alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v25;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare start_at timestamptz := date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
  if operation='PassengerSailingBoard' then
    if nullif(actor_uid,'') is null or coalesce(actor_role,'') not in ('PASSENGER','ADMIN','TICKETING','BOARDING') then
      raise exception 'Sign in to view the sailing board.' using errcode='42501';
    end if;
    return jsonb_build_object('updated_at',now(),'date',(now() at time zone 'Asia/Manila')::date,'sailings',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',s.code,'departure_at',s.departure_at,'arrival_at',s.arrival_at,'status',s.status,
        'origin',jsonb_build_object('id',o.id,'name',o.name,'city',o.city),
        'destination',jsonb_build_object('id',d.id,'name',d.name,'city',d.city),
        'vessel',jsonb_build_object('name',v.name)) order by s.departure_at,s.code),'[]'::jsonb)
      from public.sailing s join public.port o on o.id=s.origin_port_id
      join public.port d on d.id=s.destination_port_id join public.vessel v on v.id=s.vessel_id
      where (s.departure_at>=start_at and s.departure_at<start_at+interval '1 day')
        or (s.arrival_at>=start_at and s.arrival_at<start_at+interval '1 day')
    ));
  end if;
  return barkolink_private.execute_flexible_discounts_v25(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) from public,anon,authenticated;
