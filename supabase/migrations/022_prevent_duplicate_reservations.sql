create function barkolink_private.reservation_person_key(person_name text, person_type text, birth_date text, sex text, phone text, nationality text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_array(
    lower(regexp_replace(trim(coalesce(person_name,'')),'\s+',' ','g')),
    upper(trim(coalesce(person_type,''))),
    coalesce(nullif(birth_date,'')::date::text,''),
    lower(trim(coalesce(sex,''))),
    regexp_replace(coalesce(phone,''),'[^0-9]','','g'),
    lower(regexp_replace(trim(coalesce(nationality,'')),'\s+',' ','g')))
$$;

alter function barkolink_private.execute_accommodation(text,jsonb,text,text) rename to execute_accommodation_v21;
create function barkolink_private.execute_accommodation(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.sailing; requested jsonb; duplicate_reference text; requested_count integer;
begin
  if operation ~ '^ReserveSailing[1-8]$' then
    if actor_uid is null or actor_uid='' or actor_role is distinct from 'PASSENGER' then
      raise exception 'Booking access required.' using errcode='42501';
    end if;
    select * into s from public.sailing where code=args->>'sailingCode';
    if not found then raise exception 'Sailing was not found.'; end if;
    -- Match the existing vessel -> reference -> sailing lock order. Concurrent
    -- requests with different references must check duplicates after serialization.
    perform pg_advisory_xact_lock(hashtextextended(s.vessel_id::text,42));
    perform pg_advisory_xact_lock(hashtextextended(args->>'reference',0));
    perform 1 from public.sailing where code=s.code for update;
    if not exists(select 1 from public.booking where reference=args->>'reference') then
      requested_count:=right(operation,1)::integer;
      select jsonb_agg(k order by k::text) into requested from (
        select barkolink_private.reservation_person_key(args->>('passenger'||n||'Name'),args->>('passenger'||n||'Type'),
          args->>('passenger'||n||'BirthDate'),args->>('passenger'||n||'Sex'),args->>('passenger'||n||'Phone'),args->>('passenger'||n||'Nationality')) as k
        from generate_series(1,requested_count) n) people;
      select b.reference into duplicate_reference from public.booking b
        where b.owner_uid=actor_uid and b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')
        and b.passenger_count=requested_count and s.departure_at>now()
        and (b.payment_status='PAID' or (b.payment_status='UNPAID' and b.payment_deadline>now()))
        and requested=(select jsonb_agg(k order by k::text) from (
          select barkolink_private.reservation_person_key(p.full_name,p.passenger_type,p.birth_date::text,p.sex,p.phone,p.nationality) k
          from public.booking_passenger p where p.booking_id=b.id) people)
        order by b.created_at,b.id limit 1;
      if duplicate_reference is not null then
        raise exception 'Duplicate booking: %. You already have an active reservation with these passenger details for this trip. Open the existing booking.',duplicate_reference;
      end if;
    end if;
  end if;
  return barkolink_private.execute_accommodation_v21(operation,args,actor_uid,actor_role);
end $$;
revoke all on function barkolink_private.reservation_person_key(text,text,text,text,text,text),
  barkolink_private.execute_accommodation(text,jsonb,text,text) from public,anon,authenticated;
