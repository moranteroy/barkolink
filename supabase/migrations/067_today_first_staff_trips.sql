-- Apply the same Philippine-day priority used by Admin before staff pagination.
do $$
declare definition text; previous text;
begin
  definition := pg_get_functiondef('barkolink_private.execute_workspaces(text,jsonb,text,text)'::regprocedure);
  previous := definition;
  definition := replace(definition, 'order by p.departure_at desc',
    'order by barkolink_private.admin_sailing_priority(p.departure_at,p.status), case when p.departure_at >= today::timestamp at time zone ''Asia/Manila'' then p.departure_at end asc, case when p.departure_at < today::timestamp at time zone ''Asia/Manila'' then p.departure_at end desc, p.code');
  if definition = previous then raise exception 'Staff sailing aggregation order was not found.'; end if;
  previous := definition;
  definition := replace(definition, 'order by departure_at desc,code limit 30 offset page_number*30',
    'order by barkolink_private.admin_sailing_priority(departure_at,status), case when departure_at >= today::timestamp at time zone ''Asia/Manila'' then departure_at end asc, case when departure_at < today::timestamp at time zone ''Asia/Manila'' then departure_at end desc, code limit 30 offset page_number*30');
  if definition = previous then raise exception 'Staff sailing pagination order was not found.'; end if;
  execute definition;
end $$;
