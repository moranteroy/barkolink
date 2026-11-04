-- Operational trip browsing uses the Philippine calendar day, not the browser
-- or database session timezone. Explicit global sort choices remain available.
create function barkolink_private.admin_sailing_priority(departure timestamptz,state text,at_time timestamptz default now()) returns integer
language sql immutable set search_path='' as $$
  select case
    when (departure at time zone 'Asia/Manila')::date=(at_time at time zone 'Asia/Manila')::date then
      case when state in('SCHEDULED','BOARDING','DELAYED') then 0 else 1 end
    when (departure at time zone 'Asia/Manila')::date>(at_time at time zone 'Asia/Manila')::date then 2
    else 3 end;
$$;
revoke all on function barkolink_private.admin_sailing_priority(timestamptz,text,timestamptz) from public,anon,authenticated;

do $$declare definition text;previous text;begin
  definition:=pg_get_functiondef('barkolink_private.admin_directory(text,jsonb,text,text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,'s.departure_at departure,v.name name from public.sailing',
    's.departure_at departure,barkolink_private.admin_sailing_priority(s.departure_at,s.status) operational_priority,v.name name from public.sailing');
  if definition=previous then raise exception 'Admin sailing source insertion point was not found.';end if;
  previous:=definition;
  definition:=replace(definition,
    'when ''departure:asc'' then ''departure asc'' when ''departure:desc'' then ''departure desc'' else ''created desc'' end;',
    'when ''departure:asc'' then ''departure asc'' when ''departure:desc'' then ''departure desc'' else ''operational_priority asc,case when operational_priority<3 then departure end asc,case when operational_priority=3 then departure end desc'' end;');
  if definition=previous then raise exception 'Admin sailing default-order insertion point was not found.';end if;
  execute definition;
end $$;
