-- Reference identities and dated vessel/route assignments. This migration creates no sailings or fares.
alter table public.port add column reference_metadata jsonb;
alter table public.vessel add column reference_metadata jsonb;
alter table public.ferry_route add column reference_metadata jsonb;
alter table public.vessel alter column passenger_capacity drop not null;
alter table public.vessel add constraint active_vessel_capacity_required check (not is_active or passenger_capacity is not null);
alter table public.ferry_route alter column duration_minutes drop not null;

create table public.vessel_route (
  vessel_id uuid not null references public.vessel on delete cascade,
  route_id uuid not null references public.ferry_route on delete cascade,
  primary key(vessel_id,route_id)
);
alter table public.vessel_route enable row level security;
revoke all on public.vessel_route from public,anon,authenticated;
grant all on public.vessel_route to service_role;

create function barkolink_private.validate_reference_sailing() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.vessel v where v.id=new.vessel_id and v.reference_metadata->>'kind'='verified-reference')
    and not exists(select 1 from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id
      where vr.vessel_id=new.vessel_id and r.origin_port_id=new.origin_port_id and r.destination_port_id=new.destination_port_id and r.is_active)
  then raise exception 'Choose a verified route assigned to this vessel.'; end if;
  return new;
end $$;
create trigger reference_sailing_route before insert or update of vessel_id,origin_port_id,destination_port_id on public.sailing
for each row execute function barkolink_private.validate_reference_sailing();

create function barkolink_private.protect_reference_route() returns trigger
language plpgsql set search_path='' as $$
begin
  if (new.origin_port_id,new.destination_port_id) is distinct from (old.origin_port_id,old.destination_port_id)
    and exists(select 1 from public.vessel_route where route_id=old.id)
  then raise exception 'Create a separate route to change verified endpoints.'; end if;
  return new;
end $$;
create trigger reference_route_endpoints before update of origin_port_id,destination_port_id on public.ferry_route
for each row execute function barkolink_private.protect_reference_route();

alter function barkolink_private.execute_flexible_discounts(text,jsonb,text,text) rename to execute_flexible_discounts_v33;
create function barkolink_private.execute_flexible_discounts(operation text,args jsonb,actor_uid text,actor_role text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  if operation in ('AdminVessels','AdminRoutes') then
    if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
    if operation='AdminVessels' then
      select jsonb_build_object('vessels',coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('routes',
        (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'originPortId',r.origin_port_id,'destinationPortId',r.destination_port_id,
          'origin',o.name,'destination',d.name,'isActive',r.is_active) order by r.code),'[]')
         from public.vessel_route vr join public.ferry_route r on r.id=vr.route_id join public.port o on o.id=r.origin_port_id
         join public.port d on d.id=r.destination_port_id where vr.vessel_id=v.id)) order by v.name),'[]')) into result from public.vessel v;
    else
      select jsonb_build_object('routes',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('origin',jsonb_build_object('name',o.name),
        'destination',jsonb_build_object('name',d.name),'vessels',
        (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'operator',v.reference_metadata->>'operator') order by v.name),'[]')
         from public.vessel_route vr join public.vessel v on v.id=vr.vessel_id where vr.route_id=r.id)) order by r.code),'[]'))
        into result from public.ferry_route r join public.port o on o.id=r.origin_port_id join public.port d on d.id=r.destination_port_id;
    end if;
    return result;
  end if;
  return barkolink_private.execute_flexible_discounts_v33(operation,args,actor_uid,actor_role);
end $$;
revoke all on all functions in schema barkolink_private from public,anon,authenticated;
