import { PGlite } from '@electric-sql/pglite';
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db, vessel, economy;
const migration = fs.readFileSync('supabase/migrations/054_initial_vessel_accommodation_classes.sql', 'utf8');
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  vessel = (await db.query(`insert into public.vessel(code,name,passenger_capacity,reference_metadata) values('CLASS-307','Class fixture',307,'{"operator":"Starlite Ferries"}') returning id`)).rows[0].id;
  economy = (await db.query(`insert into public.accommodation(vessel_id,name,description,capacity,surcharge) values($1,'Economy','Saved vessel description',231,25) returning id`, [vessel])).rows[0].id;
});
after(async () => await db?.close());
it('completes three vessel-specific classes with a full integer allocation and preserves saved fields', async () => {
  await db.exec(migration);
  const rows = (await db.query('select * from public.accommodation where vessel_id=$1 order by name', [vessel])).rows;
  assert.deepEqual(rows.map(row => [row.name, row.capacity]), [['Business Class', 30], ['Economy', 216], ['Tourist Class', 61]]);
  assert.equal(rows.reduce((sum, row) => sum + row.capacity, 0), 307);
  assert.equal(rows.find(row => row.name === 'Economy').id, economy);
  assert.equal(rows.find(row => row.name === 'Economy').surcharge, 25);
  assert.equal(rows.find(row => row.name === 'Economy').description, 'Saved vessel description');
  assert.equal(rows.find(row => row.name === 'Business Class').surcharge, 0);
});
it('does not overwrite later admin edits when reapplied or change inactive vessels', async () => {
  await db.query('update public.accommodation set capacity=215 where id=$1', [economy]);
  await db.query(`update public.accommodation set capacity=31 where vessel_id=$1 and name='Business Class'`, [vessel]);
  const inactive = (await db.query(`insert into public.vessel(code,name,passenger_capacity,is_active,reference_metadata) values('CLASS-OFF','Inactive fixture',100,false,'{"operator":"Starlite Ferries"}') returning id`)).rows[0].id;
  await db.exec(migration);
  assert.equal((await db.query('select capacity from public.accommodation where id=$1', [economy])).rows[0].capacity, 215);
  assert.equal((await db.query('select count(*)::int n from public.accommodation where vessel_id=$1', [inactive])).rows[0].n, 0);
});
it('refuses to reallocate a vessel with other active classes', async () => {
  const other = (await db.query(`insert into public.vessel(code,name,passenger_capacity,reference_metadata) values('CLASS-OTHER','Other fixture',100,'{"operator":"Starlite Ferries"}') returning id`)).rows[0].id;
  await db.query(`insert into public.accommodation(vessel_id,name,capacity) values($1,'Other class',50)`, [other]);
  await assert.rejects(db.exec(migration), /Review other active accommodation classes/);
  assert.equal((await db.query('select count(*)::int n from public.accommodation where vessel_id=$1', [other])).rows[0].n, 1);
});
