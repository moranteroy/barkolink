-- Keep historical departures untouched; prevent new assignments to disabled ports.
create function barkolink_private.validate_active_sailing_ports() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.port where id=new.origin_port_id and is_active)
    or not exists(select 1 from public.port where id=new.destination_port_id and is_active)
  then raise exception 'Choose active origin and destination ports.'; end if;
  return new;
end $$;
create trigger active_sailing_ports before insert or update of origin_port_id,destination_port_id,vessel_id on public.sailing
for each row execute function barkolink_private.validate_active_sailing_ports();
revoke all on function barkolink_private.validate_active_sailing_ports() from public,anon,authenticated;
