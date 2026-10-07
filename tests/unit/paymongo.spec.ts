import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSecret, verifiedPayment, verifySignature } from '../../supabase/functions/paymongo/shared';
import { webcrypto } from 'node:crypto';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

const session = (overrides = {}) => ({ type: 'checkout_session', attributes: { livemode: false,
  payments: [{ id: 'pay_test', attributes: { status: 'paid', livemode: false, currency: 'PHP', amount: 60000, source: { type: 'gcash' }, ...overrides } }] } });
describe('PayMongo sandbox verification', () => {
  it('rejects missing and live API keys', () => {
    expect(() => testSecret(undefined)).toThrow('not configured');
    expect(() => testSecret('sk_live_example')).toThrow('not configured');
    expect(testSecret('sk_test_example')).toBe('sk_test_example');
  });
  it('only accepts paid PHP test payments matching the server total', () => {
    expect(verifiedPayment(session(), 60000)).toEqual({ id: 'pay_test', method: 'gcash' });
    expect(verifiedPayment(session({ status: 'failed' }), 60000)).toBeNull();
    for (const overrides of [{ livemode: true }, { currency: 'USD' }, { amount: 1 }])
      expect(() => verifiedPayment(session(overrides), 60000)).toThrow('does not match');
    expect(() => verifiedPayment({ ...session(), attributes: { livemode: true } }, 60000)).toThrow('Only sandbox');
  });
  it('verifies timestamped raw payload signatures and rejects tampering, live signatures and stale events', async () => {
    const raw = '{"data":{"id":"evt_test"}}', secret = 'whsec_test', now = 1800000000000;
    const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`1800000000.${raw}`));
    const hex = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
    const header = `t=1800000000,te=${hex},li=`;
    expect(await verifySignature(raw, header, secret, now)).toBe(true);
    expect(await verifySignature(raw + ' ', header, secret, now)).toBe(false);
    expect(await verifySignature(raw, header, secret, now + 301000)).toBe(false);
    expect(await verifySignature(raw, `t=1800000000,te=,li=${hex}`, secret, now)).toBe(false);
  });
});
