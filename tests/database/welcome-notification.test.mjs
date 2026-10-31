import { PGlite } from '@electric-sql/pglite';
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

let db;
const campaign = 'eeeeeeee-0000-4000-8000-000000000301';
const passenger = '11111111-1111-4111-8111-111111111111';
const admin = '33333333-3333-4333-8333-333333333333';
const ordinary = 'eeeeeeee-0000-4000-8000-000000000302';
const addAccount = (id, role) => db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,jsonb_build_object('role',$3::text))", [id, `${id}@example.invalid`, role]);
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of fs.readdirSync('supabase/migrations').filter(f => Number(f.slice(0,3)) < 55).sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await addAccount(passenger, 'PASSENGER'); await addAccount(admin, 'ADMIN');
  await addAccount('44444444-4444-4444-8444-444444444444', 'TICKETING');
  await addAccount('55555555-5555-4555-8555-555555555555', 'BOARDING');
  await db.exec("insert into public.app_user(uid,email,full_name,role) values('walk-in','walk-in@example.invalid','Counter guest','WALK_IN')");
  await db.query(`insert into public.notification_campaign(id,title,message,audience,sent_by_uid,recipient_count) values
    ($1,'Welcome aboard BarkoLink','Welcome to your BarkoLink inbox.','ALL',$3,1),
    ($2,'Terminal update','This announcement was sent before registration.','ALL',$3,0)`, [campaign, ordinary, admin]);
  await db.query("insert into public.notification(owner_uid,title,message,category,campaign_id,read_at) values($1,'Welcome aboard BarkoLink','Already delivered welcome.','GENERAL',$2,'2026-10-01T00:00:00Z')", [passenger, campaign]);
  await db.exec(fs.readFileSync('supabase/migrations/055_automatic_welcome_notification.sql', 'utf8'));
});
after(async () => await db?.close());
const count = async id => Number((await db.query('select count(*) n from public.notification where campaign_id=$1', [id])).rows[0].n);

it('backfills each existing login role once and preserves read notifications', async () => {
  assert.equal(await count(campaign), 4);
  const row = (await db.query('select message,read_at from public.notification where owner_uid=$1 and campaign_id=$2', [passenger, campaign])).rows[0];
  assert.equal(row.message, 'Already delivered welcome.');
  assert.equal(new Date(row.read_at).toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal((await db.query('select recipient_count from public.notification_campaign where id=$1', [campaign])).rows[0].recipient_count, 4);
});
it('delivers through the actual auth profile trigger for new passenger, admin, ticketing and boarding accounts', async () => {
  for (const [i, role] of ['PASSENGER','ADMIN','TICKETING','BOARDING'].entries()) {
    const id = `66666666-6666-4666-8666-66666666666${i}`;
    await addAccount(id, role);
    const rows = (await db.query('select title,message,read_at from public.notification where owner_uid=$1', [id])).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Welcome aboard BarkoLink');
    assert.equal(rows[0].message, 'Welcome to your BarkoLink inbox.'); assert.equal(rows[0].read_at, null);
  }
  assert.equal(await count(campaign), 8);
});
it('does not duplicate welcomes on profile changes, role changes or a repeat backfill', async () => {
  await db.query('update auth.users set raw_user_meta_data=$2::jsonb where id=$1', [passenger, JSON.stringify({ fullName: 'Updated passenger' })]);
  await db.query("update public.app_user set role='TICKETING' where uid=$1", [passenger]);
  await db.query('update public.notification_campaign set is_welcome=true where id=$1', [campaign]);
  assert.equal(await count(campaign), 8);
  assert.equal((await db.query('select recipient_count from public.notification_campaign where id=$1', [campaign])).rows[0].recipient_count, 8);
});
it('excludes walk-in records and delivers once if they become a login role', async () => {
  assert.equal((await db.query("select count(*)::int n from public.notification where owner_uid='walk-in'")).rows[0].n, 0);
  await db.exec("update public.app_user set role='PASSENGER' where uid='walk-in'");
  assert.equal((await db.query("select count(*)::int n from public.notification where owner_uid='walk-in'")).rows[0].n, 1);
});
it('keeps ordinary All accounts broadcasts as a one-time send and reconciles the welcome count', async () => {
  assert.equal(await count(ordinary), 0);
  const total = await count(campaign);
  assert.equal((await db.query('select recipient_count from public.notification_campaign where id=$1', [campaign])).rows[0].recipient_count, total);
  await assert.rejects(db.query('update public.notification_campaign set is_welcome=true where id=$1', [ordinary]));
});
it('keeps delivery functions and campaign writes inaccessible to browser roles', async () => {
  const row = (await db.query(`select
    has_function_privilege('anon','barkolink_private.welcome_account()','execute') a,
    has_function_privilege('authenticated','barkolink_private.welcome_existing_accounts()','execute') b,
    has_table_privilege('authenticated','public.notification_campaign','update') c`)).rows[0];
  assert.deepEqual(row, { a: false, b: false, c: false });
});
