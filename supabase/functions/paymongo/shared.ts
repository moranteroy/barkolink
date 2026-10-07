export function testSecret(value: string | undefined): string {
  if (!value?.startsWith('sk_test_')) throw new Error('PayMongo sandbox is not configured. Ask the administrator to set a Secret Test Key.');
  return value;
}

export function verifiedPayment(session: any, amount: number) {
  if (session?.type !== 'checkout_session' || session.attributes?.livemode !== false)
    throw new Error('Only sandbox checkout sessions are accepted.');
  const payments = session.attributes.payments || [];
  const paid = payments.filter((p: any) => p.attributes?.status === 'paid');
  if (!paid.length) return null;
  if (paid.length !== 1) throw new Error('Multiple payments require administrator review.');
  const payment = paid[0];
  if (payment.attributes.livemode !== false || payment.attributes.currency !== 'PHP' || payment.attributes.amount !== amount)
    throw new Error('Payment currency, amount, or mode does not match.');
  return { id: payment.id, method: payment.attributes.source?.type || 'unknown' };
}

export async function verifySignature(raw: string, header: string, secret: string, now = Date.now()) {
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=')));
  if (!/^\d+$/.test(parts.t || '') || Math.abs(now / 1000 - Number(parts.t)) > 300 || !/^[a-f0-9]{64}$/.test(parts.te || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${raw}`));
  const expected = Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ parts.te.charCodeAt(i);
  return difference === 0;
}
