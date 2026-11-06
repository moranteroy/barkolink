-- Staff may resolve the sailing from the verified ticket. Explicit sailing checks remain supported.
-- The outer dispatcher still derives the real ticket's departure port and enforces staff assignment.
do $$
declare definition text; previous text;
begin
  definition := pg_get_functiondef('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)'::regprocedure);
  previous := definition;
  definition := replace(definition,
    'if nullif(args->>''sailingCode'','''') is null or s.code is distinct from args->>''sailingCode'' then',
    'if nullif(args->>''sailingCode'','''') is not null and s.code is distinct from args->>''sailingCode'' then');
  if definition = previous then raise exception 'Ticket sailing verification guard was not found.'; end if;
  execute definition;

  -- A scanned active sailing must remain reachable even beyond the initial 100-row directory.
  definition := pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure);
  previous := definition;
  definition := replace(definition,
    'status in (''SCHEDULED'',''BOARDING'') order by departure_at limit 100',
    'status in (''SCHEDULED'',''BOARDING'') order by (code = args->>''sailingCode'') desc nulls last, departure_at, code limit 100');
  if definition = previous then raise exception 'Boarding sailing directory order was not found.'; end if;
  execute definition;
end $$;
