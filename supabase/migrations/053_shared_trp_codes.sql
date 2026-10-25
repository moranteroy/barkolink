-- Manual and recurring trips share a non-blocking sequence-backed TRP allocator.
-- Sequence values are never reused, including after failed/cancelled operations.
create sequence barkolink_private.trip_code_serial;
select setval('barkolink_private.trip_code_serial',coalesce((select max(substring(code from 13)::bigint)
  from public.sailing where code ~ '^TRP[0-9]{4}-[0-9]{7,}$'),0)+1,false);

create function barkolink_private.allocate_trip_code() returns text
language plpgsql volatile set search_path='' as $$
declare serial bigint;
begin
  serial:=nextval('barkolink_private.trip_code_serial');
  return to_char(now() at time zone 'Asia/Manila','"TRP"YYYY-MMDD')||
    case when serial<1000 then lpad(serial::text,3,'0') else serial::text end;
end $$;
create or replace function barkolink_private.next_trip_code() returns text
language sql stable set search_path='' as $$
  select to_char(now() at time zone 'Asia/Manila','"TRP"YYYY-MMDD')||
    case when serial<1000 then lpad(serial::text,3,'0') else serial::text end
  from (select last_value+case when is_called then 1 else 0 end serial from barkolink_private.trip_code_serial) candidate;
$$;

do $$ declare definition text; begin
  definition:=pg_get_functiondef('barkolink_private.generate_daily_trips()'::regprocedure);
  if position('trip_code:=''DLY''' in definition)=0 then raise exception 'Expected the fleet generator before installing TRP allocation.';end if;
  execute replace(definition,
    'trip_code:=''DLY''||to_char(slot.service_date,''YYYYMMDD'')||''-''||upper(substr(md5(slot.id::text||slot.departure_time),1,12));',
    'trip_code:=barkolink_private.allocate_trip_code();');
  definition:=pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure);
  if position('new_code := barkolink_private.next_trip_code();' in definition)=0 then raise exception 'Expected the manual trip creation allocator.';end if;
  execute replace(definition,'new_code := barkolink_private.next_trip_code();','new_code := barkolink_private.allocate_trip_code();');
end $$;
revoke all on sequence barkolink_private.trip_code_serial from public,anon,authenticated;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
