import fs from 'node:fs';
import { queryLive, projectRef } from './test-data-database.mjs';

const targets = [
  'barkolink_private.execute(text,jsonb,text,text)',
  'barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)',
];
const inspect = `select position('if s.arrival_at<=now() then raise exception' in pg_get_functiondef('${targets[0]}'::regprocedure))>0 attendance,
 position('if s.arrival_at<=now() then raise exception' in pg_get_functiondef('${targets[1]}'::regprocedure))>0 qr`;
async function main() {
  const before = (await queryLive(inspect))[0];
  console.log(JSON.stringify({ project: projectRef, state: before }));
  if (!process.argv.includes('--apply')) return;
  if (before.attendance !== before.qr)
    throw new Error('Partial ticket guard migration detected. No changes applied.');
  if (before.attendance) {
    console.log('Ticket travel-window guards are already installed.');
    return;
  }
  const definitions = await queryLive(
    `select name,pg_get_functiondef(name::regprocedure) definition from unnest(array[${targets.map((t) => `'${t}'`).join(',')}]) name`,
  );
  const folder = `.backups/ticket-travel-window-${Date.now()}`;
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    `${folder}/before.json`,
    JSON.stringify({ project: projectRef, definitions }, null, 2),
    { flag: 'wx' },
  );
  const tables = [
    'sailing',
    'booking',
    'booking_passenger',
    'online_payment',
    'boarding_event',
    'voucher',
    'notification',
  ];
  const hashes = `array[${tables.map((t) => `(select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text) from public.${t} r)`).join(',')}]`;
  const migration = fs.readFileSync('supabase/migrations/065_ticket_travel_window.sql', 'utf8');
  await queryLive(
    `begin;set local lock_timeout='10s';set local statement_timeout='30s';
   select pg_advisory_xact_lock(hashtext('barkolink-ticket-travel-window'));
   create temporary table ticket_guard_before on commit drop as select ${hashes} hashes;
   ${migration}
   do $$begin if exists(select 1 from ticket_guard_before where hashes is distinct from ${hashes})then raise exception 'Operational data changed. Ticket guard migration rolled back.';end if;end $$;
   commit;`,
    false,
  );
  const after = (await queryLive(inspect))[0];
  if (!after.attendance || !after.qr) throw new Error('Ticket guard verification failed.');
  fs.writeFileSync(
    `${folder}/receipt.json`,
    JSON.stringify(
      {
        project: projectRef,
        installed: after,
        at: new Date().toISOString(),
        existingDataPreserved: true,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  console.log(
    'Ticket guards installed. Existing trips, bookings, payments, attendance, rewards and notifications preserved.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
