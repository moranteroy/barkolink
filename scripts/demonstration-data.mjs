import fs from 'node:fs';
export const batchId='batangas-calapan-2026-v1';
export function demonstrationSql(){return fs.readFileSync('supabase/demonstration-data.sql','utf8');}
export const demonstrationChecks=`do $$ begin
 if exists(select 1 from public.booking b join demo_sailings ds on ds.code=b.sailing_code
   where b.passenger_count<>(select count(*) from public.booking_passenger p where p.booking_id=b.id)
   or b.passenger_fare_total<>(select sum(p.fare) from public.booking_passenger p where p.booking_id=b.id)+b.accommodation_surcharge*b.passenger_count
   or b.total<>b.passenger_fare_total+b.service_fee-b.voucher_discount) then raise exception 'Demonstration booking integrity failed'; end if;
 if exists(select 1 from public.sailing s join demo_sailings ds on ds.code=s.code join public.vessel v on v.id=s.vessel_id
   where s.available_seats<>v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0)) then raise exception 'Demonstration seat integrity failed'; end if;
 if exists(select 1 from public.vessel v where (select sum(capacity) from public.accommodation a where a.vessel_id=v.id and a.is_active)>v.passenger_capacity) then raise exception 'Cabin allocations exceed vessel capacity'; end if;
 if (select count(*) from demo_sailings)<>60 then raise exception 'Expected sixty departures'; end if;
 if (select available_seats from public.sailing where code=(select code from demo_sailings where scenario='sold-out'))<>0 then raise exception 'Sold-out scenario incomplete'; end if;
end $$;`;
