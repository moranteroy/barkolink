import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { queryLive, projectRef } from './test-data-database.mjs';

async function main() {
const installed = (await queryLive("select to_regprocedure('public.port_display(uuid)') is not null as installed"))[0].installed;
if (!installed && !process.argv.includes('--apply')) {
  console.log('Port display migration is ready. Run with --apply to install.');
  process.exit(0);
}
if (!installed) {
  const migration = fs.readFileSync('supabase/migrations/042_port_display.sql', 'utf8');
  await queryLive(`begin;
    set local lock_timeout='10s'; set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('barkolink-port-display-install'));
    ${migration}
    notify pgrst, 'reload schema';
    commit;`, false);
  console.log('Applied migration 042: public port display feed.');
} else console.log('Port display migration is already installed.');

const security = (await queryLive(`select
  has_function_privilege('anon','public.port_display(uuid)','EXECUTE') as anonymous_feed,
  has_table_privilege('anon','public.booking','SELECT') as anonymous_bookings,
  has_table_privilege('anon','public.booking_passenger','SELECT') as anonymous_passengers,
  has_table_privilege('anon','public.app_user','SELECT') as anonymous_accounts,
  p.prosecdef as security_definer, p.provolatile='s' as stable
  from pg_proc p where p.oid=to_regprocedure('public.port_display(uuid)')`))[0];
assert.equal(security.anonymous_feed, true);
assert.equal(security.security_definer, true);
assert.equal(security.stable, true);
for (const key of ['anonymous_bookings', 'anonymous_passengers', 'anonymous_accounts']) assert.equal(security[key], false);

const port = (await queryLive("select id,name from public.port where is_active order by case when code='CAL' then 0 else 1 end,name limit 1"))[0];
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')]));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
let result;
for (let attempt = 0; attempt < 6; attempt++) {
  result = await client.rpc('port_display', { p_port: port?.id || null });
  if (!result.error || result.error.code !== 'PGRST202') break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (result.error) throw new Error(`Public feed verification failed: ${result.error.code} ${result.error.message}`);
assert.deepEqual(Object.keys(result.data).sort(), ['advisories', 'date', 'portId', 'ports', 'sailings', 'updatedAt']);
assert.equal(result.data.portId, port?.id || null);
console.log(JSON.stringify({ projectRef, verifiedWithoutLogin: true, port: port?.name || null,
  date: result.data.date, sailings: result.data.sailings.length, advisories: result.data.advisories.length,
  tvPath: `/port-display?${port ? `port=${port.id}&` : ''}screen=1`, security }));
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; });
