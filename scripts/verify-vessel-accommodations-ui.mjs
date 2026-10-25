import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = path.resolve('dist');
const server = http.createServer((request, response) => {
  const candidate = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!candidate.startsWith(root + path.sep)) return response.writeHead(404).end();
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const project = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, '');
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, email: 'accommodation@example.invalid', app_metadata: { role: 'ADMIN' }, user_metadata: { fullName: 'Class Admin' }, aud: 'authenticated' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: uid, exp, role: 'authenticated', aal: 'aal2', app_metadata: user.app_metadata })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_at: exp, expires_in: 3600, user };
const vessels = [['Annapolis', 712], ['Jupiter', 307], ['Pacific', 350], ['Saga', 300], ['Sprint 1', 182], ['SWM Stella del Mar', 977]].map(([name, passengerCapacity], index) => ({ id: `v${index}`, name: `MV ${name.startsWith('SWM') ? name : 'Starlite ' + name}`, passengerCapacity, isActive: true }));
fs.mkdirSync('.audit/vessel-accommodations', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const theme of ['light', 'dark']) for (const width of [1440, 768, 700, 699, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.addInitScript(({ project, session, theme }) => {
      localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
      localStorage.setItem('barkolink-theme', theme);
    }, { project, session, theme });
    const classes = vessels.flatMap(vessel => {
      const tourist = Math.floor(vessel.passengerCapacity * .2), business = Math.floor(vessel.passengerCapacity * .1);
      return [['Economy', vessel.passengerCapacity - tourist - business], ['Tourist Class', tourist], ['Business Class', business]].map(([name, capacity], index) => ({ id: `${vessel.id}-${index}`, vesselId: vessel.id, vesselName: vessel.name, name, capacity, description: 'Editable vessel seating.', surcharge: 0, isActive: true }));
    });
    let saved;
    await context.route(`${project}/**`, async route => {
      const url = route.request().url();
      if (url.includes('/auth/')) return route.fulfill({ json: user });
      if (url.endsWith('/my_mfa_settings')) return route.fulfill({ json: { role: 'ADMIN', enabled: false, staffRequired: false, policyRequired: false, mfaRequired: false } });
      const { operation, args } = route.request().postDataJSON();
      if (operation === 'AdminSaveAccommodation') {
        saved = args;
        const item = classes.find(item => item.id === args.id);
        assert.ok(item); assert.equal(item.vesselId, args.vesselId);
        Object.assign(item, args);
        return route.fulfill({ json: { id: item.id } });
      }
      assert.ok(!/Create|Update|Save|Delete|Reserve|Pay/.test(operation || ''), `Unexpected fixture write: ${operation}`);
      const data = {
        MyProfile: { user: { uid, fullName: 'Class Admin', email: user.email, role: 'ADMIN' } },
        AdminVessels: { vessels }, AdminAccommodations: { accommodations: classes },
        AdminSailings: { sailings: [], totalCount: 0 }, AdminSailingOptions: { sailings: [] }, AdminPorts: { ports: [] }, AdminRoutes: { routes: [] },
        MyNotifications: { notifications: [] }, AdminFareSettings: { vesselFareSettings: [] },
      }[operation] || {};
      return route.fulfill({ json: data });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl + '/admin/accommodation');
    await page.getByRole('heading', { name: 'Accommodations by vessel', exact: true }).waitFor();
    assert.equal(await page.locator('.vessel-class-card').count(), 6);
    assert.equal(await page.locator('.vessel-class-edit').count(), 18);
    assert.match(await page.locator('.vessel-class-card').first().innerText(), /712 \/ 712/);
    await page.locator('.accommodation-workspace').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.audit/vessel-accommodations/cards-${width}-${theme}.png`, fullPage: true });
    await page.locator('#accommodation-vessel').selectOption('v4');
    assert.equal(await page.locator('.vessel-class-card').count(), 1);
    await page.getByRole('button', { name: 'Edit Business Class for MV Starlite Sprint 1', exact: true }).click();
    const modal = page.locator('ion-modal.accommodation-modal');
    await modal.getByRole('heading', { name: 'Edit accommodation', exact: true }).waitFor();
    assert.equal(await modal.locator('#accommodation-form-vessel').inputValue(), 'v4');
    assert.equal(await modal.locator('#accommodation-class-name').inputValue(), 'Business Class');
    await modal.getByLabel('Class capacity', { exact: true }).fill('19');
    await modal.getByRole('button', { name: 'Save accommodation', exact: true }).click();
    assert.equal(await modal.getByLabel('Class capacity', { exact: true }).evaluate(input => input.validity.rangeOverflow), true, 'Native form validation must reject seats above the available capacity');
    assert.equal(saved, undefined);
    await modal.getByLabel('Class capacity', { exact: true }).fill('17');
    await modal.getByRole('button', { name: 'Save accommodation', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(saved.id, 'v4-2'); assert.equal(saved.capacity, 17);
    assert.equal(classes.find(item => item.id === 'v0-2').capacity, 71);
    await page.locator('.vessel-class-card').filter({ hasText: 'MV Starlite Sprint 1' }).getByText('17 seats · PHP 0 extra', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    assert.equal(await page.locator('.vessel-class-card').count(), 6);
    await page.getByText('View detailed class directory', { exact: true }).click();
    await page.locator('.records-grid').waitFor();
    assert.deepEqual(errors, []);
    console.log(`Vessel classes, filters and edit validation passed: ${width}px ${theme}`);
    await context.close();
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
