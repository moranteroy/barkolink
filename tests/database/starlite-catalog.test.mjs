import { PGlite } from '@electric-sql/pglite';
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const sql=fs.readFileSync('supabase/migrations/049_starlite_accommodation_catalog.sql','utf8');
before(async()=>{
  db=new PGlite();
  await db.exec(`create table public.vessel(id int primary key,code text unique,reference_metadata jsonb);
    create table public.accommodation(id int primary key,vessel_id int references public.vessel,name text,is_active boolean);
    create table public.booking(id int primary key,accommodation_id int references public.accommodation);
    insert into public.vessel values(1,'SL-SWM-STELLA-DEL-MAR','{"operator":"Starlite Ferries"}'),(2,'OTHER','{"operator":"Other"}');
    insert into public.accommodation values(1,1,'Economy',true),(2,1,'Premium Economy',true),(3,1,'Private cabin',true),(4,2,'Premium Economy',true);
    insert into public.booking values(1,3);`);
});
after(async()=>{await db.close();});
it('normalizes the code, removes only unbooked unsupported Starlite classes and archives booked classes',async()=>{
  await db.exec(sql);
  assert.equal((await db.query('select code from public.vessel where id=1')).rows[0].code,'SL-STELLA-DEL-MAR');
  assert.deepEqual((await db.query('select id,is_active from public.accommodation order by id')).rows,[{id:1,is_active:true},{id:3,is_active:false},{id:4,is_active:true}]);
  assert.equal((await db.query('select count(*)::int n from public.booking')).rows[0].n,1);
  await db.exec(sql); // Reapplying does not remove history or change supported classes.
});
it('rejects a conflicting code atomically',async()=>{
  await db.exec(`begin;update public.vessel set code='SL-SWM-STELLA-DEL-MAR' where id=1;
    insert into public.vessel values(3,'SL-STELLA-DEL-MAR','{}');`);
  await assert.rejects(db.exec(sql),/already in use/);
  await db.exec('rollback');
});
