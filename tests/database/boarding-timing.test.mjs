import { PGlite } from '@electric-sql/pglite';
import { before, beforeEach, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const users = {
  admin: '33333333-3333-4333-8333-333333333333',
  boarding: '55555555-5555-4555-8555-555555555555',
  ticketing: '44444444-4444-4444-8444-444444444444',
  passenger: '11111111-1111-4111-8111-111111111111',
  unassigned: '66666666-6666-4666-8666-666666666666',
};
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    select set_config('request.jwt.claims','{"aal":"aal2"}',false);`);
  for (const file of fs.readdirSync('supabase/migrations').sort())
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/basic-reference.sql', 'utf8'));
  for (const [name, id] of Object.entries(users))
    await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3::jsonb)', [
      id,
      `${name}@example.invalid`,
      JSON.stringify({ role: name === 'unassigned' ? 'BOARDING' : name.toUpperCase() }),
    ]);
  await db.exec(
    "update public.app_user set assigned_port_id=(select id from public.port where code='CAL') where role in ('BOARDING','TICKETING')",
  );
  await db.query('update public.app_user set assigned_port_id=null where uid=$1', [
    users.unassigned,
  ]);
  await db.exec(`update public.vessel set reference_metadata='{"kind":"test-reference","operator":"Test Operator"}' where code='MIS-001';
    insert into barkolink_private.sailing_status_policy(operator,boarding_lead_minutes,boarding_time_source) values('Test Operator',30,'Operator confirmed default');`);
});
beforeEach(async () => {
  await db.exec(
    'delete from public.sailing;delete from public.activity_log;update public.port set is_active=true;select set_config(\'request.jwt.claims\',\'{"aal":"aal2"}\',false)',
  );
  await db.exec(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats,status)
    select 'TIMING-TRIP',o.id,d.id,v.id,now()+interval '3 hours',now()+interval '5 hours',120,600,480,480,300,480,600,200,'SCHEDULED' from public.port o,public.port d,public.vessel v where o.code='CAL' and d.code='BTG' and v.code='MIS-001';`);
});
after(async () => await db?.close());
async function call(role, operation, args = {}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[role] || '']);
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
  }
}
const read = async (role = 'boarding') =>
  (await call(role, 'BoardingSailingTiming', { sailingCode: 'TIMING-TRIP' })).timing;
async function input() {
  const t = await read();
  return {
    sailingCode: t.sailingCode,
    boardingAt: new Date(Date.parse(t.departureAt) - 3600000).toISOString(),
    expectedUpdatedAt: t.updatedAt,
    reason: 'Crew confirmed earlier terminal opening',
  };
}
it('allows assigned Boarding staff to set one trip, preserves operator policy and records trusted audit details', async () => {
  const before = await read();
  assert.equal(before.usesOperatorDefault, true);
  const change = await input();
  const after = (await call('boarding', 'BoardingSetSailingTiming', change)).timing;
  assert.equal(after.usesOperatorDefault, false);
  assert.equal(Date.parse(after.effectiveBoardingAt), Date.parse(change.boardingAt));
  assert.equal(
    (await db.query('select boarding_lead_minutes from barkolink_private.sailing_status_policy'))
      .rows[0].boarding_lead_minutes,
    30,
  );
  const log = (
    await db.query("select * from public.activity_log where action='BOARDING_TIME_UPDATED'")
  ).rows[0];
  assert.equal(log.actor_uid, users.boarding);
  assert.equal(log.actor_role, 'BOARDING');
  assert.equal(log.details.reason, change.reason);
  assert.equal(Date.parse(log.details.boardingAt.before), Date.parse(before.effectiveBoardingAt));
  assert.equal(Date.parse(log.details.boardingAt.after), Date.parse(change.boardingAt));
});
it('denies other roles, anonymous access, unassigned staff, inactive ports and trips departing another port', async () => {
  const change = await input();
  for (const role of ['ticketing', 'passenger', 'anonymous', 'unassigned']) {
    await assert.rejects(read(role), /access required|Sign in|assigned/);
    await assert.rejects(
      call(role, 'BoardingSetSailingTiming', change),
      /access required|Sign in|assigned/,
    );
  }
  await db.exec(
    "update public.sailing set origin_port_id=(select id from public.port where code='BTG'),destination_port_id=(select id from public.port where code='CAL') where code='TIMING-TRIP'",
  );
  await assert.rejects(read(), /outside your assigned port/);
  await assert.rejects(
    call('boarding', 'BoardingSetSailingTiming', change),
    /outside your assigned port/,
  );
  await db.exec("update public.port set is_active=false where code='CAL'");
  await assert.rejects(read(), /No active port/);
});
it('retains MFA and Admin-only operator-default permissions and prevents direct private-function calls', async () => {
  await assert.rejects(
    call('boarding', 'AdminSaveSailingStatusPolicy', {
      operator: 'Test Operator',
      boardingLeadMinutes: 60,
      boardingTimeSource: 'Staff tries to edit global default',
      autoComplete: true,
    }),
    /Administrator/,
  );
  await db.exec(`select set_config('request.jwt.claims','{"aal":"aal1"}',false)`);
  await assert.rejects(read(), /authenticator code/);
  await db.exec('set role authenticated');
  try {
    await assert.rejects(
      db.query(
        "select barkolink_private.execute_flexible_discounts('BoardingSetSailingTiming','{}',$1,'ADMIN')",
        [users.boarding],
      ),
      /permission denied/,
    );
  } finally {
    await db.exec('reset role');
  }
});
it('requires a reason, bounded boarding start and a current version, rejecting stale dialogs without writes', async () => {
  const change = await input();
  for (const invalid of [
    { reason: '' },
    { reason: 'x'.repeat(501) },
    { boardingAt: null },
    { boardingAt: 'infinity' },
    { boardingAt: new Date(Date.now() + 10 * 86400000).toISOString() },
    { boardingAt: new Date(Date.now() - 10 * 86400000).toISOString() },
    { expectedUpdatedAt: null },
  ])
    await assert.rejects(call('boarding', 'BoardingSetSailingTiming', { ...change, ...invalid }));
  await call('boarding', 'BoardingSetSailingTiming', change);
  await assert.rejects(call('boarding', 'BoardingSetSailingTiming', change), /trip changed/);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.activity_log where action='BOARDING_TIME_UPDATED'",
      )
    ).rows[0].n,
    1,
  );
});
it('blocks closed/departed trips and does not move an already Boarding trip into a future start', async () => {
  const change = await input();
  for (const status of ['DELAYED', 'CANCELLED', 'COMPLETED']) {
    await db.query('update public.sailing set status=$1 where code=$2', [status, 'TIMING-TRIP']);
    assert.equal((await read()).canEdit, false);
    await assert.rejects(call('boarding', 'BoardingSetSailingTiming', change), /before departure/);
  }
  await db.exec("update public.sailing set status='BOARDING' where code='TIMING-TRIP'");
  const current = await input();
  await assert.rejects(call('boarding', 'BoardingSetSailingTiming', current), /already started/);
  await call('boarding', 'BoardingSetSailingTiming', {
    ...current,
    boardingAt: new Date(Date.now() - 60000).toISOString(),
  });
  await db.exec(
    "update public.sailing set boarding_at=null,boarding_time_source=null,departure_at=now()-interval '1 minute' where code='TIMING-TRIP'",
  );
  assert.equal((await read()).canEdit, false);
  await assert.rejects(call('boarding', 'BoardingSetSailingTiming', change), /before departure/);
});
it('uses a saved trip override in the existing automatic boarding transition', async () => {
  const change = await input();
  await call('boarding', 'BoardingSetSailingTiming', {
    ...change,
    boardingAt: new Date(Date.now() - 60000).toISOString(),
  });
  assert.equal(
    (await db.query('select barkolink_private.advance_sailing_statuses() n')).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select status from public.sailing where code='TIMING-TRIP'")).rows[0].status,
    'BOARDING',
  );
});
