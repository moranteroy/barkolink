-- Keep signed-out terminal TVs public; authenticated ticketing uses its live assignment.
alter function public.port_display(uuid) set schema barkolink_private;
alter function barkolink_private.port_display(uuid) rename to port_display_unscoped;
revoke all on function barkolink_private.port_display_unscoped(uuid) from public, anon, authenticated, service_role;

create function public.port_display(p_port uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  assigned_port uuid;
  result jsonb;
begin
  select raw_app_meta_data->>'role' into actor_role from auth.users where id = actor;
  if actor_role = 'TICKETING' then
    select p.id into assigned_port
    from public.app_user u join public.port p on p.id = u.assigned_port_id
    where u.uid = actor::text and u.role = 'TICKETING' and p.is_active;
    if assigned_port is null then
      raise exception 'Your staff account has no active port assignment. Ask your administrator to assign your departure port.' using errcode = '42501';
    end if;
    result := barkolink_private.port_display_unscoped(assigned_port);
    return result || jsonb_build_object(
      'portLocked', true,
      'ports', (select jsonb_agg(port) from jsonb_array_elements(result->'ports') port where port->>'id' = assigned_port::text)
    );
  end if;
  return barkolink_private.port_display_unscoped(p_port);
end;
$$;
revoke all on function public.port_display(uuid) from public;
grant execute on function public.port_display(uuid) to anon, authenticated, service_role;
