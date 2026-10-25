-- Align the current Starlite service catalog without changing booked fares or IDs.
do $$ begin
  if exists(select 1 from public.vessel where code='SL-SWM-STELLA-DEL-MAR' and reference_metadata->>'operator'='Starlite Ferries')
    and exists(select 1 from public.vessel where code='SL-STELLA-DEL-MAR') then
    raise exception 'The normalized Starlite vessel code is already in use.';
  end if;
end $$;
update public.vessel set code='SL-STELLA-DEL-MAR'
where code='SL-SWM-STELLA-DEL-MAR' and reference_metadata->>'operator'='Starlite Ferries';

-- Unsupported classes with booking history stay archived; never delete bookings.
update public.accommodation a set is_active=false
from public.vessel v where a.vessel_id=v.id and v.reference_metadata->>'operator'='Starlite Ferries'
  and a.name not in ('Economy','Tourist Class','Business Class')
  and exists(select 1 from public.booking b where b.accommodation_id=a.id);
delete from public.accommodation a using public.vessel v
where a.vessel_id=v.id and v.reference_metadata->>'operator'='Starlite Ferries'
  and a.name not in ('Economy','Tourist Class','Business Class')
  and not exists(select 1 from public.booking b where b.accommodation_id=a.id);
