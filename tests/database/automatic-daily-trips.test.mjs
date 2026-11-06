import { PGlite } from '@electric-sql/pglite';
import { before, beforeEach, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const admin = '33333333-3333-4333-8333-333333333333',
  passenger = '11111111-1111-4111-8111-111111111111';
before(async () => {
  db = new PGlite();
  await db.exec(`select set_config('request.jwt.claims','{"aal":"aal2"}',false)`);
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of fs.readdirSync('supabase/migrations').sort())
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql', 'utf8'));
  await db.query(
    'insert into auth.users(id,email,raw_app_meta_data) values($1,\'admin@example.invalid\',\'{"role":"ADMIN"}\'),($2,\'passenger@example.invalid\',\'{"role":"PASSENGER"}\')',
    [admin, passenger],
  );
});

after(async () => await db?.close());
async function call(operation, args = {}, uid = admin) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec('set role authenticated');
  try {
    return (
      await db.query('select public.barkolink_execute($1,$2::jsonb) as data', [
        operation,
        JSON.stringify(args),
      ])
    ).rows[0].data;
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}
let vessel, outbound, inbound;
beforeEach(async () => {
  await db.exec(
    'delete from public.sailing;delete from barkolink_private.daily_schedule;delete from barkolink_private.vessel_port_observation;',
  );
  await db.exec(
    "delete from public.fare_settings where code in (select id::text from public.vessel where code like 'ROT-%');delete from public.vessel where code like 'ROT-%';",
  );
  vessel = (await db.query("select id from public.vessel where code='MIS-001'")).rows[0].id;
  await db.query(
    `update public.vessel set reference_metadata='{"kind":"verified-reference","operator":"FastCat"}' where id=$1`,
    [vessel],
  );
  await db.exec(`insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes)
    select 'AUTO-OUT',o.id,d.id,120 from public.port o,public.port d where o.code='BTG' and d.code='CAL'
    on conflict(code) do update set is_active=true,duration_minutes=120;
    insert into public.ferry_route(code,origin_port_id,destination_port_id,duration_minutes)
    select 'AUTO-BACK',o.id,d.id,120 from public.port o,public.port d where o.code='CAL' and d.code='BTG'
    on conflict(code) do update set is_active=true,duration_minutes=120;`);
  outbound = (await db.query("select id from public.ferry_route where code='AUTO-OUT'")).rows[0].id;
  inbound = (await db.query("select id from public.ferry_route where code='AUTO-BACK'")).rows[0].id;
  await db.query(
    'insert into public.vessel_route(vessel_id,route_id) values($1,$2),($1,$3) on conflict do nothing',
    [vessel, outbound, inbound],
  );
  await db.exec(`insert into barkolink_private.sailing_status_policy(operator,boarding_lead_minutes,boarding_time_source)
    values('FastCat',60,'Operator confirmed one hour boarding') on conflict(operator) do update set boarding_lead_minutes=60;`);
});
async function setupPair() {
  await db.query(
    `insert into barkolink_private.daily_schedule(operator,route_id,vessel_id,departure_times,duration_minutes)
    values('FastCat',$1,$3,array['08:00'],90),('FastCat',$2,$3,array['11:00'],90)`,
    [outbound, inbound, vessel],
  );
}
async function generate() {
  return (await db.query('select barkolink_private.generate_daily_trips() n')).rows[0].n;
}
async function futureTrip() {
  return (
    await db.query(
      "select * from public.sailing where daily_service_date=(now() at time zone 'Asia/Manila')::date+1 order by departure_at limit 1",
    )
  ).rows[0];
}
it('creates connected daily trips without an app or Prepare step, using route duration, fares and boarding policy', async () => {
  await setupPair();
  assert.ok((await generate()) >= 12);
  const trip = await futureTrip();
  assert.equal(trip.duration_minutes, 120);
  assert.equal(trip.regular_fare, 600);
  assert.match(trip.code, /^TRP\d{4}-\d{7,}$/);
  assert.equal(
    (await db.query("select count(*)::int n from public.sailing where code like 'DLY%'")).rows[0].n,
    0,
  );
  assert.equal(trip.student_fare, 480);
  assert.equal(trip.child_fare, 300);
  assert.ok(trip.passenger_discounts.length > 0);
  assert.equal(new Date(trip.arrival_at) - new Date(trip.departure_at), 120 * 60000);
  assert.equal(new Date(trip.departure_at) - new Date(trip.boarding_at), 60 * 60000);
  assert.equal(
    (
      await db.query(
        "select to_char(departure_at at time zone 'Asia/Manila','HH24:MI') t from public.sailing where code=$1",
        [trip.code],
      )
    ).rows[0].t,
    '08:00',
  );
  assert.equal(await generate(), 0);
  assert.equal(
    (await call('AdminDailySchedules')).schedules.every((s) => s.generatedCount >= 6),
    true,
  );
});
it('keeps edited and cancelled occurrences unchanged when the clock runs again', async () => {
  await setupPair();
  await generate();
  const trip = await futureTrip();
  await call('AdminRescheduleSailing', {
    code: trip.code,
    departureAt: new Date(new Date(trip.departure_at).getTime() + 15 * 60000).toISOString(),
    arrivalAt: new Date(new Date(trip.arrival_at).getTime() + 15 * 60000).toISOString(),
    durationMinutes: 120,
  });
  assert.equal(await generate(), 0);
  const edited = (await db.query('select * from public.sailing where code=$1', [trip.code]))
    .rows[0];
  assert.equal(new Date(edited.departure_at) - new Date(trip.departure_at), 15 * 60000);
  await call('AdminUpdateSailingStatus', {
    code: trip.code,
    status: 'CANCELLED',
    reason: 'Operator cancelled this departure.',
  });
  await generate();
  assert.equal(
    (await db.query('select status from public.sailing where code=$1', [trip.code])).rows[0].status,
    'CANCELLED',
  );
});
it('reports a wrong port while allowing the valid return and subsequent days', async () => {
  await setupPair();
  await db.query(
    "insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note) select $1,id,now()-interval '1 minute',$2,'Terminal confirms vessel at Calapan.' from public.port where code='CAL'",
    [vessel, admin],
  );
  await generate();
  const result = await call('AdminDailySchedules');
  const out = result.schedules.find((s) => s.routeId === outbound);
  assert.match(out.generationIssues[0].reason, /Calapan/);
  // The return can start at the confirmed port and establish subsequent valid days.
  assert.ok(
    (
      await db.query(
        "select count(*)::int n from public.sailing where origin_port_id=(select id from public.port where code='CAL')",
      )
    ).rows[0].n > 0,
  );
});
it('pauses future generation and preserves existing trips and their fare snapshots', async () => {
  await setupPair();
  await generate();
  const before = (await db.query('select code,regular_fare from public.sailing order by code'))
    .rows;
  await db.exec(
    'update barkolink_private.daily_schedule set is_active=false;update public.fare_settings set regular_fare=700',
  );
  assert.equal(await generate(), 0);
  assert.deepEqual(
    (await db.query('select code,regular_fare from public.sailing order by code')).rows,
    before,
  );
});
it('requires an assigned vessel and protects generator execution from passengers', async () => {
  await assert.rejects(
    call('AdminSaveDailySchedule', {
      operator: 'FastCat',
      routeId: outbound,
      assignmentMode: 'FIXED',
      departureTimes: ['08:00'],
      durationMinutes: 120,
      isActive: true,
    }),
    /Assign a vessel/,
  );
  await assert.rejects(
    call(
      'AdminSaveDailySchedule',
      {
        operator: 'FastCat',
        routeId: outbound,
        vesselId: vessel,
        departureTimes: ['08:00'],
        durationMinutes: 120,
        isActive: true,
      },
      passenger,
    ),
    /Administrator/,
  );
  await db.exec('set role authenticated');
  try {
    await assert.rejects(generate(), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
  await db.query(
    "insert into barkolink_private.daily_schedule(operator,route_id,departure_times) values('FastCat',$1,array['08:00'])",
    [outbound],
  );
  await generate();
  assert.equal((await db.query('select count(*)::int n from public.sailing')).rows[0].n, 0);
  assert.match(
    (await call('AdminDailySchedules')).schedules[0].generationIssues[0].reason,
    /Assign a vessel/,
  );
});
it('saves a complete schedule and creates trips immediately without waiting for cron', async () => {
  const result = await call('AdminSaveDailySchedule', {
    operator: 'FastCat',
    routeId: outbound,
    vesselId: vessel,
    departureTimes: ['08:00'],
    durationMinutes: 90,
    isActive: true,
  });
  assert.equal(result.schedules[0].vesselId, vessel);
  assert.ok(result.schedules[0].generatedCount > 0);
  assert.ok(result.schedules[0].generationIssues.some((i) => /Calapan/.test(i.reason)));
});

it('reports missing fares, boarding policy and inactive routes without publishing invalid trips', async () => {
  await setupPair();
  await db.exec('delete from public.fare_settings');
  assert.equal(await generate(), 0);
  assert.match(
    (await call('AdminDailySchedules')).schedules[0].generationIssues[0].reason,
    /fare settings/,
  );
  await db.query(
    'insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount) values($1,600,20,20,50,20)',
    [vessel],
  );
  await db.exec('delete from barkolink_private.sailing_status_policy');
  assert.equal(await generate(), 0);
  assert.match(
    (await call('AdminDailySchedules')).schedules[0].generationIssues[0].reason,
    /boarding policy/,
  );
  await db.exec('update public.ferry_route set is_active=false');
  assert.equal(await generate(), 0);
  assert.match(
    (await call('AdminDailySchedules')).schedules[0].generationIssues[0].reason,
    /Activate the route/,
  );
});

it('adopts an existing matching manual trip without overwriting its times or fares', async () => {
  await setupPair();
  await generate();
  const trip = await futureTrip();
  await db.query(
    'update public.sailing set daily_schedule_id=null,daily_service_date=null,daily_departure_time=null where code=$1',
    [trip.code],
  );
  assert.equal(await generate(), 0);
  const adopted = (await db.query('select * from public.sailing where code=$1', [trip.code]))
    .rows[0];
  assert.equal(adopted.daily_schedule_id, trip.daily_schedule_id);
  assert.equal(adopted.regular_fare, trip.regular_fare);
  assert.equal(new Date(adopted.departure_at).getTime(), new Date(trip.departure_at).getTime());
});

async function setupFleet() {
  for (let i = 1; i <= 5; i++) {
    const v = (
      await db.query(
        `insert into public.vessel(code,name,passenger_capacity,reference_metadata)
      values($1,$2,300,'{"kind":"verified-reference","operator":"FastCat"}') returning id`,
        ['ROT-' + i, 'Rotation ferry ' + i],
      )
    ).rows[0].id;
    await db.query('insert into public.vessel_route(vessel_id,route_id) values($1,$2),($1,$3)', [
      v,
      outbound,
      inbound,
    ]);
    await db.query(
      'insert into public.fare_settings(code,regular_fare,student_discount,senior_discount,child_discount,pwd_discount) values($1,600,20,20,50,20)',
      [v],
    );
  }
  const fleet = (
    await db.query(
      "select id from public.vessel where code='MIS-001' or code like 'ROT-%' order by code",
    )
  ).rows;
  for (let i = 0; i < fleet.length; i++)
    await db.query(
      `insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note)
    select $1,id,now()-interval '1 minute',$2,'Synthetic terminal starting location for rotation test.' from public.port where code=$3`,
      [fleet[i].id, admin, i < 3 ? 'BTG' : 'CAL'],
    );
  await db.query(
    `insert into barkolink_private.daily_schedule(operator,route_id,departure_times,assignment_mode)
    values('FastCat',$1,array['01:00','03:00','05:00','07:00','09:00','11:00','13:00','15:00','17:00','19:00','21:00','23:00'],'FLEET'),
    ('FastCat',$2,array['01:00','03:00','05:00','07:00','09:00','11:00','13:00','15:00','17:00','19:00','21:00','23:00'],'FLEET')`,
    [outbound, inbound],
  );
}
it('rotates all six vessels across 12 daily departures in each direction with no port or overlap conflicts', async () => {
  await setupFleet();
  await generate();
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.sailing where daily_service_date=(now() at time zone 'Asia/Manila')::date+1",
      )
    ).rows[0].n,
    24,
  );
  assert.equal(
    (await db.query('select count(distinct vessel_id)::int n from public.sailing')).rows[0].n,
    6,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from barkolink_private.daily_schedule where generation_issues<>'[]'",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.sailing a join public.sailing b on a.code<b.code and a.vessel_id=b.vessel_id where tstzrange(a.departure_at,a.arrival_at,'[)') && tstzrange(b.departure_at,b.arrival_at,'[)')",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from public.sailing s where barkolink_private.vessel_departure_issue(s.vessel_id,s.origin_port_id,s.departure_at,s.code) is not null',
      )
    ).rows[0].n,
    0,
  );
  assert.equal(await generate(), 0);
});

it('keeps a manually scheduled trip intact and chooses other fleet vessels around it', async () => {
  await setupFleet();
  const route = (await db.query('select * from public.ferry_route where id=$1', [outbound]))
    .rows[0];
  const times = (
    await db.query(
      "select (((now() at time zone 'Asia/Manila')::date+1)+time '08:00') at time zone 'Asia/Manila' departure",
    )
  ).rows[0];
  const result = await call('AdminCreateSailing', {
    vesselId: vessel,
    originPortId: route.origin_port_id,
    destinationPortId: route.destination_port_id,
    departureAt: new Date(times.departure).toISOString(),
    arrivalAt: new Date(new Date(times.departure).getTime() + 120 * 60000).toISOString(),
    durationMinutes: 120,
  });
  const code = result.sailing_insert.code;
  assert.match(code, /^TRP\d{4}-\d{7,}$/);
  const before = (
    await db.query('select to_jsonb(s) row from public.sailing s where code=$1', [code])
  ).rows[0].row;
  await generate();
  assert.deepEqual(
    (await db.query('select to_jsonb(s) row from public.sailing s where code=$1', [code])).rows[0]
      .row,
    before,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.sailing where daily_service_date=(now() at time zone 'Asia/Manila')::date+1",
      )
    ).rows[0].n,
    24,
  );
});

it('explains individual vessel failures when a fleet has no vessel at the origin', async () => {
  await db.query(
    `insert into barkolink_private.vessel_port_observation(vessel_id,port_id,observed_at,confirmed_by_uid,note)
    select $1,id,now()-interval '1 minute',$2,'Synthetic terminal confirms vessel at Calapan.' from public.port where code='CAL'`,
    [vessel, admin],
  );
  const result = await call('AdminSaveDailySchedule', {
    operator: 'FastCat',
    routeId: outbound,
    assignmentMode: 'FLEET',
    departureTimes: ['08:00'],
    durationMinutes: 120,
    isActive: true,
  });
  assert.equal(result.schedules[0].assignmentMode, 'FLEET');
  assert.equal(result.schedules[0].fleetCount, 1);
  const issues = result.schedules[0].generationIssues;
  assert.equal(issues.length > 0, true);
  assert.match(issues[0].reason, /No vessel is available/);
  assert.ok(issues[0].vesselIssues.length > 0);
});

it('shares a non-reusing TRP sequence while code previews do not reserve a number', async () => {
  const preview = async () =>
    (await db.query('select barkolink_private.next_trip_code() code')).rows[0].code;
  const allocate = async () =>
    (await db.query('select barkolink_private.allocate_trip_code() code')).rows[0].code;
  const first = await preview();
  assert.equal(await preview(), first);
  assert.equal(await allocate(), first);
  await db.exec('begin');
  const rolledBack = await allocate();
  await db.exec('rollback');
  const next = await allocate();
  assert.notEqual(next, rolledBack);
  assert.notEqual(next, first);
  assert.match(next, /^TRP\d{4}-\d{7,}$/);
  await db.exec('set role authenticated');
  try {
    await assert.rejects(allocate(), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
});
