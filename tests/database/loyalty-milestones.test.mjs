import { PGlite } from '@electric-sql/pglite';
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

let db;
const passenger = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  admin = '33333333-3333-4333-8333-333333333333';
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    select set_config('request.jwt.claims','{"aal":"aal2"}',false);`);
  for (const file of fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql', 'utf8'));
  for (const [uid, role] of [
    [passenger, 'PASSENGER'],
    [other, 'PASSENGER'],
    [admin, 'ADMIN'],
  ])
    await db.query(
      "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,jsonb_build_object('role',$3::text))",
      [uid, uid + '@example.invalid', role],
    );
  await db.exec(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
    regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    values('LOYALTY-USE','76a29980-5c27-4c4b-9ead-cae943202001','76a29980-5c27-4c4b-9ead-cae943202002','76a29980-5c27-4c4b-9ead-cae943203001',now()+interval '2 days',now()+interval '2 days 2 hours',120,600,480,480,300,480,600,200)`);
});
after(async () => await db?.close());
beforeEach(async () => await db.exec('begin'));
afterEach(async () => await db.exec('rollback'));
it('preparing presentation history reserves inventory once and preserves unrelated trip details', async () => {
  await db.query("update public.app_user set email='carlobiado@barkolink.com' where uid=$1", [
    passenger,
  ]);
  await db.exec(
    "update barkolink_private.loyalty_settings set trips_per_reward=1 where code='DEFAULT'",
  );
  await db.exec(
    "update public.sailing set departure_at=now()-interval '2 days',arrival_at=now()-interval '2 days'+interval '2 hours',status='COMPLETED' where code='LOYALTY-USE'",
  );
  const before = (
    await db.query(
      "select to_jsonb(s)-'available_seats'-'updated_at' details,available_seats from public.sailing s where code='LOYALTY-USE'",
    )
  ).rows[0];
  const source = fs.readFileSync('scripts/prepare-presentation-loyalty.mjs', 'utf8');
  const block = source.slice(source.indexOf('--complete-history'));
  const opening = block.indexOf('`');
  const template = block.slice(opening + 1, block.indexOf('`', opening + 1));
  const sql = template
    .replaceAll('${email}', 'carlobiado@barkolink.com')
    .replaceAll('${lastReward}', '1')
    .replace(/^begin;/, '')
    .replace(/commit;$/, '');
  await db.exec(sql);
  const after = (
    await db.query(
      "select to_jsonb(s)-'available_seats'-'updated_at' details,available_seats from public.sailing s where code='LOYALTY-USE'",
    )
  ).rows[0];
  assert.deepEqual(after.details, before.details);
  assert.equal(after.available_seats, before.available_seats - 1);
  assert.equal(
    (
      await db.query(
        "select sum(passenger_count)::int n from public.booking where sailing_code='LOYALTY-USE' and status='CONFIRMED'",
      )
    ).rows[0].n,
    1,
  );
  await db.exec(
    'drop table original_carlo_bookings,original_sailings_guard,original_inventory,prepared_inventory',
  );
  await db.exec(sql);
  assert.equal(
    (await db.query("select available_seats from public.sailing where code='LOYALTY-USE'")).rows[0]
      .available_seats,
    after.available_seats,
  );
});
async function call(uid, operation = 'MyLoyalty', args = {}, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
  await db.exec('savepoint milestone_call');
  await db.exec(`set local role ${role}`);
  try {
    return (
      await db.query('select public.barkolink_execute($1,$2::jsonb) data', [
        operation,
        JSON.stringify(args),
      ])
    ).rows[0].data;
  } catch (error) {
    await db.exec('rollback to savepoint milestone_call');
    throw error;
  } finally {
    await db.exec('reset role;release savepoint milestone_call');
  }
}
async function reward(number, owner = passenger, extra = {}) {
  const code = 'MILESTONE-' + owner.slice(0, 3) + '-' + number;
  await db.query(
    `insert into public.voucher(code,discount_type,value,usage_limit,starts_at,expires_at,is_active,owner_uid,loyalty_reward_number)
    values($1,'FIXED',100,1,now()+($2||' days')::interval,now()+($3||' days')::interval,$4,$5,$6)`,
    [code, extra.start ?? -1, extra.end ?? 90, extra.active ?? true, owner, number],
  );
  return code;
}
async function use(code, reference = 'USED-REWARD') {
  // Seed a real consumed-voucher relationship; reservation validation is covered
  // by postgres.test.mjs. These tests target the read-only milestone response.
  return db.query(
    `insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,voucher_id,voucher_code,voucher_discount)
    select $1,$2,'LOYALTY-USE','PENDING',1,600,500,id,code,100 from public.voucher where code=$3`,
    [reference, passenger, code],
  );
}
it('reports actual usage, preserves the ready wallet, and treats a cancelled reservation as consumed', async () => {
  const silver = await reward(1);
  await reward(2);
  await use(silver);
  let result = await call(passenger);
  assert.equal(result.milestones[0].usedCount, 1);
  assert.equal(result.milestones[0].readyCount, 0);
  assert.equal(result.milestones[1].readyCount, 1);
  assert.deepEqual(
    result.vouchers.map((v) => v.code),
    ['MILESTONE-111-2'],
  );
  await db.exec("update public.booking set status='CANCELLED' where reference='USED-REWARD'");
  await db.exec(
    "update public.voucher set expires_at=now()-interval '1 hour',is_active=false where code='MILESTONE-111-1'",
  );
  result = await call(passenger);
  assert.equal(result.milestones[0].usedCount, 1);
  assert.equal(result.milestones[0].expiredCount, 0);
});
it('groups recurring Platinum vouchers by reward number even when amounts or settings match', async () => {
  const platinum = await reward(3);
  await reward(4);
  await use(platinum);
  await db.exec(
    "update barkolink_private.loyalty_settings set trips_per_reward=7,silver_reward=100,gold_reward=100,platinum_reward=100 where code='DEFAULT'",
  );
  const result = await call(passenger);
  assert.equal(result.milestones[2].usedCount, 1);
  assert.equal(result.milestones[2].readyCount, 1);
  assert.equal(result.milestones[0].usedCount, 0);
  assert.equal(result.milestones[1].usedCount, 0);
});
it('distinguishes expired, inactive and not-yet-valid unused rewards', async () => {
  await reward(1, passenger, { start: -3, end: -1 });
  await reward(2, passenger, { active: false });
  await reward(3, passenger, { start: 1 });
  const result = await call(passenger);
  assert.equal(result.milestones[0].expiredCount, 1);
  assert.equal(result.milestones[1].unavailableCount, 1);
  assert.equal(result.milestones[2].pendingCount, 1);
  assert.ok(result.milestones.every((m) => m.usedCount === 0 && m.readyCount === 0));
  assert.deepEqual(result.vouchers, []);
});
it('does not leak another passenger usage or accept an owner override', async () => {
  const code = await reward(1);
  await use(code);
  await reward(1, other);
  const result = await call(other, 'MyLoyalty', { ownerUid: passenger, actorUid: passenger });
  assert.equal(result.milestones[0].usedCount, 0);
  assert.equal(result.milestones[0].readyCount, 1);
  assert.equal(JSON.stringify(result).includes(code), false);
});
it('denies anonymous/admin access and keeps the private usage helper inaccessible', async () => {
  await assert.rejects(call(admin), /Passenger access/);
  await assert.rejects(
    call(null, 'MyLoyalty', {}, 'anon'),
    /Sign in|Authentication|Passenger access/,
  );
  const permissions = (
    await db.query(
      "select has_function_privilege('authenticated','barkolink_private.loyalty_milestone_usage(text)','execute') authenticated,has_function_privilege('anon','barkolink_private.loyalty_milestone_usage(text)','execute') anonymous",
    )
  ).rows[0];
  assert.deepEqual(permissions, { authenticated: false, anonymous: false });
});
it('issues rewards automatically but instructs passengers to enter and apply the code manually', async () => {
  await db.exec(
    "update barkolink_private.loyalty_settings set trips_per_reward=1 where code='DEFAULT'",
  );
  const booking = (
    await db.query(
      `insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,payment_status)
    values('EARN-REWARD',$1,'LOYALTY-USE','CANCELLED',1,600,600,'PAID') returning id`,
      [passenger],
    )
  ).rows[0];
  await db.query(
    "insert into public.booking_passenger(booking_id,full_name,fare,ticket_status) values($1,'Reward Traveler',600,'BOARDED')",
    [booking.id],
  );
  await db.query("update public.booking set status='CONFIRMED' where id=$1", [booking.id]);
  await db.exec("update public.sailing set status='COMPLETED' where code='LOYALTY-USE'");
  await call(passenger);
  const notes = (
    await db.query(
      "select message from public.notification where owner_uid=$1 and title='Your loyalty voucher is ready'",
      [passenger],
    )
  ).rows;
  assert.equal(notes.length, 1);
  assert.match(notes[0].message, /enter the voucher code at booking review and select Apply/i);
  assert.doesNotMatch(notes[0].message, /applies automatically/);
});
