import { PGlite } from '@electric-sql/pglite';
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const cal = '76a29980-5c27-4c4b-9ead-cae943202001';
const btg = '76a29980-5c27-4c4b-9ead-cae943202002';
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql', 'utf8'));
  await db.exec(`delete from public.sailing;`);
  for (const [code, origin, destination, depart, arrive, status] of [
    ['TV-OUT', cal, btg, '12 hours', '14 hours', 'CANCELLED'],
    ['TV-IN', btg, cal, '-1 hour', '1 hour', 'DELAYED'],
    ['TV-TOMORROW', cal, btg, '36 hours', '38 hours', 'SCHEDULED'],
    ['TV-YESTERDAY', btg, cal, '-12 hours', '-10 hours', 'COMPLETED'],
  ]) {
    const vessel = (await db.query("insert into public.vessel(code,name,passenger_capacity,reference_metadata) values($1,$1,100,'{\"kind\":\"test-reference\",\"operator\":\"FastCat\"}') returning id", [code])).rows[0].id;
    await db.query(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
      values($1,$2,$3,$4,(date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')+$5::interval,
      (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')+$6::interval,120,600,480,480,300,480,600,100,$7)`,
    [code, origin, destination, vessel, depart, arrive, status]);
  }
  await db.exec(`insert into public.travel_advisory(title,message,category,priority,sailing_code,starts_at,ends_at,published) values
    ('Global notice','Published terminal notice','GENERAL','LOW',null,now()-interval '1 hour',now()+interval '1 hour',true),
    ('Trip notice','Cancelled departure notice','SCHEDULE','HIGH','TV-OUT',now()-interval '1 hour',now()+interval '1 hour',true),
    ('Private draft','This must never be public','GENERAL','HIGH',null,now()-interval '1 hour',now()+interval '1 hour',false),
    ('Expired notice','This notice has expired','GENERAL','HIGH',null,now()-interval '2 hours',now()-interval '1 hour',true),
    ('Future notice','This notice starts later','GENERAL','HIGH',null,now()+interval '1 hour',now()+interval '2 hours',true);`);
});
after(async () => await db?.close());
async function call(port = cal) {
  await db.exec('set role anon');
  try { return (await db.query('select public.port_display($1::uuid) as data', [port])).rows[0].data; }
  finally { await db.exec('reset role'); }
}
it('allows a signed-out TV to read only the selected port’s today schedules including overnight arrivals and cancelled trips', async () => {
  const data = await call();
  assert.equal(data.portId, cal);
  assert.deepEqual(data.sailings.map(s => s.code).sort(), ['TV-IN', 'TV-OUT']);
  assert.equal(data.sailings.find(s => s.code === 'TV-OUT').status, 'CANCELLED');
  assert.equal(data.sailings.find(s => s.code === 'TV-IN').operator, 'FastCat');
  assert.deepEqual(Object.keys(data.sailings[0]).sort(), ['arrivalAt', 'code', 'departureAt', 'destination', 'operator', 'origin', 'status', 'vessel']);
  assert.deepEqual(Object.keys(data).sort(), ['advisories', 'date', 'portId', 'ports', 'sailings', 'updatedAt']);
  // Reverse direction does not accidentally show a previous day's departure at Batangas.
  assert.deepEqual((await call(btg)).sailings.map(s => s.code), ['TV-OUT']);
});
it('publishes active notices only and orders high priority first', async () => {
  assert.deepEqual((await call()).advisories.map(a => a.title), ['Trip notice', 'Global notice']);
});
it('does not give anonymous screens direct access to passenger or operational tables', async () => {
  await db.exec('set role anon');
  try {
    for (const table of ['booking', 'booking_passenger', 'app_user', 'sailing', 'travel_advisory']) {
      await assert.rejects(db.exec(`select * from public.${table}`), /permission denied/);
    }
  } finally { await db.exec('reset role'); }
});
it('rejects unavailable ports and supplies an active default', async () => {
  assert.ok((await call(null)).portId);
  await assert.rejects(call('00000000-0000-4000-8000-000000000000'), /Port is unavailable/);
  await db.query('update public.port set is_active=false where id=$1', [cal]);
  try {
    await assert.rejects(call(), /Port is unavailable/);
    assert.ok(!(await call(null)).ports.some(p => p.id === cal));
  } finally { await db.query('update public.port set is_active=true where id=$1', [cal]); }
});
