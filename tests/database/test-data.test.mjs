import { PGlite } from '@electric-sql/pglite'
import { before, after, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectRef, snapshotQuery, resetTransaction, fixtureChecks, usersExpression } from '../../scripts/test-data-database.mjs'
import { buildDemoSeed, demoChecks } from '../../scripts/demo-dataset.mjs'

let db
let originalUsers
const seed = fs.readFileSync('supabase/test-data.sql', 'utf8')
const ids = { PASSENGER: '11111111-1111-4111-8111-111111111111', ADMIN: '33333333-3333-4333-8333-333333333333',
  TICKETING: '44444444-4444-4444-8444-444444444444', BOARDING: '55555555-5555-4555-8555-555555555555' }
async function rpc(role, operation, args = {}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role]])
  return (await db.query('select public.barkolink_execute($1,$2::jsonb) as data', [operation, JSON.stringify(args)])).rows[0].data
}
before(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`)
  for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
  for (const [role, id] of Object.entries(ids)) await db.query(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4)`,
    [id, `${role.toLowerCase()}@example.com`, { fullName: `Original ${role}` }, { role }])
  await db.exec("insert into public.app_user(uid,email,full_name,role) values('original-walk-in','walkin@example.invalid','Original walk-in','WALK_IN')")
  const snapshot = (await db.query(snapshotQuery)).rows[0]
  originalUsers = snapshot.users
  await db.exec(resetTransaction({ projectRef, ...snapshot }, seed))
})
after(async () => { await db?.close() })

it('resets all operational tables while preserving complete user and auth records', async () => {
  assert.deepEqual((await db.query(`select ${usersExpression} as users`)).rows[0].users, originalUsers)
  await db.exec(fixtureChecks)
  assert.equal((await db.query('select count(*)::int as n from public.sailing')).rows[0].n, 15)
  assert.equal((await db.query('select count(*)::int as n from public.booking')).rows[0].n, 33)
  assert.equal((await db.query('select count(*)::int as n from public.booking_passenger')).rows[0].n, 82)
})
it('provides server pagination, complete manifest and custom-discount reporting data', async () => {
  await db.exec('begin')
  try {
    const result = await rpc('ADMIN', 'AdminPassengerRecords', { sailingCode: 'TEST-SCHEDULED', pageSize: 30 })
    assert.equal(result.totalCount, 36)
    assert.equal(result.bookingPassengers.length, 30)
    const page2 = await rpc('ADMIN', 'AdminPassengerRecords', { sailingCode: 'TEST-SCHEDULED', page: 1, pageSize: 30 })
    assert.equal(page2.bookingPassengers.length, 6)
    const manifest = await rpc('ADMIN', 'AdminExportManifest', { sailingCode: 'TEST-SCHEDULED', offset: 0 })
    assert.equal(manifest.bookingPassengers.length, 36)
    const range = (await db.query("select jsonb_build_object('startAt',now()-interval '8 months','endAt',now()+interval '5 days') as args")).rows[0].args
    const reports = await rpc('ADMIN', 'AdminReports', range)
    assert.ok(JSON.stringify(reports).includes('TEST-MONTH-6'))
  } finally { await db.exec('rollback') }
})
it('supports verification, cash payment, check-in, boarding, refund and cancellation', async () => {
  await db.exec('begin')
  try {
    const booking = (await db.query("select id from public.booking where reference='TEST-DISCOUNT-PENDING'")).rows[0]
    const passengers = (await db.query('select id from public.booking_passenger where booking_id=$1', [booking.id])).rows
    for (const p of passengers) await rpc('TICKETING', 'VerifyPassengerDiscount', { passengerId: p.id, note: 'TEST fictional document reviewed' })
    await rpc('TICKETING', 'CollectBookingPayment', { bookingId: booking.id, method: 'CASH' })
    assert.equal((await db.query('select payment_status from public.booking where id=$1', [booking.id])).rows[0].payment_status, 'PAID')
    const ticket = (await db.query("select p.id from public.booking_passenger p join public.booking b on b.id=p.booking_id where b.reference='TEST-ISSUED' limit 1")).rows[0]
    await rpc('BOARDING', 'CheckInTicket', { passengerId: ticket.id })
    await rpc('BOARDING', 'BoardTicket', { passengerId: ticket.id })
    assert.equal((await db.query('select ticket_status from public.booking_passenger where id=$1', [ticket.id])).rows[0].ticket_status, 'BOARDED')
    const refund = (await db.query("select id from public.booking where reference='TEST-REFUND-PENDING'")).rows[0]
    await rpc('TICKETING', 'RefundBooking', { bookingId: refund.id, note: 'TEST simulated refund receipt' })
    const cancel = (await db.query("select id from public.booking where reference='TEST-CANCEL-READY'")).rows[0]
    await rpc('PASSENGER', 'CancelMyBooking', { bookingId: cancel.id })
    assert.equal((await db.query('select status from public.booking where id=$1', [cancel.id])).rows[0].status, 'CANCELLED')
  } finally { await db.exec('rollback') }
})
it('aborts a reset when operational data changed after the backup', async () => {
  const snapshot = (await db.query(snapshotQuery)).rows[0]
  await db.exec("update public.notification set read_at=now() where title='[TEST] Unread notification'")
  await assert.rejects(db.exec(resetTransaction({ projectRef, ...snapshot }, seed)), /changed since the backup/)
  await db.exec('rollback')
  assert.equal((await db.query('select count(*)::int as n from public.booking')).rows[0].n, 33)
  assert.deepEqual((await db.query(`select ${usersExpression} as users`)).rows[0].users, originalUsers)
})
it('rolls the entire cleanup back if reseeding fails', async () => {
  const snapshot = (await db.query(snapshotQuery)).rows[0]
  await assert.rejects(db.exec(resetTransaction({ projectRef, ...snapshot }, "do $$ begin raise exception 'Simulated seed failure'; end $$;")), /Simulated seed failure/)
  await db.exec('rollback')
  assert.deepEqual((await db.query(snapshotQuery)).rows[0].data, snapshot.data)
  assert.deepEqual((await db.query(`select ${usersExpression} as users`)).rows[0].users, originalUsers)
})
it('supports a new reservation with saved travelers and capacity checks', async () => {
  await db.exec('begin')
  try {
    const result = await rpc('PASSENGER', 'MySavedTravelers')
    assert.equal(result.travelers.length, 3)
    await rpc('PASSENGER', 'ReserveSailing2', { sailingCode: 'TEST-EMPTY', reference: 'TEST-NEW-RESERVATION',
      accommodationId: 'eeeeeeee-0000-4000-8000-000000000201', passenger1Name: 'TEST New Adult', passenger1Type: 'REGULAR',
      passenger2Name: 'TEST New Student', passenger2Type: 'STUDENT' })
    const booking = (await db.query("select passenger_count,total from public.booking where reference='TEST-NEW-RESERVATION'")).rows[0]
    assert.equal(booking.passenger_count, 2)
    assert.equal(booking.total, 1080)
  } finally { await db.exec('rollback') }
})
it('verifies all seeded module reads and transactional flows without persisting changes', async () => {
  const snapshot = (await db.query(snapshotQuery)).rows[0]
  await db.exec('begin; create temporary table test_verification_result(module_reads integer,transaction_flows integer) on commit drop;')
  try {
    await db.exec(fs.readFileSync('supabase/verify-test-data.sql', 'utf8'))
    assert.deepEqual((await db.query('select * from pg_temp.test_verification_result')).rows, [{ module_reads: 34, transaction_flows: 7 }])
  } finally { await db.exec('rollback') }
  assert.deepEqual((await db.query(snapshotQuery)).rows[0].data, snapshot.data)
})
it('loads realistic demo records with natural names, varied routes and six months of history', async () => {
  const snapshot = (await db.query(snapshotQuery)).rows[0]
  await db.exec(resetTransaction({ projectRef, ...snapshot }, buildDemoSeed(), demoChecks))
  const result = (await db.query(snapshotQuery)).rows[0]
  assert.deepEqual(result.users, originalUsers)
  assert.equal(result.data.booking.length, 75)
  assert.equal(result.data.booking_passenger.length, 160)
  assert.equal(new Set(result.data.booking_passenger.map(p => p.phone)).size, 160)
  assert.ok(result.data.booking_passenger.every(p => /^09\d{9}$/.test(p.phone)))
  assert.ok(new Set(result.data.booking_passenger.map(p => p.birth_date)).size > 140)
  assert.ok(result.data.saved_traveler.every(t => /^09\d{9}$/.test(t.phone)))
  const invalidAges = (await db.query(`select count(*)::int as n from public.booking_passenger p
    join public.booking b on b.id=p.booking_id join public.sailing s on s.code=b.sailing_code
    where (p.passenger_type='CHILD' and extract(year from age(least(s.departure_at,now()),p.birth_date)) not between 3 and 11)
       or (p.passenger_type='SENIOR' and extract(year from age(least(s.departure_at,now()),p.birth_date))<60)
       or p.birth_date>(now() at time zone 'Asia/Manila')::date`)).rows[0].n
  assert.equal(invalidAges, 0)
  assert.doesNotMatch(JSON.stringify(result.data), /TEST-|\[TEST\]|Test Promo|TEST Passenger/)
  const overview = await rpc('ADMIN', 'AdminOverview')
  assert.ok(overview.routes.length >= 3)
  assert.ok(overview.categories.some(item => item.name === 'Resident'))
  assert.ok(overview.monthly.every(month => month.bookings >= 8))
})
