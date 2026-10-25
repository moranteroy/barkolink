-- Editable application allocations, not certified physical class capacities.
-- Complete the current Starlite catalog once. Never reset a complete, edited catalog.
do $$
declare ship record; class record; reserved integer;
begin
  for ship in select v.* from public.vessel v where v.is_active and v.passenger_capacity >= 3
    and v.reference_metadata->>'operator'='Starlite Ferries'
    and (select count(*) from public.accommodation a where a.vessel_id=v.id
      and a.name in ('Economy','Tourist Class','Business Class')) < 3
    order by v.id for update
  loop
    perform pg_advisory_xact_lock(hashtextextended(ship.id::text,42));
    if exists(select 1 from public.accommodation where vessel_id=ship.id and is_active
      and name not in ('Economy','Tourist Class','Business Class')) then
      raise exception 'Review other active accommodation classes on % before allocating seats.',ship.name;
    end if;
    for class in select * from (values
      ('Economy',ship.passenger_capacity-greatest(1,floor(ship.passenger_capacity*.2)::integer)-greatest(1,floor(ship.passenger_capacity*.1)::integer),
        'Standard passenger seating in the Economy accommodation.'),
      ('Tourist Class',greatest(1,floor(ship.passenger_capacity*.2)::integer),
        'Passenger seating in the Tourist Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.'),
      ('Business Class',greatest(1,floor(ship.passenger_capacity*.1)::integer),
        'Passenger seating in the Business Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.')
    ) as classes(name,capacity,description)
    loop
      select coalesce(max(seats),0) into reserved from (
        select sum(b.passenger_count) seats from public.booking b join public.accommodation a on a.id=b.accommodation_id
        where a.vessel_id=ship.id and a.name=class.name and b.status in ('PENDING','CONFIRMED') group by b.sailing_code
      ) occupied;
      if reserved>class.capacity then raise exception 'Allocation for % on % would be below reserved seats.',class.name,ship.name; end if;
      insert into public.accommodation(vessel_id,name,description,capacity,surcharge,is_active)
      values(ship.id,class.name,class.description,class.capacity,0,true)
      on conflict(vessel_id,name) do update set capacity=excluded.capacity,is_active=true;
    end loop;
  end loop;
end $$;
