import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { boardingTimingFixture } from './boarding-timing-fixture.mjs';

async function main() {
// Isolated read fixtures only. Every backend request is intercepted.
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
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const origin = { id: 'cal', name: 'Calapan Port', city: 'Calapan', isActive: true };
const destination = { id: 'btg', name: 'Batangas Port', city: 'Batangas', isActive: true };
const sailing = { code: 'UI-TRIP', departureAt: '2099-01-01T08:00:00Z', arrivalAt: '2099-01-01T10:00:00Z', durationMinutes: 120, status: 'SCHEDULED', availableSeats: 98, regularFare: 600, studentFare: 480, seniorFare: 480, pwdFare: 480, childFare: 300, pregnantFare: 600, origin, destination, vessel: { id: 'vessel', name: 'MV Starlite Annapolis', passengerCapacity: 712, isActive: true } };
const passenger = { id: uid, fullName: 'UI Traveler', passengerType: 'REGULAR', fare: 600, ticketCode: uid, ticketStatus: 'ISSUED', checkedInAt: null, boardedAt: null, noShow: false };
const booking = { id: uid, reference: 'UI-BOOKING', owner: { fullName: 'UI User', email: 'ui@example.invalid' }, createdAt: new Date().toISOString(), status: 'CONFIRMED', paymentStatus: 'PAID', total: 600, passengerCount: 1, sailing, bookingPassengers_on_booking: [passenger] };
const vessels = ['MV Starlite Annapolis', 'MV Starlite Jupiter', 'MV Starlite Pacific', 'MV Starlite Saga', 'MV Starlite Sprint 1', 'MV SWM Stella del Mar'].map((name, index) => ({ ...sailing.vessel, id: `vessel-${index}`, name, operator: 'Starlite Ferries', position: index === 3 ? { state: 'UNDERWAY', originPortId: 'cal', destinationPortId: 'btg', arrivalAt: sailing.arrivalAt } : { state: 'EXPECTED', portName: index % 2 ? 'Batangas Port' : 'Calapan Port', tripCode: `TRIP-${index}` } }));
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
fs.mkdirSync('.audit/tracking-refresh', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const theme of ['light', 'dark']) for (const width of [1366, 768, 390]) for (const role of ['ADMIN', 'PASSENGER', 'TICKETING', 'BOARDING']) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    const user = { id: uid, email: 'ui@example.invalid', app_metadata: { role }, user_metadata: { fullName: 'UI User' }, aud: 'authenticated' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: uid, exp, role: 'authenticated', aal: 'aal2', app_metadata: { role } })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_at: exp, expires_in: 3600, user };
    await context.addInitScript(({ project, session, theme }) => {
      localStorage.setItem(`sb-${new URL(project).hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
      localStorage.setItem('barkolink-theme', theme);
    }, { project, session, theme });
    const calls = {};
    let failTracking = false;
    await context.route(`${project}/**`, async route => {
      const url = route.request().url();
      if (url.includes('/auth/')) return route.fulfill({ json: user });
      if (url.endsWith('/my_mfa_settings')) return route.fulfill({ json: { role, enabled: false, staffRequired: false, policyRequired: false, mfaRequired: false } });
      if (url.includes('/functions/v1/weather')) return route.fulfill({ json: { configured: false, ports: [] } });
      const { operation } = route.request().postDataJSON();
      assert.ok(operation && !/Save|Create|Update|Delete|Reserve|Confirm/.test(operation), `Unexpected fixture operation: ${operation}`);
      calls[operation] = (calls[operation] || 0) + 1;
      if (operation === 'AdminVesselPositions' && failTracking) return route.fulfill({ status: 503, json: { message: 'Fixture update unavailable' } });
      const data = {
        MyProfile: { user: { uid, fullName: 'UI User', email: user.email, role, assignedPortId: origin.id, assignedPort: origin } },
        MyNotifications: { notifications: [] }, MyBookings: { bookings: [] }, MySavedTravelers: { travelers: [] },
        MyLoyalty: { completedTrips: 0, tripsToNextReward: 5, tripsPerReward: 5, rewardValue: 100, tiers: [{ name: 'Bronze', trips: 5, value: 100 }], vouchers: [] },
        ActiveAdvisories: { advisories: [] }, ActiveTravelAdvisories: { advisories: [] },
        BrowseActivePorts: { ports: [origin, destination] }, BrowseSailings: { sailings: [], totalCount: 0 },
        PassengerSailingBoard: { date: today, updatedAt: new Date().toISOString(), sailings: [{ ...sailing, departureAt: `${today}T12:00:00+08:00`, arrivalAt: `${today}T14:00:00+08:00` }] },
        AdminVessels: { vessels }, AdminVesselPositions: { vessels, ports: [origin, destination] },
        AdminSailings: { sailings: [sailing], totalCount: 1 }, AdminSailingOptions: { sailings: [sailing] },
        AdminOverview: { stats: { todayTrips: 1, todayBookings: 1, todayPassengers: 1, utilization: 1 }, monthly: [], trips: [], bookingStatus: [], categories: [], routes: [] },
        StaffDashboard: { bookings: 1, paid: 1, unpaid: 0, trips: 1 }, StaffBookings: { bookings: [booking], totalCount: 1 }, TicketingSailings: { sailings: [sailing] },
        BoardingSailings: { sailings: [sailing] }, BoardingManifest: { bookings: [booking] }, BoardingActivity: { boardingEvents: [] }, BoardingSailingTiming: boardingTimingFixture(sailing),
      }[operation];
      assert.notEqual(data, undefined, `Missing fixture: ${operation}`);
      return route.fulfill({ json: data });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    const target = role === 'ADMIN' ? '/admin/vessels' : role === 'PASSENGER' ? '/home' : `/staff/${role.toLowerCase()}`;
    await page.goto(baseUrl + target);
    if (role === 'ADMIN') {
      const tracking = page.locator('.tracking-panel');
      await tracking.getByRole('heading', { name: 'Vessel locations', exact: true }).waitFor();
      await tracking.locator('.location-list article').first().waitFor();
      assert.equal(await tracking.getByRole('button', { name: 'Refresh', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Refresh', exact: true }).count(), 1);
      assert.equal(await tracking.locator('.tracking-sync').count(), 0);
      await tracking.getByRole('button', { name: 'Next', exact: true }).click();
      assert.match(await tracking.locator('.tracking-pagination').innerText(), /6-6 of 6/);
      await tracking.getByRole('button', { name: 'Previous', exact: true }).click();
      await tracking.getByRole('searchbox', { name: 'Find vessel', exact: true }).fill('Saga');
      assert.equal(await tracking.locator('.location-list article').count(), 1);
      await tracking.getByRole('searchbox', { name: 'Find vessel', exact: true }).fill('');
      const before = calls.AdminVesselPositions;
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.tracking-panel[aria-busy="true"]'));
      assert.ok(calls.AdminVesselPositions > before, 'The page Refresh still reloads tracking');
      await tracking.scrollIntoViewIfNeeded();
      await tracking.screenshot({ path: `.audit/tracking-refresh/tracking-${width}-${theme}.png` });
      failTracking = true;
      await page.clock.fastForward(30000);
      await tracking.getByRole('alert').waitFor();
      assert.equal(await tracking.locator('.location-list article').count(), 5, 'Failed polling retains the last locations');
      failTracking = false;
      await page.clock.fastForward(30000);
      await tracking.getByRole('alert').waitFor({ state: 'hidden' });
      await page.goto(baseUrl + '/admin');
      await page.locator('.overview-context').waitFor();
      assert.doesNotMatch(await page.locator('.overview-context').innerText(), /Updated/);
    } else if (role === 'PASSENGER') {
      const board = page.locator('.sailing-board');
      await board.locator('article').first().waitFor();
      assert.doesNotMatch(await board.innerText(), /Updated|Refreshes every/);
      const before = calls.PassengerSailingBoard;
      const refreshed = page.waitForResponse(response => response.url().endsWith('/barkolink_execute') && response.request().postDataJSON()?.operation === 'PassengerSailingBoard');
      await page.clock.fastForward(30000);
      await refreshed;
      assert.ok(calls.PassengerSailingBoard > before, 'Passenger polling continues');
      await board.screenshot({ path: `.audit/tracking-refresh/passenger-${width}-${theme}.png` });
    } else {
      const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
      await refresh.waitFor();
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Refresh')?.disabled);
      assert.equal(await page.locator('.queue-freshness').count(), 0);
      const operation = role === 'BOARDING' ? 'BoardingManifest' : 'StaffBookings';
      const before = calls[operation] || 0;
      const refreshed = page.waitForResponse(response => response.url().endsWith('/barkolink_execute') && response.request().postDataJSON()?.operation === operation);
      await page.clock.fastForward(30000);
      await refreshed;
      assert.ok(calls[operation] > before, 'Staff polling continues');
      await page.screenshot({ path: `.audit/tracking-refresh/${role.toLowerCase()}-${width}-${theme}.png` });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${role} has no horizontal page overflow`);
    assert.deepEqual(errors, []);
    console.log(`${role} ${width}px ${theme}: layout, refresh text and polling passed`);
    await context.close();
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
