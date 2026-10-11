import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110';
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const account = (role, id) => ({ id, email: `${role.toLowerCase()}@example.invalid`, app_metadata: { role }, user_metadata: { fullName: `${role} Test User` }, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' });
const adminUser = account('ADMIN', '11111111-1111-4111-8111-111111111111');
const passengerUser = account('PASSENGER', '22222222-2222-4222-8222-222222222222');
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated', app_metadata: user.app_metadata })}.fixture`, refresh_token: `fixture-${user.id}`, token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const errors = [], signins = [], logoutScopes = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route(`${projectUrl}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postDataJSON();
    if (url.pathname.endsWith('/token')) {
      signins.push(body.email);
      return route.fulfill({ json: session(body.email === adminUser.email ? adminUser : passengerUser) });
    }
    const token = request.headers().authorization?.replace(/^Bearer /, '');
    let user;
    try { user = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub === adminUser.id ? adminUser : passengerUser; }
    catch { return route.fulfill({ status: 401, json: { message: 'No fixture session' } }); }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
    if (url.pathname.endsWith('/logout')) { logoutScopes.push(url.searchParams.get('scope')); return route.fulfill({ status: 204 }); }
    assert.equal(url.pathname, '/rest/v1/rpc/barkolink_execute');
    const result = {
      MyProfile: { user: { uid: user.id, fullName: user.user_metadata.fullName, email: user.email, role: user.app_metadata.role } },
      MyNotifications: { notifications: [] }, MyBookings: { bookings: [] }, ActiveAdvisories: { advisories: [] },
      AdminOverview: { stats: {}, trips: [], monthly: [], bookingStatus: [], categories: [], routes: [] },
    }[body.operation];
    assert.ok(result, `Unexpected fixture operation: ${body.operation}`);
    return route.fulfill({ json: result });
  });
  const admin = await context.newPage(), staleForm = await context.newPage();
  await admin.goto(`${baseUrl}/login?redirect=/admin/inbox`);
  await staleForm.goto(`${baseUrl}/login`);
  await staleForm.locator('#email').fill(passengerUser.email);
  await staleForm.locator('#password').fill('Fixture-password123');
  await admin.locator('#email').fill(adminUser.email);
  await admin.locator('#password').fill('Fixture-password123');
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.waitForURL(url => url.pathname === '/admin/inbox');
  await admin.locator('.admin-account-trigger').waitFor();
  assert.equal(await admin.locator('.sidebar nav a[href="/admin/inbox"]').count(), 0);
  await staleForm.getByRole('button', { name: 'Sign in', exact: true }).click();
  await staleForm.getByRole('alert').filter({ hasText: 'already signed in' }).waitFor();
  assert.deepEqual(signins, [adminUser.email]);
  const newTab = await context.newPage();
  await newTab.goto(`${baseUrl}/login`);
  await newTab.waitForURL('**/admin');
  await newTab.locator('.admin-account-trigger').waitFor();
  await newTab.goto(`${baseUrl}/register`);
  await newTab.waitForURL('**/admin');
  await admin.reload();
  await admin.locator('.admin-account-trigger').waitFor();
  assert.match(await admin.locator('.admin-account-trigger').textContent(), /ADMIN Test User/);
  await admin.evaluate(async () => {
    const { requireAuth, signOut } = await import('/src/services/auth.ts');
    await signOut(requireAuth());
  });
  await admin.waitForURL('**/login');
  await newTab.waitForURL('**/login');
  assert.deepEqual(logoutScopes, ['local']);
  await staleForm.goto(`${baseUrl}/login?redirect=/bookings`);
  await staleForm.locator('#email').fill(passengerUser.email);
  await staleForm.locator('#password').fill('Fixture-password123');
  await staleForm.getByRole('button', { name: 'Sign in', exact: true }).click();
  await staleForm.waitForURL(url => url.pathname === '/bookings');
  assert.deepEqual(signins, [adminUser.email, passengerUser.email]);
  await staleForm.reload();
  await staleForm.locator('h1').waitFor();
  assert.equal(new URL(staleForm.url()).pathname, '/bookings');
  await staleForm.evaluate(async () => {
    const { requireAuth, signOut } = await import('/src/services/auth.ts');
    await signOut(requireAuth());
  });
  await staleForm.waitForURL(url => url.pathname === '/login');
  const attempt = (page, email) => page.evaluate(async email => {
    const { requireAuth, signInWithPassword } = await import('/src/services/auth.ts');
    try { return { uid: (await signInWithPassword(requireAuth(), email, 'Fixture-password123')).user.uid }; }
    catch (error) { return { code: error.code }; }
  }, email);
  const concurrent = await Promise.all([attempt(admin, adminUser.email), attempt(newTab, passengerUser.email)]);
  assert.equal(concurrent.filter(result => result.uid).length, 1);
  assert.equal(concurrent.filter(result => result.code === 'browser_already_signed_in').length, 1);
  assert.equal(signins.length, 3, 'Only one concurrent request reaches the provider');
  assert.deepEqual(errors, []);
  console.log('One browser account: stale and simultaneous second logins blocked, new tabs reuse admin, refresh preserves identity, shared logout clears other tabs, and passenger can sign in afterward.');
  await context.close();
} finally { await browser.close(); }
