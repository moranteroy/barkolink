import { createClient } from 'npm:@supabase/supabase-js@2';
import { testSecret, verifiedPayment, verifySignature } from './shared.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const key = testSecret(Deno.env.get('PAYMONGO_SECRET_KEY'));
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const api = async (path: string, method = 'GET', body?: object, idempotency?: string) => {
      const response = await fetch(`https://api.paymongo.com${path}`, {
        method, headers: { Authorization: `Basic ${btoa(`${key}:`)}`, 'Content-Type': 'application/json',
          ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
      });
      const json = await response.json();
      if (!response.ok) throw new Error('PayMongo could not process the sandbox request. Check the enabled payment methods and test key.');
      return json.data;
    };
    const check = async (row: any) => {
      const session = await api(`/v1/checkout_sessions/${encodeURIComponent(row.session_id)}`);
      if (session.id !== row.session_id) throw new Error('Checkout does not match.');
      const paid = verifiedPayment(session, row.amount);
      if (!paid) return { status: 'UNPAID', session };
      const { data, error } = await admin.rpc('complete_paymongo_test', {
        p_session: row.session_id, p_payment: paid.id, p_amount: row.amount, p_method: paid.method,
      });
      if (error) throw new Error(error.message);
      return { ...data, session };
    };
    const raw = await request.text();
    const signature = request.headers.get('Paymongo-Signature');
    if (signature) {
      const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
      if (!secret || !(await verifySignature(raw, signature, secret))) return reply(401, { error: 'Invalid webhook signature.' });
      const event = JSON.parse(raw).data;
      const eventType = event?.attributes?.type || event?.type;
      if (eventType !== 'checkout_session.payment.paid') return reply(200, { received: true });
      const sessionId = (event?.attributes?.data || event?.data)?.id;
      const { data: row, error } = await admin.from('online_payment').select('*').eq('session_id', sessionId).maybeSingle();
      if (error) return reply(500, { error: 'Could not load payment. Retry delivery.' });
      // Creation can race a webhook. A retry is safer than acknowledging an unrecorded session.
      if (!row) return reply(503, { error: 'Checkout is not recorded yet. Retry delivery.' });
      await check(row);
      return reply(200, { received: true });
    }
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply(401, { error: 'Sign in first.' });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'Your session expired. Sign in again.' });
    const { action, bookingId } = JSON.parse(raw);
    if (!['checkout','status','close'].includes(action) || typeof bookingId !== 'string' || !/^[a-f0-9-]{36}$/i.test(bookingId))
      return reply(400, { error: 'Invalid payment request.' });
    const { data: booking, error: bookingError } = await admin.from('booking').select('id,owner_uid,payment_status').eq('id', bookingId).maybeSingle();
    if (bookingError || !booking || booking.owner_uid !== user.id) return reply(404, { error: 'Booking was not found.' });
    if (action === 'checkout') {
      const origin = Deno.env.get('PAYMONGO_RETURN_ORIGIN');
      if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Set the website return URL before using sandbox checkout.');
      const { data: row, error } = await admin.rpc('prepare_paymongo_test', { p_booking: bookingId, p_owner: user.id });
      if (error) throw new Error(error.message);
      if (row.session_id) {
        const result = await check(row);
        if (result.status !== 'UNPAID') return reply(200, { status: result.status });
        if (result.session.attributes.status === 'expired') throw new Error('Checkout has closed. Choose cash or create a new reservation.');
        return reply(200, { checkoutUrl: row.checkout_url, testMode: true });
      }
      const returnUrl = new URL('/bookings', origin);
      returnUrl.searchParams.set('reference', row.reference);
      returnUrl.searchParams.set('payment', 'returned');
      const cancelUrl = new URL(returnUrl); cancelUrl.searchParams.set('payment', 'cancelled');
      const session = await api('/v2/checkout_sessions', 'POST', { data: { attributes: {
        line_items: [{ name: `BarkoLink ${row.reference}`, amount: row.amount, currency: 'PHP', quantity: 1 }],
        payment_method_types: ['gcash','paymaya','card'], reference_number: row.reference,
        description: 'Ferry booking payment. Your e-ticket will be available after payment is confirmed.',
        success_url: returnUrl.href, cancel_url: cancelUrl.href,
        show_line_items: true, show_description: true, send_email_receipt: false,
      } } }, `barkolink-test-${row.id}`);
      if (session.attributes?.livemode !== false) throw new Error('Live checkout is disabled.');
      const checkoutUrl = new URL(session.attributes.checkout_url);
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.paymongo.com') throw new Error('Invalid checkout URL.');
      const { error: saveError } = await admin.from('online_payment').update({ session_id: session.id, checkout_url: checkoutUrl.href }).eq('id', row.id);
      if (saveError) throw new Error('Checkout could not be saved. Retry the same booking.');
      return reply(200, { checkoutUrl: checkoutUrl.href, testMode: true });
    }
    const { data: row, error } = await admin.from('online_payment').select('*').eq('booking_id', bookingId).maybeSingle();
    if (error) throw new Error('Could not load payment.');
    if (!row) return reply(200, { status: booking.payment_status });
    // A lost create response can be recovered using the same idempotent checkout request.
    if (!row.session_id) throw new Error('Checkout setup is incomplete. Press Pay online again to recover it before switching to cash.');
    const result = await check(row);
    if (action === 'close' && result.status === 'UNPAID') {
      if (result.session.attributes.status !== 'expired') await api(`/v1/checkout_sessions/${encodeURIComponent(row.session_id)}/expire`, 'POST');
      // Re-read after expiration to catch a payment completed during the close request.
      const final = await check(row);
      if (final.status !== 'UNPAID') return reply(200, { status: final.status });
      const { error: closeError } = await admin.from('online_payment').update({ status: 'CLOSED' }).eq('id', row.id).eq('status','OPEN');
      if (closeError) throw new Error('Could not close checkout. Retry before paying cash.');
      return reply(200, { status: 'CLOSED' });
    }
    return reply(200, { status: result.status });
  } catch (error) {
    return reply(400, { error: error instanceof Error ? error.message : 'Payment request failed.' });
  }
});
