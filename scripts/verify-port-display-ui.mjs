import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';

async function main() {
const root = path.resolve('dist');
const headers = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers;
const server = http.createServer((request, response) => {
  const candidate = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!candidate.startsWith(root + path.sep)) return response.writeHead(404).end();
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
  for (const header of headers) response.setHeader(header.key, header.value);
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = process.env.BARKOLINK_UI_URL || `http://127.0.0.1:${server.address().port}`;
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const ports = [{ id: '76a29980-5c27-4c4b-9ead-cae943202001', name: 'Calapan Port', city: 'Calapan' }, { id: '76a29980-5c27-4c4b-9ead-cae943202002', name: 'Batangas Port', city: 'Batangas' }];
fs.mkdirSync('.audit/port-display', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.portCspErrors = [];
    document.addEventListener('securitypolicyviolation', event => window.portCspErrors.push(event.violatedDirective));
  });
  const errors = [];
  let fail = false, calls = 0, smallSample = false, terminalSample = false, emptySample = false, weatherFail = false, weatherCode = 3, weatherIsDay = 1, weatherAgeMinutes = 0;
  const weatherRequests = [];
  await context.route('https://api.open-meteo.com/**', async route => {
    const url = new URL(route.request().url());
    weatherRequests.push(Object.fromEntries(url.searchParams));
    if (weatherFail) return route.fulfill({ status: 503, json: { error: true } });
    const date = url.searchParams.get('start_date');
    const epoch = Date.parse(`${date}T00:00:00+08:00`) / 1000;
    return route.fulfill({ json: {
      current: { time: Math.floor((await page.evaluate(() => Date.now())) / 1000) - weatherAgeMinutes * 60, temperature_2m: 28, weather_code: weatherCode, is_day: weatherIsDay }, hourly: { time: [] },
      daily: { sunrise: [epoch + 6 * 3600], sunset: [epoch + 18 * 3600], time: [epoch], weather_code: [61], temperature_2m_max: [30], temperature_2m_min: [25], precipitation_probability_max: [80], wind_speed_10m_max: [24] },
    } });
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route(`${projectUrl}/**`, async route => {
    const url = new URL(route.request().url());
    assert.equal(url.pathname, '/rest/v1/rpc/port_display', 'TV should only request its public feed');
    calls++;
    if (fail) return route.fulfill({ status: 503, json: { message: 'Fixture offline' } });
    const portId = route.request().postDataJSON().p_port || ports[0].id;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    let sailings = Array.from({ length: 16 }, (_, i) => ({
      code: `TV-${i}`, departureAt: `${today}T${String(6 + Math.floor(i / 2)).padStart(2, '0')}:00:00+08:00`, arrivalAt: `${today}T${String(8 + Math.floor(i / 2)).padStart(2, '0')}:00:00+08:00`,
      status: ['BOARDING', 'SCHEDULED', 'DELAYED', 'CANCELLED', 'COMPLETED'][i % 5],
      origin: ports[i % 2], destination: ports[(i + 1) % 2], vessel: { name: i % 2 ? 'MV Reina de la Inmaculada' : 'MV Reina de los Flores' }, operator: 'Montenegro Shipping Lines',
    }));
    if (smallSample) sailings = [sailings[0], sailings[2], sailings[4], sailings[1]];
    if (terminalSample) sailings = [
      { ...sailings[1], status: 'COMPLETED', departureAt: `${today}T06:00:00+08:00` },
      { ...sailings[3], status: 'SCHEDULED', departureAt: `${today}T14:00:00+08:00` },
      { ...sailings[0], status: 'BOARDING', arrivalAt: `${today}T11:30:00+08:00` },
      { ...sailings[2], status: 'SCHEDULED', arrivalAt: `${today}T19:30:00+08:00` },
      { ...sailings[4], code: 'TV-EXTRA', status: 'COMPLETED', arrivalAt: `${today}T14:00:00+08:00` },
    ];
    if (emptySample) sailings = [];
    return route.fulfill({ json: { date: today, updatedAt: new Date().toISOString(), portId, ports, sailings, advisories: terminalSample ? [] : [{ id: 'notice', title: 'Terminal advisory', message: 'Please follow terminal staff instructions before boarding.', priority: 'HIGH', endsAt: new Date(Date.now() + 3600000).toISOString() }, { id: 'routine', title: 'Routine reminder', message: 'Keep the terminal clean.', priority: 'LOW', endsAt: new Date(Date.now() + 3600000).toISOString() }] } });
  });
  const page = await context.newPage();
  await page.clock.install();
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1240, height: 580 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/port-display?port=${ports[0].id}&screen=1`);
    await page.getByRole('heading', { name: 'Calapan Port', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Terminal advisory', exact: true }).waitFor();
    await page.waitForURL(url => url.searchParams.get('port') === 'calapan-port');
    assert.equal(await page.getByRole('button', { name: 'Copy TV link' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Display controls', exact: true }).count(), 0, 'TV mode must hide configuration controls');
    assert.match(await page.locator('.boarding-banner').innerText(), /NOW BOARDING/);
    assert.match(await page.locator('.boarding-destination h2').innerText(), /Calapan Port → Batangas Port/);
    assert.match(await page.locator('.boarding-origin').innerText(), /Boarding at Calapan Port/);
    await page.locator('.maritime-header-art[data-weather="cloudy"]').waitFor();
    assert.equal(await page.locator('.display-weather').count(), 0, 'Weather must not consume a separate board row');
    assert.equal(await page.locator('footer').count(), 0, 'The display must not show the removed footer');
    const weatherTooltip = page.getByRole('tooltip', { includeHidden: true });
    assert.equal(await weatherTooltip.isVisible(), false, 'Weather text stays hidden until hover or focus');
    await page.getByRole('img', { name: 'Port weather' }).hover();
    assert.match(await weatherTooltip.innerText(), /Overcast/);
    assert.equal(await weatherTooltip.isVisible(), true);
    await page.mouse.move(0, 0);
    assert.equal(await weatherTooltip.isVisible(), false);
    await page.getByRole('img', { name: 'Port weather' }).focus();
    assert.equal(await weatherTooltip.isVisible(), true, 'Keyboard focus also reveals the weather');
    await page.getByRole('img', { name: 'Port weather' }).evaluate(el => el.blur());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.sailing-rows li')).every(row => row.getBoundingClientRect().bottom <= row.closest('.display-board').getBoundingClientRect().bottom + 1));
    assert.match(await page.locator('.connection-state').innerText(), /Live updates/);
    if (viewport.width === 1920) {
      const readStatuses = () => page.locator('.sailing-status').evaluateAll(elements => elements.map(el => {
        const style = getComputedStyle(el);
        const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const fg = luminance(style.color), bg = luminance(style.backgroundColor);
        return { status: el.classList[1], background: style.backgroundColor, contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
      }));
      const statuses = await readStatuses();
      await page.clock.fastForward(12000);
      statuses.push(...await readStatuses());
      for (const status of ['scheduled', 'boarding', 'delayed', 'cancelled', 'completed']) assert.ok(statuses.some(badge => badge.status === status), `Missing status: ${status}`);
      for (const badge of statuses) {
        assert.ok(badge.contrast >= 4.5, `Insufficient ${badge.status} text contrast: ${badge.contrast}`);
      }
      const departureBadges = await page.locator('.departures .sailing-status').evaluateAll(elements => elements.map(el => getComputedStyle(el).backgroundColor));
      assert.equal(new Set(departureBadges).size, departureBadges.length, 'Statuses must use distinct colors');
      console.log('All five status labels passed; text contrast is at least 4.5:1.');
    }
    const dimensions = await page.locator('.port-screen').evaluate(el => ({ width: el.scrollWidth, height: el.scrollHeight }));
    assert.equal(await page.locator('.sailing-details').evaluateAll(elements => elements.some(el => el.getBoundingClientRect().bottom > el.closest('li').getBoundingClientRect().bottom - 2)), false, 'Vessel and trip details must fit inside their rows');
    assert.ok(dimensions.width <= viewport.width, `Horizontal overflow at ${viewport.width}: ${JSON.stringify(dimensions)}`);
    if (viewport.width > 800) assert.ok(dimensions.height <= viewport.height, `TV content needs scrolling at ${viewport.width}: ${JSON.stringify(dimensions)}`);
    const clippedRows = await page.locator('.sailing-rows li').evaluateAll(rows => rows.filter(row => row.getBoundingClientRect().bottom > row.closest('.display-board').getBoundingClientRect().bottom + 1).map(row => ({ rowBottom: row.getBoundingClientRect().bottom, boardBottom: row.closest('.display-board').getBoundingClientRect().bottom })));
    assert.deepEqual(clippedRows, [], `Every visible trip row must fit inside its board at ${viewport.width}`);
    await page.screenshot({ path: `.audit/port-display/board-${viewport.width}.png` });
    assert.deepEqual(await page.evaluate(() => window.portCspErrors), []);
    console.log(`Port display layout passed: ${viewport.width} x ${viewport.height}`);
  }
  terminalSample = true;
  for (const viewport of [{ width: 1240, height: 580 }, { width: 1366, height: 636 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/port-display?port=${ports[1].id}`);
    await page.getByRole('heading', { name: 'Batangas Port', exact: true }).waitFor();
    await page.locator('.arrivals .status-context').waitFor();
    assert.equal(await page.locator('.boarding-banner').count(), 0, 'Arriving trips boarding at another port must not trigger local boarding announcements');
    assert.equal(await page.locator('.arrivals .status-context').innerText(), ports[0].city);
    assert.match(await page.locator('.arrivals .sailing-status.boarding').innerText(), /Boarding at origin/);
    assert.notEqual(await page.locator('.arrivals .sailing-status.boarding').evaluate(el => getComputedStyle(el).backgroundColor), await page.locator('.sailing-status.scheduled').first().evaluate(el => getComputedStyle(el).backgroundColor), 'Boarding at origin must be distinct from scheduled');
    const visibleRows = await page.locator('.sailing-rows li').count();
    assert.ok(visibleRows >= 2 && visibleRows <= 5, 'Each board shows at least one sailing');
    const capacity = await page.locator('.display-board').first().evaluate(board => {
      const rowHeight = parseFloat(getComputedStyle(board.closest('.port-screen')).getPropertyValue('--sailing-row-height'));
      return Math.max(1, Math.min(6, Math.floor((board.clientHeight - board.querySelector('.board-heading').getBoundingClientRect().height - board.querySelector('.board-columns').getBoundingClientRect().height) / rowHeight)));
    });
    assert.equal(visibleRows, Math.min(2, capacity) + Math.min(3, capacity), 'Paging uses the space below the header');
    assert.equal(await page.locator('.sailing-details').evaluateAll(elements => elements.some(el => el.getBoundingClientRect().bottom > el.closest('li').getBoundingClientRect().bottom - 2)), false, 'Expanded rows must fit long vessel details');
    assert.equal(await page.locator('.sailing-rows time').evaluateAll(elements => elements.some(el => el.scrollWidth > el.clientWidth + 1)), false, 'Large scheduled times must fit their column');
    const rowHeights = await page.locator('.sailing-rows li').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
    assert.ok(Math.max(...rowHeights) - Math.min(...rowHeights) <= 1, 'Departures and arrivals keep matching row sizes even with different record counts');
    const dimensions = await page.locator('.port-screen').evaluate(el => ({ width: el.scrollWidth, height: el.scrollHeight }));
    assert.ok(dimensions.width <= viewport.width && dimensions.height <= viewport.height, 'Sparse board must fit the screen');
    await page.screenshot({ path: `.audit/port-display/refined-${viewport.width}.png` });
  }
  emptySample = true;
  for (const viewport of [{ width: 1834, height: 858 }, { width: 1366, height: 636 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl + '/port-display?port=batangas-port');
    await page.getByRole('heading', { name: 'No departures listed for today.', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'No arrivals listed for today.', exact: true }).waitFor();
    const dimensions = await page.locator('.port-screen').evaluate(el => ({ width: el.scrollWidth, height: el.scrollHeight }));
    assert.ok(dimensions.width <= viewport.width, 'Empty board must not overflow horizontally');
    if (viewport.width > 800) assert.ok(dimensions.height <= viewport.height, 'Empty TV board must fit vertically');
    await page.screenshot({ path: '.audit/port-display/empty-' + viewport.width + '.png' });
  }
  emptySample = false;
  terminalSample = false;
  smallSample = true;
  await page.setViewportSize({ width: 1240, height: 580 });
  await page.goto(`${baseUrl}/port-display?port=${ports[0].id}`);
  await page.getByRole('heading', { name: 'Terminal advisory', exact: true }).waitFor();
    await page.waitForURL(url => url.searchParams.get('port') === 'calapan-port');
  await page.waitForFunction(() => document.querySelectorAll('.departures .sailing-rows li').length > 0);
  const compactCount = await page.locator('.departures .sailing-rows li').count();
  assert.ok(compactCount <= 3, 'Compact board should paginate its three departures to fit available space');
  await page.getByRole('button', { name: 'Display controls' }).click();
  assert.match(await page.locator('.display-responsibility').innerText(), /Administrator: update trip schedules, statuses, and published advisories/);
  assert.match(await page.locator('.display-responsibility').innerText(), /Boarding desk: confirm actual boarding conditions and report corrections/);
  assert.equal(await page.getByText('Confirm with staff', { exact: true }).count(), 0, 'Passenger guidance names the boarding desk clearly');
  assert.equal(await page.locator('.departures .sailing-rows li').count(), compactCount, 'Opening controls must not shrink the board');
  await page.getByRole('button', { name: 'Hide controls' }).click();
  await page.screenshot({ path: path.join(os.tmpdir(), 'barkolink-port-display-compact.png') });
  smallSample = false;
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.reload();
  await page.getByRole('heading', { name: 'Calapan Port', exact: true }).waitFor();
  const firstCodes = await page.locator('.sailing-details small').allTextContents();
  await page.clock.fastForward(12000);
  assert.notDeepEqual(await page.locator('.sailing-details small').allTextContents(), firstCodes, 'TV pages should rotate');
  await page.getByRole('heading', { name: 'Terminal advisory', exact: true }).waitFor();
    await page.waitForURL(url => url.searchParams.get('port') === 'calapan-port');
  assert.equal(await page.getByRole('heading', { name: 'Routine reminder', exact: true }).count(), 0, 'Urgent announcements must stay visible while ordinary reminders wait');
  const previousCalls = calls;
  await page.clock.fastForward(30000);
  await page.waitForFunction(() => document.querySelector('.display-error') === null);
  assert.ok(calls > previousCalls, 'TV data should refresh automatically');
  await page.getByRole('button', { name: 'Display controls' }).click();
  await page.getByLabel('Port', { exact: true }).selectOption(ports[1].id);
  await page.getByRole('heading', { name: 'Batangas Port', exact: true }).waitFor();
  await page.waitForURL('**port=batangas-port');
  await page.locator('.maritime-header-art[data-weather="cloudy"]').waitFor();
  assert.match(await page.locator('.boarding-destination h2').innerText(), /Batangas Port → Calapan Port/);
  assert.equal(weatherRequests.at(-1).latitude, '13.7580556');
  await page.reload();
  await page.getByRole('heading', { name: 'Batangas Port', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Display controls', exact: true }).click();
  fail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.ok(await page.locator('.sailing-rows li').count() > 0, 'Offline board should preserve the last successful schedule');
  assert.match(await page.locator('.connection-state').innerText(), /Updates delayed/);
  assert.match(await page.locator('.boarding-banner').innerText(), /LAST REPORTED/);
  assert.equal(await page.getByText('NOW BOARDING', { exact: true }).count(), 0, 'Stale boarding information must not be labelled live');
  fail = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'detached' });
  assert.match(await page.locator('.boarding-banner').innerText(), /NOW BOARDING/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy TV link' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.includes('screen=1') && copied.includes('port=batangas-port') && !copied.includes(ports[1].id));
  await page.getByRole('button', { name: 'TV mode', exact: true }).click();
  await page.waitForURL('**screen=1');
  assert.equal(await page.getByRole('button', { name: 'Display controls', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByLabel('Port', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.evaluate(() => document.exitFullscreen());
  // The board stays open across Philippine midnight, including a failed weather request.
  weatherFail = true;
  const oldDate = weatherRequests.at(-1).start_date;
  const nextMidnight = new Date(Date.parse(`${oldDate}T00:00:00+08:00`) + 86400000);
  await page.clock.setSystemTime(nextMidnight);
  await page.clock.fastForward(1000);
  await page.locator('.maritime-header-art[data-weather="neutral"]').waitFor();
  assert.equal(await page.locator('.header-weather-target').count(), 0, 'Yesterday’s weather must disappear even when the next forecast fails');
  const nextDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(nextMidnight);
  assert.equal(weatherRequests.at(-1).start_date, nextDate);
  weatherFail = false;
  await page.clock.fastForward(5 * 60000 + 30000);
  await page.locator('.maritime-header-art[data-weather="cloudy"]').waitFor();
  assert.equal(weatherRequests.at(-1).start_date, nextDate);
  // Preview every weather scene in the same header without changing sailing behavior.
  await page.clock.setSystemTime(new Date());
  await page.setViewportSize({ width: 1366, height: 636 });
  for (const [code, scene, isDay] of [[0, 'clear', 1], [2, 'partly-cloudy', 1], [3, 'cloudy', 1], [61, 'rain', 1], [95, 'storm', 1], [45, 'fog', 1], [71, 'snow', 1], [0, 'clear', 0], [3, 'cloudy', 0], [61, 'rain', 0]]) {
    weatherCode = code; weatherIsDay = isDay;
    await page.clock.setSystemTime(new Date(`${nextDate}T${isDay ? "12" : "21"}:00:00+08:00`));
    await page.reload();
    const art = page.locator(`.maritime-header-art[data-weather="${scene}"]`);
    await art.waitFor();
    await art.locator('img').evaluate(img => img.decode());
    assert.equal(await art.locator('img').evaluate(img => getComputedStyle(img).display !== 'none' && img.getAttribute('src') === '/images/ferry-seascape-v2.webp'), true, 'Keep the original ferry photo visible in every weather scene');
    assert.ok((await art.getAttribute('class')).includes(isDay ? 'weather-day' : 'weather-night'));
    await page.waitForTimeout(1900); // Let the photo lighting transition settle before visual inspection.
    await page.screenshot({ path: `.audit/port-display/weather-${scene}-${isDay ? 'day' : 'night'}.png` });
    assert.equal(await page.locator('.display-weather').count(), 0);
    if (['rain', 'storm', 'snow'].includes(scene)) {
      assert.ok(await page.locator('.weather-particle').count() >= 20);
      assert.notEqual(await page.locator('.sky-precipitation').evaluate(el => getComputedStyle(el).animationName), 'none');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await art.locator('.sky-orb,.sky-stars,.sky-cloud,.sky-mist,.sky-precipitation,.weather-particle').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none')), true, 'Reduced motion must stop every weather layer');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  // Local time and solar boundaries drive the scene, independent of an older provider day flag.
  weatherCode = 0; weatherIsDay = 1;
  for (const [time, phase] of [['05:40','dawn'], ['08:00','morning'], ['12:00','midday'], ['15:00','afternoon'], ['17:55','dusk'], ['21:00','night']]) {
    await page.clock.setSystemTime(new Date(`${nextDate}T${time}:00+08:00`));
    await page.reload();
    await page.locator(`.port-screen[data-phase="${phase}"][data-weather="clear"]`).waitFor();
    await page.screenshot({ path: `.audit/port-display/time-${phase}.png` });
  }
  await page.clock.setSystemTime(new Date(`${nextDate}T17:59:00+08:00`));
  await page.reload();
  await page.locator('.maritime-header-art.weather-day[data-weather="clear"]').waitFor();
  const beforeSunsetRequests = weatherRequests.length;
  await page.clock.fastForward(61000);
  await page.locator('.maritime-header-art.weather-night[data-weather="clear"]').waitFor();
  assert.equal(weatherRequests.length, beforeSunsetRequests, 'Sunset switches live without waiting for the next weather request');
  await page.getByRole('img', { name: 'Port weather' }).hover();
  assert.match(await page.getByRole('tooltip').innerText(), /Clear sky/);
  assert.doesNotMatch(await page.getByRole('tooltip').innerText(), /Sunny/);
  for (const age of [60, -20]) {
    weatherAgeMinutes = age;
    await page.reload();
    await page.getByRole('heading', { name: 'Batangas Port', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.header-weather-status')?.textContent.toLowerCase().includes('unavailable'));
    assert.equal(await page.locator('.port-screen').getAttribute('data-weather'), 'neutral');
    assert.equal(await page.locator('.header-weather-target').count(), 0, 'Old or future readings must not imply live weather');
  }
  weatherAgeMinutes = 0;
  weatherCode = 2;
  await page.clock.setSystemTime(new Date(`${nextDate}T12:00:00+08:00`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('.port-screen[data-phase="midday"][data-weather="partly-cloudy"]').waitFor();
  await page.screenshot({ path: '.audit/port-display/weather-mobile.png', fullPage: true });
  assert.equal(await page.locator('.port-screen').evaluate(el => el.scrollWidth <= innerWidth), true);
  assert.deepEqual(await page.evaluate(() => window.portCspErrors), []);
  assert.deepEqual(errors, []);
  console.log('Public access, page rotation, refresh, port selection and offline recovery passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
