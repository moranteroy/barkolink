import { PGlite } from '@electric-sql/pglite';
import { before, beforeEach, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let db;
const ids={ADMIN:'33333333-3333-4333-8333-333333333333',TICKETING:'44444444-4444-4444-8444-444444444444',BOARDING:'55555555-5555-4555-8555-555555555555',PASSENGER:'11111111-1111-4111-8111-111111111111'};
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text unique not null,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
    create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),status text not null,factor_type text not null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
  for(const [role,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,`${role.toLowerCase()}@example.invalid`,JSON.stringify({role})]);
});
after(async()=>await db?.close());
beforeEach(async()=>{await db.exec('delete from barkolink_private.account_mfa_preference;delete from auth.mfa_factors;update barkolink_private.mfa_policy set staff_required=true;');});
async function as(role,sql,values=[],aal='aal1',timestamp){
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[role]||'',JSON.stringify({aal,...(timestamp===undefined?{}:{amr:[{method:'totp',timestamp}]})})]);
  await db.exec(`set role ${role==='ANON'?'anon':'authenticated'}`);
  try{return(await db.query(sql,values)).rows;}finally{await db.exec('reset role');}
}
async function factor(role,status='verified'){await db.query("insert into auth.mfa_factors(user_id,status,factor_type) values($1,$2,'totp')",[ids[role],status]);}
const access=(role,aal='aal1')=>as(role,"select public.barkolink_execute('MyProfile','{}')",[],aal);
it('lets an unenrolled admin use optional 2FA but requires staff setup by default',async()=>{
 const settings=(await as('ADMIN','select public.my_mfa_settings() s'))[0].s;
 assert.equal(settings.enabled,false);assert.equal(settings.mfaRequired,false);await access('ADMIN');
 for(const role of ['TICKETING','BOARDING']){
  assert.equal((await as(role,'select public.my_mfa_settings() s'))[0].s.policyRequired,true);
  await assert.rejects(access(role),/authenticator code/);
 }
});
it('makes optional staff access available without bypassing accounts that opted into 2FA',async()=>{
 await as('ADMIN','select public.set_staff_mfa_required(false)');
 for(const role of ['ADMIN','TICKETING','BOARDING']){
  await access(role);await factor(role);await assert.rejects(access(role),/authenticator code/);await access(role,'aal2');
 }
});
it('does not treat unfinished enrollment as enabled and reflects unenrollment authoritatively',async()=>{
 await as('ADMIN','select public.set_staff_mfa_required(false)');await factor('TICKETING','unverified');await access('TICKETING');
 await db.exec("update auth.mfa_factors set status='verified'");
 assert.equal((await as('TICKETING','select public.my_mfa_settings() s'))[0].s.enabled,true);
 await assert.rejects(access('TICKETING'),/authenticator code/);
 await db.exec('delete from auth.mfa_factors');await access('TICKETING');
});
it('applies required staff policy immediately even after a factor is removed',async()=>{
 await as('ADMIN','select public.set_staff_mfa_required(false)');await access('BOARDING');
 await as('ADMIN','select public.set_staff_mfa_required(true)');await assert.rejects(access('BOARDING'),/authenticator code/);
 await factor('BOARDING');await db.exec('delete from auth.mfa_factors');await assert.rejects(access('BOARDING'),/authenticator code/);
});
it('limits policy writes to administrators and enforces their enabled 2FA',async()=>{
 for(const role of ['TICKETING','BOARDING','PASSENGER','ANON'])await assert.rejects(as(role,'select public.set_staff_mfa_required(false)'),/Administrator|permission denied/);
 await factor('ADMIN');await assert.rejects(as('ADMIN','select public.set_staff_mfa_required(false)'),/authenticator code/);
 await as('ADMIN','select public.set_staff_mfa_required(false)',[],'aal2');
 assert.ok((await db.query("select count(*)::int n from public.activity_log where action='MFA_POLICY_UPDATED'")).rows[0].n>0);
});
it('protects settings and the service-only account check from anonymous and direct clients',async()=>{
 await assert.rejects(as('ANON','select public.my_mfa_settings()'),/permission denied/);
 await assert.rejects(as('ADMIN','select public.admin_mfa_requirement($1)',[ids.ADMIN]),/permission denied/);
 await db.exec('set role service_role');
 try{assert.equal((await db.query('select public.admin_mfa_requirement($1) required',[ids.ADMIN])).rows[0].required,false);}finally{await db.exec('reset role');}
});

const fresh=()=>Math.floor(Date.now()/1000);
it('turns off and on using verification while preserving the same authenticator',async()=>{
 await factor('ADMIN');const timestamp=fresh();
 const factorBefore=(await db.query('select id from auth.mfa_factors')).rows[0].id;
 let settings=(await as('ADMIN','select public.set_account_mfa_enabled(false) s',[],'aal2',timestamp))[0].s;
 assert.equal(settings.enabled,false);assert.equal(settings.authenticatorLinked,true);assert.equal(settings.mfaRequired,false);await access('ADMIN');
 await assert.rejects(as('ADMIN','select public.set_account_mfa_enabled(true)',[],'aal2',timestamp),/new authenticator code/);
 settings=(await as('ADMIN','select public.set_account_mfa_enabled(true) s',[],'aal2',timestamp+1))[0].s;
 assert.equal(settings.enabled,true);assert.equal(settings.authenticatorLinked,true);await assert.rejects(access('ADMIN'),/authenticator code/);
 assert.equal((await db.query('select id from auth.mfa_factors')).rows[0].id,factorBefore);
});
it('rejects absent or stale proof and never changes factors or preferences on failure',async()=>{
 await factor('ADMIN');
 for(const [aal,timestamp] of [['aal1',fresh()],['aal2',undefined],['aal2',fresh()-600],['aal2',fresh()+600]]){
  await assert.rejects(as('ADMIN','select public.set_account_mfa_enabled(false)',[],aal,timestamp),/fresh authenticator code/);
 }
 assert.equal((await db.query('select count(*)::int n from barkolink_private.account_mfa_preference')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from auth.mfa_factors')).rows[0].n,1);
});
it('required staff policy overrides a paused preference and blocks disabling',async()=>{
 await as('ADMIN','select public.set_staff_mfa_required(false)');await factor('TICKETING');
 await as('TICKETING','select public.set_account_mfa_enabled(false)',[],'aal2',fresh());await access('TICKETING');
 await as('ADMIN','select public.set_staff_mfa_required(true)');
 assert.equal((await as('TICKETING','select public.my_mfa_settings() s'))[0].s.enabled,true);
 await assert.rejects(access('TICKETING'),/authenticator code/);
 await assert.rejects(as('TICKETING','select public.set_account_mfa_enabled(false)',[],'aal2',fresh()+1),/administrator requires/);
});
it('does not enable unlinked authenticators or allow passengers to toggle account MFA',async()=>{
 await assert.rejects(as('ADMIN','select public.set_account_mfa_enabled(true)',[],'aal2',fresh()),/Link an authenticator/);
 await assert.rejects(as('PASSENGER','select public.set_account_mfa_enabled(true)',[],'aal2',fresh()),/Staff or administrator/);
 await assert.rejects(as('ANON','select public.set_account_mfa_enabled(true)'),/permission denied/);
});
