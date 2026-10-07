import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Uses a temporary account, sailing and bookings; never resets existing records.
export async function runSandboxTest({ admin, sql, origin, frontend }) {
  const keys = await admin('/api-keys');
  const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
  if (!serviceKey) throw new Error('Service credentials are unavailable for the isolated sandbox test.');
  const service = createClient(origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const client = createClient(origin, frontend.VITE_SUPABASE_PUBLISHABLE_KEY || frontend.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tag = `PM-${Date.now()}`, sailing = `TEST-${tag}`, email = `${tag.toLowerCase()}@example.invalid`;
  const password = randomBytes(24).toString('hex');
  let uid, staffUid, browser;
  const literal = text => `'${text.replaceAll("'", "''")}'`;
  const invoke = async (action, bookingId) => {
    const { data, error } = await client.functions.invoke('paymongo', { body: { action, bookingId } });
    if (error) {
      const detail = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
      throw new Error(detail?.error || error.message);
    }
    return data;
  };
  try {
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { fullName: '[TEST] Sandbox Payment' }, app_metadata: { role: 'PASSENGER' } });
    if (created.error) throw new Error('Could not create the isolated test account.');
    uid = created.data.user.id;
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error('Could not sign in the isolated test account.');
    await sql(`insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
      select ${literal(sailing)},a.id,b.id,v.id,'2099-10-07T08:00:00Z','2099-10-07T09:30:00Z',90,100,80,80,50,80,100,2
      from public.port a cross join public.port b cross join public.vessel v
      where a.id<>b.id and a.is_active and b.is_active and v.is_active
      and not exists(select 1 from public.sailing s where s.vessel_id=v.id and s.departure_at<'2099-10-07T09:30:00Z' and s.arrival_at>'2099-10-07T08:00:00Z') limit 1;`, false);
    const { data: trip } = await service.from('sailing').select('vessel_id').eq('code', sailing).single();
    if (!trip) throw new Error('No vessel is available for the isolated test sailing.');
    const { data: accommodation } = await service.from('accommodation').select('id').eq('vessel_id',trip.vessel_id).eq('is_active',true).order('surcharge').limit(1);
    const reserved = await client.rpc('barkolink_execute', { operation: 'ReserveSailing1', args: {
      reference: `TEST-${tag}-PAID`, sailingCode: sailing, passenger1Name: '[TEST] Sandbox Passenger', passenger1Type: 'REGULAR',
      accommodationId: accommodation?.[0]?.id,
    } });
    if (reserved.error) throw new Error(reserved.error.message);
    const { data: mine, error } = await client.rpc('barkolink_execute', { operation: 'MyBookings', args: {} });
    if (error) throw new Error(error.message);
    const booking = mine.bookings[0];
    const checkout = await invoke('checkout', booking.id);
    assert.equal(checkout.testMode, true);
    assert.equal(new URL(checkout.checkoutUrl).hostname, 'checkout.paymongo.com');
    const retry = await invoke('checkout', booking.id);
    assert.equal(retry.checkoutUrl, checkout.checkoutUrl);
    assert.equal((await invoke('status', booking.id)).status, 'UNPAID');
    console.log('Authenticated checkout, retry reuse and unpaid verification: passed.');

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(({ session, storageKey }) => {
      if (location.origin === 'http://localhost:8100') {
        localStorage.setItem(storageKey, JSON.stringify(session));
        localStorage.setItem('barkolink-theme', 'light');
      }
    }, { session: signed.data.session, storageKey: `sb-${new URL(origin).hostname.split('.')[0]}-auth-token` });
    // Prove webhook completion independently of the website's status fallback.
    await context.route(`${origin}/functions/v1/paymongo`, route => route.fulfill({ json: { status: 'UNPAID' } }));
    const page = await context.newPage();
    await page.goto(checkout.checkoutUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('button', { name: /E-Wallets/ }).click();
    await page.getByText('GCash', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="name"]').fill('Sandbox Test Passenger');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="mobile_phone"]').fill('9171234567');
    await page.getByRole('button', { name: /^Pay / }).click();
    await page.waitForTimeout(2000);
    fs.mkdirSync('.audit/paymongo', { recursive: true });
    await page.screenshot({ path: '.audit/paymongo/checkout.png', fullPage: true });
    await page.getByRole('button', { name: 'Authorize Test Payment', exact: true }).waitFor();
    assert.ok(['test-sources.paymongo.com','secure-authentication.paymongo.com'].includes(new URL(page.url()).hostname));
    await page.getByRole('button', { name: 'Authorize Test Payment', exact: true }).click();
    let paidBooking;
    for (let attempt = 0; attempt < 30; attempt++) {
      const { data } = await service.from('booking').select('payment_status,payment_method,status').eq('id',booking.id).single();
      if (data?.payment_status === 'PAID') { paidBooking = data; break; }
      await new Promise(resolve => setTimeout(resolve,500));
    }
    assert.ok(paidBooking, 'The real PayMongo test webhook must mark the booking paid.');
    assert.equal(paidBooking.payment_method,'PAYMONGO_TEST');
    assert.equal(paidBooking.status,'CONFIRMED');
    const { data: passengers } = await service.from('booking_passenger').select('ticket_status,ticket_code').eq('booking_id',booking.id);
    assert.equal(passengers[0].ticket_status,'PENDING');
    const forbidden = await client.rpc('verify_online_payment',{p_booking:booking.id});
    assert.ok(forbidden.error,'Passengers cannot approve their own payment.');
    await page.goto(`http://localhost:8100/ticket?reference=${encodeURIComponent(booking.reference)}`, { waitUntil: 'networkidle' });
    if(new URL(page.url()).pathname==='/login'){
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('.submit-button').click();
      await page.waitForURL('**/ticket?reference=**',{timeout:30000});
    }
    await page.getByRole('heading',{name:'Awaiting staff verification',exact:true}).waitFor();
    assert.equal(await page.locator('.qr-block').count(),0);
    await page.screenshot({path:'.audit/paymongo/awaiting-staff.png',fullPage:true});
    const staffEmail=`staff-${tag.toLowerCase()}@example.invalid`;
    const staffCreated=await service.auth.admin.createUser({email:staffEmail,password,email_confirm:true,user_metadata:{fullName:'[TEST] Ticketing Staff'},app_metadata:{role:'TICKETING'}});
    if(staffCreated.error)throw new Error('Could not create isolated staff account.');
    staffUid=staffCreated.data.user.id;
    const staffClient=createClient(origin,frontend.VITE_SUPABASE_PUBLISHABLE_KEY || frontend.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const staffSigned=await staffClient.auth.signInWithPassword({email:staffEmail,password});
    if(staffSigned.error)throw new Error('Could not sign in isolated staff account.');
    const approved=await staffClient.rpc('verify_online_payment',{p_booking:booking.id});
    if(approved.error)throw new Error(approved.error.message);
    const repeat=await staffClient.rpc('verify_online_payment',{p_booking:booking.id});
    assert.equal(repeat.error,null);
    const verified=(await service.from('booking').select('payment_verified_by,payment_verified_at').eq('id',booking.id).single()).data;
    assert.equal(verified.payment_verified_by,staffUid);
    assert.ok(verified.payment_verified_at);
    console.log('Provider payment received, passenger approval blocked, ticket withheld and staff verification: passed.');
    await context.unroute(`${origin}/functions/v1/paymongo`);
    await page.goto(`http://localhost:8100/ticket?reference=${encodeURIComponent(booking.reference)}`, { waitUntil: 'networkidle' });
    await page.locator('.ticket-head > b').filter({ hasText: 'PAID' }).waitFor();
    await page.screenshot({ path: '.audit/paymongo/paid-ticket.png', fullPage: true });
    assert.equal((await invoke('status',booking.id)).status,'PAID');
    const { data: logs } = await service.from('activity_log').select('id').eq('entity_id',booking.reference).eq('action','PAYMONGO_TEST_PAID');
    assert.equal(logs.length,1);
    console.log('Local e-ticket rendering and idempotent payment confirmation: passed.');
    const failedReservation = await client.rpc('barkolink_execute', { operation: 'ReserveSailing1', args: {
      reference: `TEST-${tag}-FAILED`, sailingCode: sailing, passenger1Name: '[TEST] Failed Payment Passenger', passenger1Type: 'REGULAR',
      accommodationId: accommodation?.[0]?.id,
    } });
    if (failedReservation.error) throw new Error(failedReservation.error.message);
    const { data: failedBooking } = await service.from('booking').select('id').eq('reference',`TEST-${tag}-FAILED`).single();
    const failedCheckout = await invoke('checkout',failedBooking.id);
    await page.goto(failedCheckout.checkoutUrl,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/E-Wallets/}).click();
    await page.getByText('GCash',{exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('input[name="name"]').fill('Sandbox Failed Payment');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="mobile_phone"]').fill('9171234567');
    await page.getByRole('button',{name:/^Pay /}).click();
    await page.getByRole('button',{name:'Expire/Fail Test Payment',exact:true}).click();
    assert.equal((await invoke('status',failedBooking.id)).status,'UNPAID');
    assert.equal((await invoke('close',failedBooking.id)).status,'CLOSED');
    const { data: failedPassenger } = await service.from('booking_passenger').select('ticket_status').eq('booking_id',failedBooking.id).single();
    assert.equal(failedPassenger.ticket_status,'PENDING');
    await assert.rejects(invoke('checkout',failedBooking.id),/checkout is closed/);
    console.log('Failed GCash payment stays unpaid, issues no ticket and can close for cash: passed.');
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({ path: '.audit/paymongo/last-step.png', fullPage: true }).catch(() => {});
      console.log(JSON.stringify({ stepButtons: await page.getByRole('button').allTextContents(), stepInputs: await page.locator('input').evaluateAll(inputs => inputs.map(i => ({ name: i.name, placeholder: i.placeholder }))) }));
    }
    throw error;
  } finally {
    await browser?.close();
    if (uid) {
      const { data: rows } = await service.from('online_payment').select('session_id').in('booking_id',
        (await service.from('booking').select('id').eq('owner_uid', uid)).data?.map(b => b.id) || []);
      for (const row of rows || []) if (row.session_id) {
        // Expire synthetic sessions before removing their temporary booking records.
        const { data: b } = await service.from('online_payment').select('booking_id').eq('session_id', row.session_id).single();
        if (b) await invoke('close', b.booking_id).catch(() => {});
      }
      await sql(`begin;
        delete from public.online_payment where booking_id in(select id from public.booking where owner_uid=${literal(uid)});
        delete from public.booking_passenger where booking_id in(select id from public.booking where owner_uid=${literal(uid)});
        delete from public.notification where owner_uid=${literal(uid)};
        delete from public.activity_log where actor_uid=${literal(uid)} or entity_id like ${literal(`TEST-${tag}%`)};
        delete from public.booking where owner_uid=${literal(uid)};
        delete from public.sailing where code=${literal(sailing)};
        delete from public.app_user where uid=${literal(uid)};
        commit;`, false);
      const removed = await service.auth.admin.deleteUser(uid);
      if (removed.error) throw new Error('Temporary auth account cleanup failed.');
      console.log('Temporary test data cleaned up.');
    }
    if(staffUid){
      await sql(`delete from public.app_user where uid=${literal(staffUid)}`,false);
      const removed=await service.auth.admin.deleteUser(staffUid);
      if(removed.error)throw new Error('Temporary staff account cleanup failed.');
    }
  }
}
