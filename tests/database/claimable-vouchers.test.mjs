import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const admin = '33333333-3333-4333-8333-333333333333',
  first = '11111111-1111-4111-8111-111111111111',
  second = '22222222-2222-4222-8222-222222222222';
const ship = '76a29980-5c27-4c4b-9ead-cae943203001',
  origin = '76a29980-5c27-4c4b-9ead-cae943202001',
  destination = '76a29980-5c27-4c4b-9ead-cae943202002';
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    select set_config('request.jwt.claims','{"aal":"aal2"}',false);`);
  for (const file of fs
    .readdirSync('supabase/migrations')
    .filter((f) => Number(f.slice(0, 3)) < 56)
    .sort())
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql', 'utf8'));
  for (const [id, role] of [
    [admin, 'ADMIN'],
    [first, 'PASSENGER'],
    [second, 'PASSENGER'],
  ])
    await db.query(
      "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,jsonb_build_object('role',$3::text))",
      [id, `${id}@example.invalid`, role],
    );
  await db.exec(
    "insert into public.voucher(code,discount_type,value,usage_limit,starts_at,expires_at) values('EXISTING-PROMO','FIXED',50,10,now()-interval '1 day',now()+interval '1 day')",
  );
  await db.query(
    "insert into public.voucher(code,discount_type,value,usage_limit,starts_at,expires_at,owner_uid,loyalty_reward_number) values('PERSONAL-LOYALTY','FIXED',50,1,now()-interval '1 day',now()+interval '1 day',$1,1)",
    [first],
  );
  await db.exec(fs.readFileSync('supabase/migrations/056_claimable_vouchers.sql', 'utf8'));
  assert.equal(
    (await db.query("select claimable from public.voucher where code='EXISTING-PROMO'")).rows[0]
      .claimable,
    true,
  );
  await db.exec(fs.readFileSync('supabase/migrations/057_edit_voucher_details.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/058_voucher_availability_errors.sql', 'utf8'));
  await db.exec(
    fs.readFileSync('supabase/migrations/059_loyalty_voucher_code_notifications.sql', 'utf8'),
  );
});
afterEach(async () => await db?.close());
beforeEach(async () => {
  // Match the main business-rule suite: isolate records and invalidate cached plans between cases.
  await db.exec('truncate public.voucher,public.sailing cascade');
  await db.exec(
    "insert into public.voucher(code,discount_type,value,usage_limit,starts_at,expires_at,claimable) values('EXISTING-PROMO','FIXED',50,10,now()-interval '1 day',now()+interval '1 day',true)",
  );
  await db.query(
    "insert into public.voucher(code,discount_type,value,usage_limit,starts_at,expires_at,owner_uid,loyalty_reward_number) values('PERSONAL-LOYALTY','FIXED',50,1,now()-interval '1 day',now()+interval '1 day',$1,1)",
    [first],
  );
  await db.query(
    `insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
    regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
    values('CLAIM-TRIP',$1,$2,$3,now()+interval '2 days',now()+interval '2 days 2 hours',120,600,480,480,300,480,600,200)`,
    [origin, destination, ship],
  );
});
async function call(uid, operation, args = {}, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
  await db.exec(`set role ${role}`);
  try {
    return (
      await db.query('select public.barkolink_execute($1,$2::jsonb) data', [
        operation,
        JSON.stringify(args),
      ])
    ).rows[0].data;
  } finally {
    await db.exec('reset role');
  }
}
let seq = 0;
async function offer(extra = {}) {
  const code = `CLAIM-${++seq}`;
  const { id } = await call(admin, 'AdminSaveVoucher', {
    code,
    title: 'Weekend sailing treat',
    description: 'Enjoy your next journey.',
    claimable: true,
    requiredTrips: 0,
    discountType: 'FIXED',
    value: 50,
    minimumSpend: 0,
    usageLimit: 1,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    isActive: true,
    ...extra,
  });
  return { id, code };
}
it('lists existing public promotions without revealing unclaimed codes or personal loyalty rewards', async () => {
  const list = await call(second, 'PassengerVouchers');
  assert.equal(list.completedTrips, 0);
  assert.equal(list.vouchers.length, 1);
  assert.equal(list.vouchers[0].code, null);
  assert.equal(list.vouchers[0].claimedAt, null);
  const personal = (
    await db.query("select claimable from public.voucher where code='PERSONAL-LOYALTY'")
  ).rows[0];
  assert.equal(personal.claimable, false);
});
it('reserves one limited slot once, supports retries and blocks the next account', async () => {
  const v = await offer();
  const claimed = await call(first, 'ClaimVoucher', { voucherId: v.id });
  assert.equal(claimed.code, v.code);
  assert.deepEqual(await call(first, 'ClaimVoucher', { voucherId: v.id }), claimed);
  await assert.rejects(
    call(second, 'ClaimVoucher', { voucherId: v.id }),
    /slots have been claimed/,
  );
  assert.equal(
    (await call(second, 'PassengerVouchers')).vouchers.some((x) => x.id === v.id),
    false,
  );
  const mine = (await call(first, 'PassengerVouchers')).vouchers.find((x) => x.id === v.id);
  assert.equal(mine.code, v.code);
  assert.equal(mine.remaining, 0);
  assert.equal(mine.used, false);
  const record = (await call(admin, 'AdminVouchers')).vouchers.find((x) => x.id === v.id);
  assert.equal(record.claimed, 1);
  assert.equal(Number(record.used), 0);
});
it('requires a claim even when a passenger knows the code, then applies it through a real reservation', async () => {
  const v = await offer();
  const args = {
    sailingCode: 'CLAIM-TRIP',
    passengerCount: 1,
    passenger1Name: 'Passenger One',
    passenger1Type: 'REGULAR',
    passenger1BirthDate: '1990-01-01',
    passenger1Sex: 'Male',
    passenger1Phone: '09123456789',
    passenger1Nationality: 'Filipino',
    voucherCode: v.code,
    expectedVoucherDiscount: 50,
    reference: 'BK-CLAIM-ONE',
  };
  await assert.rejects(call(first, 'QuoteVoucher', args), /Claim this voucher/);
  await assert.rejects(call(first, 'ReserveSailing1', args), /Claim this voucher/);
  await call(first, 'ClaimVoucher', { voucherId: v.id });
  assert.equal((await call(first, 'QuoteVoucher', args)).discount, 50);
  await call(first, 'ReserveSailing1', args);
  await call(first, 'ReserveSailing1', args);
  const row = (
    await db.query('select total,voucher_discount from public.booking where reference=$1', [
      args.reference,
    ])
  ).rows[0];
  assert.equal(row.voucher_discount, 50);
  assert.equal(
    (await call(first, 'PassengerVouchers')).vouchers.find((x) => x.id === v.id).used,
    true,
  );
});
async function journey(code, paid, boarded) {
  await db.query(
    `insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
    regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    values($1,$2,$3,$4,now()-interval '2 days',now()-interval '1 day',1440,600,480,480,300,480,600,200,'COMPLETED')`,
    [code, origin, destination, ship],
  );
  const { id } = (
    await db.query(
      `insert into public.booking(reference,owner_uid,sailing_code,status,passenger_count,passenger_fare_total,total,payment_status)
    values($1,$2,$3,'CANCELLED',1,600,600,$4) returning id`,
      [code, second, code, paid ? 'PAID' : 'UNPAID'],
    )
  ).rows[0];
  await db.query(
    "insert into public.booking_passenger(booking_id,full_name,fare,ticket_status) values($1,'Mission traveler',600,$2)",
    [id, boarded ? 'BOARDED' : 'ISSUED'],
  );
  await db.query("update public.booking set status='CONFIRMED' where id=$1", [id]);
}
it('enforces completed, paid and boarded trip missions on the server', async () => {
  const v = await offer({ requiredTrips: 1, usageLimit: 5 });
  await assert.rejects(call(second, 'ClaimVoucher', { voucherId: v.id }), /Complete 1 paid trip/);
  await journey('MISSION-UNBOARDED', true, false);
  await journey('MISSION-UNPAID', false, true);
  assert.equal((await call(second, 'PassengerVouchers')).completedTrips, 0);
  await assert.rejects(call(second, 'ClaimVoucher', { voucherId: v.id }), /Complete 1 paid trip/);
  await journey('MISSION-DONE', true, true);
  assert.equal((await call(second, 'PassengerVouchers')).completedTrips, 1);
  assert.equal((await call(second, 'ClaimVoucher', { voucherId: v.id })).code, v.code);
});
it('blocks paused, future, expired, hidden and private vouchers and preserves claimed history', async () => {
  for (const extra of [
    { isActive: false },
    { startsAt: new Date(Date.now() + 3600000).toISOString() },
    { expiresAt: new Date(Date.now() - 1000).toISOString() },
    { claimable: false },
  ]) {
    const v = await offer(extra);
    await assert.rejects(
      call(first, 'ClaimVoucher', { voucherId: v.id }),
      /not available|paused|expired/,
    );
  }
  const v = await offer();
  await call(first, 'ClaimVoucher', { voucherId: v.id });
  await call(admin, 'AdminSaveVoucher', { id: v.id, isActive: false });
  const mine = (await call(first, 'PassengerVouchers')).vouchers.find((x) => x.id === v.id);
  assert.equal(mine.isActive, false);
  assert.equal(mine.code, v.code);
  await assert.rejects(call(first, 'QuoteVoucher', { voucherCode: v.code }), /inactive/);
});
it('rejects invalid missions, restricts role access and keeps claims inaccessible through direct tables', async () => {
  await assert.rejects(offer({ requiredTrips: -1 }), /valid voucher mission/);
  await assert.rejects(offer({ claimable: false, requiredTrips: 1 }), /valid voucher mission/);
  await assert.rejects(call(admin, 'PassengerVouchers'), /Passenger access required/);
  await assert.rejects(call(null, 'PassengerVouchers', {}, 'anon'), /Passenger access required/);
  const permissions = (
    await db.query(
      "select has_table_privilege('authenticated','public.voucher_claim','SELECT') readable,has_table_privilege('authenticated','public.voucher_claim','INSERT') writable",
    )
  ).rows[0];
  assert.deepEqual(permissions, { readable: false, writable: false });
});

it('edits optional missions and claim limits while preserving financial terms', async () => {
  const v = await offer({ usageLimit: 10 });
  const before = (
    await db.query(
      'select code,value,minimum_spend,starts_at,expires_at,is_active from public.voucher where id=$1',
      [v.id],
    )
  ).rows[0];
  const edit = {
    id: v.id,
    title: 'Frequent sailor bonus',
    description: 'Complete trips to unlock.',
    requiredTrips: 3,
    usageLimit: 20,
  };
  await call(admin, 'AdminUpdateVoucherDetails', edit);
  await assert.rejects(call(first, 'ClaimVoucher', { voucherId: v.id }), /Complete 3 paid trip/);
  await call(admin, 'AdminUpdateVoucherDetails', { ...edit, requiredTrips: 0 });
  await call(first, 'ClaimVoucher', { voucherId: v.id });
  await call(second, 'ClaimVoucher', { voucherId: v.id });
  await assert.rejects(call(admin, 'AdminUpdateVoucherDetails', edit), /mission cannot change/);
  await assert.rejects(
    call(admin, 'AdminUpdateVoucherDetails', { ...edit, requiredTrips: 0, usageLimit: 1 }),
    /limit must be at least 2/,
  );
  await call(admin, 'AdminUpdateVoucherDetails', { ...edit, requiredTrips: 0, usageLimit: 2 });
  assert.deepEqual(
    (
      await db.query(
        'select code,value,minimum_spend,starts_at,expires_at,is_active from public.voucher where id=$1',
        [v.id],
      )
    ).rows[0],
    before,
  );
});
it('restricts promo edits to admins and protects personal loyalty terms', async () => {
  const v = await offer();
  const args = {
    id: v.id,
    title: 'New promo name',
    description: '',
    requiredTrips: 0,
    usageLimit: 5,
  };
  await assert.rejects(
    call(first, 'AdminUpdateVoucherDetails', args),
    /Administrator access required|Forbidden|Admin access required/,
  );
  const personal = (await db.query("select id from public.voucher where code='PERSONAL-LOYALTY'"))
    .rows[0];
  await assert.rejects(
    call(admin, 'AdminUpdateVoucherDetails', { ...args, id: personal.id }),
    /Personal loyalty rewards/,
  );
  await assert.rejects(
    call(admin, 'AdminUpdateVoucherDetails', { ...args, requiredTrips: -1 }),
    /valid voucher mission/,
  );
});
it('cleans placeholder promos without changing claims, discounts or dates', async () => {
  const fresh = await offer({ title: 'Travel promo', description: '', usageLimit: 500, value: 75 });
  const claimed = await offer({
    title: 'Travel promo',
    description: '',
    usageLimit: 500,
    value: 75,
  });
  await call(first, 'ClaimVoucher', { voucherId: claimed.id });
  const financial = async () =>
    (
      await db.query(
        "select id,to_jsonb(v)-'title'-'description'-'required_trips' terms from public.voucher v order by id",
      )
    ).rows;
  const before = await financial();
  await db.exec(fs.readFileSync('supabase/voucher-promo-details.sql', 'utf8'));
  assert.deepEqual(await financial(), before);
  assert.equal(
    (await db.query('select required_trips from public.voucher where id=$1', [fresh.id])).rows[0]
      .required_trips,
    3,
  );
  assert.equal(
    (await db.query('select required_trips from public.voucher where id=$1', [claimed.id])).rows[0]
      .required_trips,
    0,
  );
  assert.equal(
    (await call(first, 'PassengerVouchers')).vouchers.find((x) => x.id === claimed.id).code,
    claimed.code,
  );
});

it('reports availability before the claim requirement for expired, future and paused codes', async () => {
  for (const [extra, message] of [
    [{ expiresAt: new Date(Date.now() - 1000).toISOString() }, /voucher has expired/],
    [{ startsAt: new Date(Date.now() + 3600000).toISOString() }, /not available yet/],
    [{ isActive: false }, /voucher is inactive/],
  ]) {
    const v = await offer(extra);
    await assert.rejects(call(first, 'QuoteVoucher', { voucherCode: v.code }), message);
  }
  const valid = await offer();
  await assert.rejects(
    call(first, 'QuoteVoucher', { voucherCode: valid.code }),
    /Claim this voucher on the Claim vouchers page/,
  );
});

it('includes the earned personal code in one private loyalty notification', async () => {
  for (let n = 0; n < 5; n++) await journey(`CODE-MISSION-${n}`, true, true);
  const wallet = await call(second, 'MyLoyalty');
  assert.equal(wallet.vouchers.length, 1);
  const code = wallet.vouchers[0].code;
  const own = await call(second, 'MyNotifications');
  const messages = own.notifications.filter((n) => n.title === 'Your loyalty voucher is ready');
  assert.equal(messages.length, 1);
  assert.ok(messages[0].message.includes(`Voucher code: ${code}.`));
  assert.equal(
    (await call(first, 'MyNotifications')).notifications.some((n) => n.message.includes(code)),
    false,
  );
  await call(second, 'MyLoyalty');
  assert.equal(
    (await call(second, 'MyNotifications')).notifications.filter(
      (n) => n.title === 'Your loyalty voucher is ready',
    ).length,
    1,
  );
});
