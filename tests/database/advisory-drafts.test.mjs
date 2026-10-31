import { PGlite } from '@electric-sql/pglite';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

it('adds ten unpublished templates and preserves existing advisories and later edits on repeat runs', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.travel_advisory (
      id uuid primary key,title text,message text,category text,priority text,sailing_code text,
      starts_at timestamptz,ends_at timestamptz,published boolean,check(ends_at>starts_at));
      insert into public.travel_advisory values('11111111-1111-4111-8111-111111111111','Existing advisory','Keep existing notice',
        'GENERAL','LOW',null,now(),now()+interval '1 day',true);`);
    const original = (await db.query("select * from public.travel_advisory where title='Existing advisory'")).rows[0];
    const seed = fs.readFileSync('supabase/advisory-drafts.sql', 'utf8');
    await db.exec(seed);
    const drafts = (await db.query('select * from public.travel_advisory where not published')).rows;
    assert.equal(drafts.length, 10);
    assert.ok(drafts.every(d => !d.published && !d.sailing_code && new Date(d.ends_at)>new Date(d.starts_at)));
    assert.deepEqual(new Set(drafts.map(d => d.category)), new Set(['WEATHER','SCHEDULE','PORT','GENERAL','SAFETY']));
    await db.query("update public.travel_advisory set title='Edited by admin',published=true,ends_at=ends_at+interval '2 days' where id=$1", [drafts[0].id]);
    const edited = (await db.query('select * from public.travel_advisory where id=$1', [drafts[0].id])).rows[0];
    await db.exec(seed);
    assert.equal((await db.query('select count(*)::int n from public.travel_advisory')).rows[0].n, 11);
    assert.deepEqual((await db.query('select * from public.travel_advisory where id=$1', [edited.id])).rows[0], edited);
    assert.deepEqual((await db.query('select * from public.travel_advisory where id=$1', [original.id])).rows[0], original);
  } finally { await db.close(); }
});
