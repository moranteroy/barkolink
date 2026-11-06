import fs from 'node:fs';
import { queryLive } from './test-data-database.mjs';
const candidates = `select s.code,s.available_seats,v.passenger_capacity,
 v.passenger_capacity-coalesce((select sum(b.passenger_count) from public.booking b where b.sailing_code=s.code and b.status in ('PENDING','CONFIRMED')),0) as expected_seats,
 (select coalesce(sum(b.passenger_count),0) from public.booking b join public.app_user u on u.uid=b.owner_uid
 where b.sailing_code=s.code and b.status='CONFIRMED' and lower(u.email)='carlobiado@barkolink.com'
 and exists(select 1 from public.activity_log a where a.entity_id=b.id::text and a.action='PRESENTATION_LOYALTY_HISTORY_PREPARED')) as prepared_passengers
 from public.sailing s join public.vessel v on v.id=s.vessel_id where s.status='COMPLETED' and s.arrival_at<now()`;
const before = await queryLive(
  `select * from (${candidates}) x where available_seats<>expected_seats order by code`,
);
if (process.argv.includes('--apply')) {
  fs.mkdirSync('.audit/presentation-readiness', { recursive: true });
  fs.writeFileSync(
    `.audit/presentation-readiness/inventory-before-${Date.now()}.json`,
    JSON.stringify(before, null, 2),
    { flag: 'wx' },
  );
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-presentation-inventory-repair'));
    lock table public.booking in share mode;
    do $$declare r record;begin
      for r in select * from (${candidates}) x where available_seats<>expected_seats order by code loop
        if r.prepared_passengers<1 or r.available_seats-r.expected_seats<>r.prepared_passengers
          or r.expected_seats<0 or r.expected_seats>r.passenger_capacity then
          raise exception 'Unexpected inventory discrepancy. No correction applied.';
        end if;
        update public.sailing set available_seats=r.expected_seats,updated_at=now()
          where code=r.code and status='COMPLETED' and available_seats=r.available_seats;
        if not found then raise exception 'Inventory changed during repair. Retry inspection.';end if;
        insert into public.activity_log(action,entity_type,entity_id,details)
          values('PRESENTATION_INVENTORY_RECONCILED','sailing',r.code,jsonb_build_object('availableSeats',jsonb_build_object('before',r.available_seats,'after',r.expected_seats),'reason','Reconcile tagged presentation loyalty history','preparedPassengers',r.prepared_passengers));
      end loop;
    end $$;commit;`,
    false,
  );
}
const after = await queryLive(
  `select * from (${candidates}) x where available_seats<>expected_seats order by code`,
);
console.log(
  JSON.stringify({
    before: before.length,
    remaining: after.length,
    applied: process.argv.includes('--apply'),
  }),
);
if (process.argv.includes('--apply') && after.length) process.exitCode = 1;
