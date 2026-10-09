import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

// Intercept all hosted requests: no real staff accounts or port assignments are changed.
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, '');
const projectRef = new URL(projectUrl).hostname.split('.')[0];
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['TICKETING', 'BOARDING']) for (const width of (process.env.BARKOLINK_UI_WIDTHS?.split(',').map(Number) || [1240, 390])) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const id = '11111111-1111-4111-8111-111111111111';
    const user = { id, email: 'staff@example.invalid', app_metadata: { role }, user_metadata: { fullName: 'Test Staff' }, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
    const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: id, exp, role: 'authenticated', app_metadata: { role } })}.test`, refresh_token: 'ui-test', token_type: 'bearer', expires_at: exp, expires_in: 3600, user };
    await context.addInitScript(({ key, session }) => { localStorage.setItem('barkolink-theme', 'dark'); localStorage.setItem(key, JSON.stringify(session)); }, { key: `sb-${projectRef}-auth-token`, session });
    let assigned = false, profileReads = 0, terminalReads = 0;
    const forbidden = [], errors = [];
    await context.route(`${projectUrl}/**`, async route => {
      if (route.request().url().includes('/auth/v1/')) return route.fulfill({ json: user });
      if (!route.request().url().includes('/rpc/barkolink_execute')) return route.fulfill({ json: { configured: false } });
      const { operation } = route.request().postDataJSON();
      if (operation === 'MyProfile') {
        profileReads++;
        return route.fulfill({ json: { user: { uid: id, fullName: 'Test Staff', email: user.email, role, assignedPortId: assigned ? 'calapan' : null, assignedPort: assigned ? { id: 'calapan', name: 'Calapan Port', isActive: true } : null } } });
      }
      if (operation === 'MyNotifications') return route.fulfill({ json: { notifications: [] } });
      if (/^(Staff|Ticketing|Boarding)/.test(operation)) {
        terminalReads++;
        if (!assigned) { forbidden.push(operation); return route.fulfill({ status: 403, json: { code: '42501', message: 'No active port is assigned to your staff account.' } }); }
      }
      const fixtures = { StaffDashboard: { bookings: 0, paid: 0, unpaid: 0, trips: 0 }, StaffBookings: { bookings: [], totalCount: 0 }, BoardingSailings: { sailings: [] }, TicketingSailings: { sailings: [] }, StaffSailings: { sailings: [], totalCount: 0 }, StaffPassengers: { passengers: [], totalCount: 0 }, StaffFares: { fares: [] }, ActiveAdvisories: { advisories: [] } };
      assert.ok(operation in fixtures, `Unhandled operation: ${operation}`);
      return route.fulfill({ json: fixtures[operation] });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if (response.status() === 403) errors.push(`403: ${response.url()}`); });
    const root = `/staff/${role.toLowerCase()}`;
    await page.goto(baseUrl + root);
    await page.getByRole('heading', { name: 'Port assignment needed' }).waitFor();
    await page.locator('ion-toast').waitFor({ state: 'attached' });
    assert.match(await page.locator('ion-toast').evaluate(el => el.message), /Ask your administrator/);
    assert.equal(await page.getByText('Access was denied', { exact: false }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'New walk-in ticket' }).count(), 0);
    if (width === 1240) {
      // Cover a complete queue refresh interval: only the permitted profile read may recur.
      await page.waitForTimeout(16500);
      assert.ok(profileReads >= 2, `${role}: polling checks assignment`);
    }
    const sections = role === 'TICKETING' ? ['bookings', 'walk-in', 'passengers', 'trips', 'fares'] : ['check-in', 'boarding', 'manifest', 'trips', 'no-shows'];
    for (const section of sections) {
      await page.goto(baseUrl + root + '/' + section);
      await page.getByRole('heading', { name: 'Port assignment needed' }).waitFor();
      assert.equal(await page.locator('main').first().evaluate(el => el.scrollWidth > el.clientWidth + 2), false, `${role}/${section} ${width}: overflow`);
    }
    assert.deepEqual(forbidden, [], `${role}: unassigned requests blocked before network`);
    assert.equal(terminalReads, 0);
    await page.goto(baseUrl + root);
    await page.getByRole('heading', { name: 'Port assignment needed' }).waitFor();
    await page.waitForTimeout(400); // Finish the toast entrance animation before capturing its appearance.
    const toastBox = await page.locator('ion-toast').evaluate(el => {
      const box = el.shadowRoot.querySelector('[part="wrapper"]').getBoundingClientRect();
      return { top: box.top, right: box.right, left: box.left, width: box.width };
    });
    const headerBox = await page.locator('.staff-workspace-header').boundingBox();
    assert.ok(toastBox.top >= headerBox.y + headerBox.height, `${role}: toast below workspace header`);
    assert.ok(toastBox.width <= 421 && toastBox.left >= 0 && toastBox.right <= width, `${role}: compact toast within screen ${JSON.stringify(toastBox)}`);
    fs.mkdirSync('docs/screenshots/experience', { recursive: true });
    await page.screenshot({ path: `docs/screenshots/experience/${role.toLowerCase()}-${width}-port-required.png` });
    await page.getByRole('button', { name: 'Dismiss port notice', exact: true }).click();
    await page.getByRole('button', { name: 'Dismiss port notice', exact: true }).waitFor({ state: 'hidden' });
    assigned = true;
    await page.getByRole('button', { name: 'Check assignment', exact: true }).click();
    await page.getByRole('heading', { name: 'Port assignment needed' }).waitFor({ state: 'detached' });
    await page.getByText('Calapan Port', { exact: true }).waitFor();
    await page.waitForTimeout(500);
    assert.ok(terminalReads > 0, `${role}: assignment resumes queue`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${role} ${width}px: notice, toast, no forbidden calls, assignment resumes`);
    await context.close();
  }
} finally { await browser.close(); }
