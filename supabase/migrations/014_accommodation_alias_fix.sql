-- Keep the selected row variable distinct from SQL table aliases.
-- Replaces only the dispatcher; existing inventory and bookings are preserved.
create or replace function barkolink_private.execute_accommodation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.sailing; locked_sailing public.sailing; selected_accommodation public.accommodation; existing public.booking; result jsonb; wanted uuid;
  requested_count integer; booking_id uuid; record_id uuid; allocated integer; vessel_id_value uuid;
begin
  if operation in ('AdminUpdateVessel','AdminCreateSailing','AdminUpdateUnbookedSailing') and actor_role='ADMIN' then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(args->>'vesselId',args->>'id'),42));
    return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
  end if;
  if operation='AdminAccommodations' or operation='AdminSaveAccommodation' then
    if actor_uid is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminAccommodations' then
      return jsonb_build_object('accommodations',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('vesselName',v.name) order by v.name,a.surcharge,a.name),'[]')
        from public.accommodation a join public.vessel v on v.id=a.vessel_id));
    end if;
    vessel_id_value:=(args->>'vesselId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(vessel_id_value::text,42));
    if not exists(select 1 from public.vessel where id=vessel_id_value and is_active) then raise exception 'Choose an active vessel.'; end if;
    record_id:=nullif(args->>'id','')::uuid;
    if record_id is not null then
      select * into selected_accommodation from public.accommodation where id=record_id;
      if not found or selected_accommodation.vessel_id<>vessel_id_value then raise exception 'Accommodation was not found for this vessel.'; end if;
    end if;
    select coalesce(sum(capacity),0) into allocated from public.accommodation where vessel_id=vessel_id_value and is_active and id is distinct from record_id;
    if coalesce((args->>'isActive')::boolean,true) and allocated+(args->>'capacity')::integer>(select passenger_capacity from public.vessel where id=vessel_id_value) then
      raise exception 'Accommodation capacities must fit within the vessel capacity.';
    end if;
    if exists(select 1 from public.booking where accommodation_id=record_id and status in ('PENDING','CONFIRMED')
      group by sailing_code having sum(passenger_count)>(args->>'capacity')::integer) then raise exception 'Capacity cannot be below seats already reserved in this class.'; end if;
    if record_id is null then
      insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(vessel_id_value,trim(args->>'name'),coalesce(args->>'description',''),(args->>'capacity')::integer,(args->>'surcharge')::integer,coalesce((args->>'isActive')::boolean,true)) returning id into record_id;
    else
      update public.accommodation set name=trim(args->>'name'),description=coalesce(args->>'description',''),capacity=(args->>'capacity')::integer,
        surcharge=(args->>'surcharge')::integer,is_active=coalesce((args->>'isActive')::boolean,true) where id=record_id;
    end if;
    insert into public.activity_log(actor_uid,action,entity_type,entity_id,details) values(actor_uid,'ACCOMMODATION_SAVED','accommodation',record_id::text,jsonb_build_object('name',trim(args->>'name'),'capacity',(args->>'capacity')::integer,'surcharge',(args->>'surcharge')::integer));
    return jsonb_build_object('id',record_id);
  end if;
  if operation ~ '^ReserveSailing[1-8]$' or operation in ('TicketingCreateWalkIn','TicketingCreateGuestWalkIn') then
    if actor_uid is null or actor_uid='' or (operation like 'Reserve%' and actor_role is distinct from 'PASSENGER')
      or (operation like 'Ticketing%' and coalesce(actor_role,'') not in ('TICKETING','ADMIN')) then raise exception 'Booking access required.' using errcode='42501'; end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    -- The same lock order applies to class edits, bookings, and vessel capacity updates.
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    select * into locked_sailing from public.sailing where code=s.code for update;
    if locked_sailing.vessel_id is distinct from s.vessel_id then raise exception 'The trip vessel changed. Refresh the trip and try again.'; end if;
    s:=locked_sailing;
    wanted:=nullif(args->>'accommodationId','')::uuid;
    select * into existing from public.booking where reference=args->>'reference';
    if found then
      if existing.accommodation_id is distinct from wanted then raise exception 'Booking reference already uses a different accommodation.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    if wanted is null then
      if exists(select 1 from public.accommodation where vessel_id=s.vessel_id and is_active) then raise exception 'Choose an accommodation class for this trip.'; end if;
      return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    end if;
    select * into selected_accommodation from public.accommodation where id=wanted and vessel_id=s.vessel_id and is_active;
    if not found then raise exception 'Choose an available accommodation for this vessel.'; end if;
    requested_count:=case when operation like 'Ticketing%' then 1 else right(operation,1)::integer end;
    select coalesce(sum(b.passenger_count),0) into allocated from public.booking b where b.sailing_code=s.code and b.accommodation_id=wanted and b.status in ('PENDING','CONFIRMED');
    if allocated+requested_count>selected_accommodation.capacity then raise exception 'This accommodation no longer has enough available seats.'; end if;
    result:=barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
    booking_id:=(result->'booking_insert'->>'id')::uuid;
    update public.booking set accommodation_id=selected_accommodation.id,accommodation_name=selected_accommodation.name,accommodation_surcharge=selected_accommodation.surcharge,
      service_fee=requested_count*selected_accommodation.surcharge,total=passenger_fare_total+requested_count*selected_accommodation.surcharge where id=booking_id;
    return result;
  end if;
  return barkolink_private.execute_workspace(operation,args,actor_uid,actor_role);
end $$;

revoke all on function barkolink_private.execute_accommodation(text,jsonb,text,text) from public,anon,authenticated;
