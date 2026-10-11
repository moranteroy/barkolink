import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110';
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const ports = [{ id: '76a29980-5c27-4c4b-9ead-cae943202001', name: 'Calapan Port', city: 'Calapan' }, { id: '76a29980-5c27-4c4b-9ead-cae943202002', name: 'Batangas Port', city: 'Batangas' }];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const errors = [];
  let fail = false, calls = 0, smallSample = false;
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
      status: ['SCHEDULED', 'BOARDING', 'DELAYED', 'CANCELLED'][i % 4],
      origin: ports[i % 2], destination: ports[(i + 1) % 2], vessel: { name: 'MV Test Ferry' }, operator: 'FastCat',
    }));
    if (smallSample) sailings = [sailings[0], sailings[2], sailings[4], sailings[1]];
    return route.fulfill({ json: { date: today, updatedAt: new Date().toISOString(), portId, ports, sailings, advisories: [{ id: 'notice', title: 'Terminal advisory', message: 'Please follow terminal staff instructions before boarding.', priority: 'HIGH', endsAt: new Date(Date.now() + 3600000).toISOString() }] } });
  });
  const page = await context.newPage();
  await page.clock.install();
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1240, height: 580 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/port-display?port=${ports[0].id}&screen=1`);
    await page.getByRole('heading', { name: 'Calapan Port', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Terminal advisory', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Copy TV link' }).count(), 0);
    assert.equal(await page.locator('.sailing-status.cancelled').count() > 0, true);
    const dimensions = await page.locator('.port-screen').evaluate(el => ({ width: el.scrollWidth, height: el.scrollHeight }));
    assert.ok(dimensions.width <= viewport.width, `Horizontal overflow at ${viewport.width}: ${JSON.stringify(dimensions)}`);
    if (viewport.width > 800) assert.ok(dimensions.height <= viewport.height, `TV content needs scrolling at ${viewport.width}: ${JSON.stringify(dimensions)}`);
    if (viewport.width === 1920) await page.screenshot({ path: path.join(os.tmpdir(), 'barkolink-port-display.png') });
    console.log(`Port display layout passed: ${viewport.width} x ${viewport.height}`);
  }
  smallSample = true;
  await page.setViewportSize({ width: 1240, height: 580 });
  await page.goto(`${baseUrl}/port-display?port=${ports[0].id}`);
  await page.getByRole('heading', { name: 'Terminal advisory', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.departures .sailing-rows li').length === 3);
  assert.equal(await page.locator('.departures .board-count small').count(), 0, 'Three departures should fit on one page at the screenshot size');
  await page.getByRole('button', { name: 'Display controls' }).click();
  assert.equal(await page.locator('.departures .sailing-rows li').count(), 3, 'Opening controls must not shrink the board');
  await page.getByRole('button', { name: 'Hide controls' }).click();
  await page.screenshot({ path: path.join(os.tmpdir(), 'barkolink-port-display-compact.png') });
  smallSample = false;
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.reload();
  await page.getByRole('heading', { name: 'Calapan Port', exact: true }).waitFor();
  const firstCodes = await page.locator('.sailing-details small').allTextContents();
  await page.clock.fastForward(12000);
  assert.notDeepEqual(await page.locator('.sailing-details small').allTextContents(), firstCodes, 'TV pages should rotate');
  const previousCalls = calls;
  await page.clock.fastForward(30000);
  await page.waitForFunction(() => document.querySelector('.display-error') === null);
  assert.ok(calls > previousCalls, 'TV data should refresh automatically');
  await page.getByRole('button', { name: 'Display controls' }).click();
  await page.getByLabel('Port', { exact: true }).selectOption(ports[1].id);
  await page.getByRole('heading', { name: 'Batangas Port', exact: true }).waitFor();
  assert.ok(page.url().includes(ports[1].id));
  fail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.ok(await page.locator('.sailing-rows li').count() > 0, 'Offline board should preserve the last successful schedule');
  assert.match(await page.locator('footer').innerText(), /Updates delayed/);
  fail = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'detached' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy TV link' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.includes('screen=1') && copied.includes(ports[1].id));
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.evaluate(() => document.exitFullscreen());
  assert.deepEqual(errors, []);
  console.log('Public access, page rotation, refresh, port selection and offline recovery passed.');
} finally { await browser.close(); }
