import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

// All service requests use fixtures. No account, booking or hosted data is changed.
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8113';
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const [year, month] = today.split('-').map(Number);
const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
const date = day => `${nextMonth}-${String(day).padStart(2, '0')}`;
const label = day => new Date(`${day}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
const origin = { id: 'btg', name: 'Batangas Port', city: 'Batangas' };
const destination = { id: 'clp', name: 'Calapan Port', city: 'Calapan' };
const sailing = (code, day, time, arrivalDay, arrivalTime) => ({
  code, departureAt: `${date(day)}T${time}:00+08:00`, arrivalAt: `${date(arrivalDay)}T${arrivalTime}:00+08:00`,
  origin, destination, vessel: { id: 'v1', name: 'MV Starlite Annapolis', passengerCapacity: 200, isActive: true },
  status: 'SCHEDULED', availableSeats: 20, regularFare: 600, studentFare: 480, seniorFare: 480, pwdFare: 480, childFare: 300, durationMinutes: 120,
});
const rows = [sailing('CAL-001', 7, '08:00', 7, '10:00'), sailing('CAL-002', 7, '12:00', 7, '14:00'), sailing('CAL-003', 7, '23:00', 8, '01:00'), sailing('CAL-004', 10, '08:00', 10, '10:00')];
const fixtures = [...rows, { ...rows[0], code: 'OTHER-ROUTE', origin: destination, destination: origin }, { ...rows[0], code: 'FULL-GROUP', availableSeats: 1 }, { ...rows[0], code: 'CANCELLED', status: 'CANCELLED' }];
fs.mkdirSync('.audit/sailing-calendar', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' });
    await context.addInitScript(theme => { localStorage.setItem('barkolink-theme', theme); localStorage.setItem('barkolink-search-passengers', '2'); }, theme);
    await context.route(`${projectUrl}/**`, route => {
      if (route.request().url().includes('/auth/')) return route.fulfill({ status: 401, json: { message: 'Not signed in' } });
      const { operation } = route.request().postDataJSON();
      const data = { BrowseSailings: { sailings: fixtures }, BrowseActivePorts: { ports: [origin, destination] }, ActiveAdvisories: { advisories: [] } }[operation];
      assert.ok(data, `Missing calendar fixture: ${operation}`);
      return route.fulfill({ json: data });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}/trips?source=calendar&from=Batangas&to=Calapan&date=${date(7)}`);
    const calendar = page.locator('.sailing-calendar');
    const button = (day, count, event = 'departure') => calendar.getByRole('button', { name: `${label(date(day))}: ${count} ${event}${count === 1 ? '' : 's'}`, exact: true });
    await button(7, 3).waitFor();
    assert.equal(await button(7, 3).locator('.trip-count').textContent(), '3');
    assert.match(await button(9, 0).textContent(), /No trips/);
    assert.equal(await page.locator('.trip-card').count(), 3);
    assert.ok(await calendar.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Calendar fits its container');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page has no horizontal overflow');
    await calendar.screenshot({ path: `.audit/sailing-calendar/${width}-${theme}.png` });
    await calendar.getByRole('button', { name: 'Arrivals', exact: true }).click();
    await button(8, 1, 'arrival').click();
    await page.waitForFunction(() => document.querySelector('.preview-count')?.textContent.includes('1 arrival'));
    assert.equal(await page.locator('.trip-card').count(), 1);
    await calendar.getByRole('button', { name: 'Departures', exact: true }).click();
    await button(9, 0).click();
    await page.waitForFunction(() => document.querySelector('.preview-count')?.textContent.includes('0 departures'));
    const picker = calendar.getByLabel('Choose calendar month');
    await picker.fill('2099-01'); await picker.dispatchEvent('change');
    assert.equal(await calendar.locator('.month-controls h3').textContent(), 'January 2099');
    await calendar.locator('.next-date').click();
    await page.waitForFunction(() => document.querySelector('.preview-count')?.textContent.includes('1 departure'));
    assert.equal(await page.locator('.trip-card').count(), 1);
    await calendar.getByRole('button', { name: 'Show all dates', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.calendar-preview h3')?.textContent === 'Choose a travel date');
    assert.equal(await page.locator('.trip-card').count(), 4);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, theme, countsFiltered: true, dateSelection: true, overnightArrival: true, monthPicker: true, noOverflow: true }));
    await context.close();
  }
} finally { await browser.close(); }
