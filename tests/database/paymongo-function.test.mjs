import { before, beforeEach, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createHmac } from 'node:crypto';

let handler, owner, payment, providerCalls, rpcCalls;
const previousDeno = globalThis.Deno, previousFetch = globalThis.fetch;
const id = '11111111-1111-4111-8111-111111111111';
const moduleUrl = source => {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
};
describe('PayMongo Edge Function authorization and confirmation', () => {
  before(async () => {
    globalThis.Deno = { env: { get: name => ({ PAYMONGO_SECRET_KEY: 'sk_test_example', PAYMONGO_RETURN_ORIGIN: 'https://barkolink.example' })[name] || 'test-only' }, serve: callback => { handler = callback; } };
    globalThis.__paymongoClient = () => ({
      auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id } : null }, error: null }) },
      from: table => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'booking' ? { id, owner_uid: owner, payment_status: 'UNPAID' }
        : { id, session_id: 'cs_test', amount: 60000 }, error: null }) }) }) }),
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: { status: 'PAID' }, error: null }; },
    });
    globalThis.fetch = async () => {
      providerCalls++;
      return new Response(JSON.stringify({ data: { id: 'cs_test', type: 'checkout_session', attributes: {
        livemode: false, payments: payment ? [{ id: 'pay_test', attributes: payment }] : [],
      } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const shared = moduleUrl(fs.readFileSync('supabase/functions/paymongo/shared.ts', 'utf8'));
    const source = fs.readFileSync('supabase/functions/paymongo/index.ts', 'utf8')
      .replace(/import \{ createClient \} from 'npm:[^']+';/, 'const createClient = globalThis.__paymongoClient;')
      .replace("'./shared.ts'", JSON.stringify(shared));
    await import(moduleUrl(source));
  });
  after(() => { globalThis.Deno = previousDeno; globalThis.fetch = previousFetch; delete globalThis.__paymongoClient; });
  beforeEach(() => {
    owner = id; providerCalls = 0; rpcCalls = [];
    payment = { status: 'paid', livemode: false, currency: 'PHP', amount: 60000, source: { type: 'gcash' } };
  });
  const request = (token = 'valid', extra = {}, body = { action: 'status', bookingId: id }) => new Request('https://example.com/paymongo', {
    method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body),
  });
  it('rejects unauthenticated and foreign-booking requests before accessing PayMongo', async () => {
    assert.equal((await handler(request(null))).status, 401);
    assert.equal((await handler(request('invalid'))).status, 401);
    owner = 'someone-else';
    assert.equal((await handler(request())).status, 404);
    assert.equal(providerCalls, 0); assert.equal(rpcCalls.length, 0);
  });
  it('ignores caller-supplied paid status and amount and verifies the server total', async () => {
    payment = null;
    const response = await handler(request('valid', {}, { action: 'status', bookingId: id, status: 'PAID', amount: 1 }));
    assert.equal((await response.json()).status, 'UNPAID');
    assert.equal(rpcCalls.length, 0);
  });
  it('only calls completion after retrieving a paid matching sandbox payment', async () => {
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'PAID');
    assert.deepEqual(rpcCalls, [{ name: 'complete_paymongo_test', args: {
      p_session: 'cs_test', p_payment: 'pay_test', p_amount: 60000, p_method: 'gcash',
    } }]);
    payment.amount = 1; rpcCalls = [];
    assert.equal((await handler(request())).status, 400);
    assert.equal(rpcCalls.length, 0);
  });
  it('rejects unsigned or forged webhook requests', async () => {
    assert.equal((await handler(request(null, { 'Paymongo-Signature': 'invalid' }))).status, 401);
    assert.equal(providerCalls, 0);
  });
  it('processes both supported signed checkout webhook payload formats', async () => {
    for (const body of [
      { data: { attributes: { type: 'checkout_session.payment.paid', data: { id: 'cs_test' } } } },
      { event_type: 'send.webhook', data: { type: 'checkout_session.payment.paid', data: { id: 'cs_test' } } },
    ]) {
      const timestamp = String(Math.floor(Date.now()/1000));
      const signature = createHmac('sha256','test-only').update(`${timestamp}.${JSON.stringify(body)}`).digest('hex');
      const response = await handler(request(null, { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` }, body));
      assert.equal(response.status,200);
    }
    assert.equal(rpcCalls.length,2);
  });
});
