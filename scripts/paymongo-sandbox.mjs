import fs from 'node:fs';

function env(path) {
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(line => /^\w+\s*=/.test(line)).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
}
const config = env('.env.paymongo.local'), frontend = env('.env.local'), management = env('.env.supabase-management');
const key = config.PAYMONGO_SECRET_KEY, token = management.SUPABASE_ACCESS_TOKEN;
if (!key?.startsWith('sk_test_')) throw new Error('A PayMongo Secret Test Key is required; live keys are disabled.');
if (!token) throw new Error('Supabase management token is missing.');
const origin = new URL(frontend.VITE_SUPABASE_URL).origin;
const project = new URL(origin).hostname.split('.')[0];
const webhookUrl = `${origin}/functions/v1/paymongo`;
const mode = process.argv[2] || 'inspect';
async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const codes = result?.errors?.map(error => error.code).filter(Boolean).join(', ');
    throw new Error(`${new URL(url).hostname} request failed (${response.status})${codes ? `: ${codes}` : ''}`);
  }
  return result;
}
export const admin = (path, options = {}) => request(`https://api.supabase.com/v1/projects/${project}${path}`, {
  ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers },
});
export const sql = (query, readOnly = true) => admin('/database/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, read_only: readOnly }),
});
export const paymongo = async (path, method = 'GET', attributes, idempotency) => {
  const result = await request(`https://api.paymongo.com${path}`, {
    method, headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, 'Content-Type': 'application/json',
      ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) },
    ...(attributes ? { body: JSON.stringify({ data: { attributes } }) } : {}),
  });
  return result.data;
};
const inspectQuery = `select to_regclass('public.online_payment') is not null as payment_table,
  to_regprocedure('public.prepare_paymongo_test(uuid,text)') is not null as prepare_function,
  to_regprocedure('public.complete_paymongo_test(text,text,integer,text)') is not null as complete_function,
  to_regclass('public.activity_log') is not null as audit_table,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking_passenger' and column_name='discount_verified_at') as discount_verification`;

if (mode === 'inspect') {
  const [state, webhooks, functions] = await Promise.all([sql(inspectQuery), paymongo('/v1/webhooks'), admin('/functions')]);
  console.log(JSON.stringify({ testKeyAccepted: true, returnOrigin: config.PAYMONGO_RETURN_ORIGIN || null,
    database: state[0], registeredWebhook: webhooks.some(item => item.attributes?.url === webhookUrl),
    function: functions.filter(item => item.slug === 'paymongo').map(item => ({ slug: item.slug, status: item.status, verifyJwt: item.verify_jwt })) }));
} else if (mode === 'install') {
  const returnOrigin = config.PAYMONGO_RETURN_ORIGIN;
  if (!returnOrigin || !/^https?:\/\//.test(returnOrigin) || new URL(returnOrigin).origin !== returnOrigin.replace(/\/$/, '')) throw new Error('Set a valid website origin in PAYMONGO_RETURN_ORIGIN first.');
  // Validate provider access before touching the database or uploading credentials.
  const webhooks = await paymongo('/v1/webhooks');
  const state = (await sql(inspectQuery))[0];
  if (!state.audit_table || !state.discount_verification) throw new Error('Database prerequisites are missing.');
  if (state.payment_table !== state.prepare_function || state.payment_table !== state.complete_function) throw new Error('Partial migration detected; inspect before continuing.');
  if (!state.payment_table) {
    const migration = fs.readFileSync('supabase/migrations/019_paymongo_test_payments.sql', 'utf8');
    await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-paymongo-019')); ${migration} commit;`, false);
    console.log('Payment migration installed.');
  }
  const details = (await sql(`select position('paymentProviderMethod' in pg_get_functiondef('barkolink_private.booking_json(public.booking)'::regprocedure))>0 as installed`))[0];
  if (!details.installed) await sql(fs.readFileSync('supabase/migrations/020_booking_payment_details.sql','utf8'), false);
  const verification = (await sql(`select to_regprocedure('public.verify_online_payment(uuid)') is not null as installed`))[0];
  if (!verification.installed) await sql(fs.readFileSync('supabase/migrations/021_staff_online_payment_verification.sql','utf8'), false);
  const duplicates=(await sql(`select to_regprocedure('barkolink_private.reservation_person_key(text,text,text,text,text,text)') is not null as installed`))[0];
  if(!duplicates.installed)await sql(fs.readFileSync('supabase/migrations/022_prevent_duplicate_reservations.sql','utf8'),false);
  const queue=(await sql(`select to_regprocedure('barkolink_private.execute_flexible_discounts_v22(text,jsonb,text,text)') is not null as installed`))[0];
  if(!queue.installed)await sql(fs.readFileSync('supabase/migrations/023_ticketing_payment_verification_queue.sql','utf8'),false);
  let webhook = webhooks.find(item => item.attributes?.url === webhookUrl);
  if (!webhook) webhook = await paymongo('/v1/webhooks', 'POST', { url: webhookUrl, events: ['checkout_session.payment.paid'] });
  if (webhook.attributes?.livemode === true) throw new Error('Only test webhooks are allowed.');
  const secret = webhook.attributes?.secret_key || config.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new Error('Set the registered webhook signing secret in PAYMONGO_WEBHOOK_SECRET.');
  // Persist locally without logging credentials. The file is ignored by Git.
  const local = fs.readFileSync('.env.paymongo.local', 'utf8').replace(/^PAYMONGO_WEBHOOK_SECRET=.*$/m, `PAYMONGO_WEBHOOK_SECRET=${secret}`);
  fs.writeFileSync('.env.paymongo.local', local);
  await admin('/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
    { name: 'PAYMONGO_SECRET_KEY', value: key }, { name: 'PAYMONGO_RETURN_ORIGIN', value: new URL(returnOrigin).origin },
    { name: 'PAYMONGO_WEBHOOK_SECRET', value: secret },
  ]) });
  const shared = fs.readFileSync('supabase/functions/paymongo/shared.ts', 'utf8').replace(/^export /gm, '');
  const source = fs.readFileSync('supabase/functions/paymongo/index.ts', 'utf8').replace(/import \{ testSecret, verifiedPayment, verifySignature \} from '.\/shared.ts';/, shared);
  const form = new FormData();
  form.append('metadata', JSON.stringify({ name: 'paymongo', entrypoint_path: 'index.ts', verify_jwt: false }));
  form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');
  const deployed = await admin('/functions/deploy?slug=paymongo', { method: 'POST', body: form });
  console.log(JSON.stringify({ deployed: deployed.status, webhook: webhook.attributes?.status, testMode: true, returnOrigin: new URL(returnOrigin).origin }));
} else if (mode === 'upgrade-details') {
  const state = (await sql(`select to_regclass('public.online_payment') is not null as ready,
    position('paymentProviderMethod' in pg_get_functiondef('barkolink_private.booking_json(public.booking)'::regprocedure))>0 as installed`))[0];
  if (!state.ready) throw new Error('Install the payment integration first.');
  if (!state.installed) await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-payment-details-020'));
    ${fs.readFileSync('supabase/migrations/020_booking_payment_details.sql','utf8')} commit;`, false);
  console.log('Verified payment method details are available to staff and admin.');
} else if (mode === 'upgrade-verification') {
  const state = (await sql(`select to_regprocedure('public.verify_online_payment(uuid)') is not null as installed`))[0];
  if (!state.installed) await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-payment-verification-021'));
    ${fs.readFileSync('supabase/migrations/021_staff_online_payment_verification.sql','utf8')} commit;`, false);
  console.log('Staff payment verification installed. New online payments require staff approval before ticket issuance.');
} else if (mode === 'upgrade-duplicates') {
  const state=(await sql(`select to_regprocedure('barkolink_private.reservation_person_key(text,text,text,text,text,text)') is not null as installed`))[0];
  if(!state.installed)await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-duplicate-reservations-022'));
    ${fs.readFileSync('supabase/migrations/022_prevent_duplicate_reservations.sql','utf8')} commit;`,false);
  console.log('Duplicate reservation protection installed. Existing bookings preserved.');
} else if (mode === 'upgrade-queue') {
  const state=(await sql(`select to_regprocedure('barkolink_private.execute_flexible_discounts_v22(text,jsonb,text,text)') is not null as installed`))[0];
  if(!state.installed)await sql(`begin; select pg_advisory_xact_lock(hashtext('barkolink-verification-queue-023'));
    ${fs.readFileSync('supabase/migrations/023_ticketing_payment_verification_queue.sql','utf8')} commit;`,false);
  console.log('Ticketing dashboard now includes online payments awaiting staff verification.');
} else if (mode === 'test') {
  const { runSandboxTest } = await import('./test-paymongo-sandbox.mjs');
  await runSandboxTest({ admin, sql, origin, frontend });
} else {
  throw new Error('Use inspect, install, upgrade-details, upgrade-verification, upgrade-duplicates, upgrade-queue or test.');
}
