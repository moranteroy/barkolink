import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';

const root = path.resolve('dist');
const server = http.createServer((request, response) => {
  const candidate = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!candidate.startsWith(root + path.sep) && candidate !== root) return response.writeHead(404).end();
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
  response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.BARKOLINK_UI_URL || `http://127.0.0.1:${server.address().port}`;
const project = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const key = `sb-${new URL(project).hostname.split('.')[0]}-auth-token`;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const errors = [], metrics = [];
const desktopOnly = process.argv.includes('--desktop');
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  fs.mkdirSync('.audit/settings-ui', { recursive: true });
  for (const role of ['ADMIN', 'BOARDING', 'TICKETING']) {
    for (const theme of desktopOnly ? ['dark'] : ['dark', 'light']) {
      for (const width of desktopOnly ? [1366] : [1366, 768, 390]) {
        const height = width === 1366 ? 636 : 900;
        const context = await browser.newContext({ viewport: { width, height } });
        const user = { id: '11111111-1111-4111-8111-111111111111', email: 'ui-account@example.invalid', aud: 'authenticated', app_metadata: { role }, user_metadata: { fullName: 'Alex Santos' }, factors: [{ id: 'test-factor', factor_type: 'totp', status: 'verified' }] };
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const session = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, aal: 'aal2', role: 'authenticated', app_metadata: user.app_metadata })}.fixture`, refresh_token: 'synthetic-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
        const profile = { uid: user.id, fullName: 'Alex Santos', email: user.email, phone: '09123456789', role, assignedPortId: 'port', assignedPort: { id: 'port', name: 'Calapan', isActive: true } };
        let saves = 0;
        await context.addInitScript(({ key, session, theme }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('barkolink-theme', theme); }, { key, session, theme });
        await context.route(`${project}/**`, async route => {
          const url = new URL(route.request().url());
          if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
          if (url.pathname.endsWith('/rpc/barkolink_execute')) {
            const { operation, args } = route.request().postDataJSON();
            if (operation === 'MyNotifications') return route.fulfill({ json: { notifications: [] } });
            if (operation === 'MyProfile') return route.fulfill({ json: { user: profile } });
            if (operation === 'UpdateMyProfile') { saves++; Object.assign(profile, args); return route.fulfill({ json: {} }); }
            throw new Error(`Unexpected operation: ${operation}`);
          }
          throw new Error(`Unexpected request: ${url.pathname}`);
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        const prefix = role === 'ADMIN' ? '/admin/settings' : `/staff/${role.toLowerCase()}/settings`;
        const sections = role === 'ADMIN' ? ['profile', 'password', 'appearance'] : ['account', 'security', 'appearance'];
        for (const section of sections) {
          await page.goto(base + prefix + '/' + section);
          await page.locator('main:visible h1').waitFor();
          const main = page.locator('main:visible');
          if (role === 'ADMIN') {
            const sidebar = page.locator('aside#admin-sidebar');
            assert.equal(await sidebar.locator('.brand-mark').count(), 1, 'Admin logo belongs in the dashboard sidebar');
            assert.equal(await page.locator('header .brand-mark').count(), 0, 'Admin header does not duplicate the sidebar logo');
            await page.getByRole('button', { name: 'Administrator account menu', exact: true }).waitFor();
            if (width > 950) {
              const logo = await sidebar.locator('.brand-mark').boundingBox();
              assert.ok(logo.x < 40 && logo.y < 40, 'Admin logo sits at the upper left, as on the dashboard');
              assert.ok((await main.boundingBox()).x >= (await sidebar.boundingBox()).width, 'Settings content sits beside the admin sidebar');
              const groups = await sidebar.locator('.nav-group-toggle').evaluateAll(buttons => buttons.map(button => ({ height: button.getBoundingClientRect().height, font: parseFloat(getComputedStyle(button).fontSize), labelHeight: button.querySelector('.nav-group-label').getBoundingClientRect().height })));
              assert.ok(groups.every(group => group.height <= 40 && group.font <= 13 && group.labelHeight < 22), 'Desktop sidebar categories stay compact and on one line');
            } else {
              await page.getByRole('button', { name: 'Open menu', exact: true }).click();
              await page.locator('aside#admin-sidebar.open').waitFor();
              await page.getByRole('button', { name: 'Close menu', exact: true }).click({ position: { x: width - 10, y: 10 } });
              await page.locator('aside#admin-sidebar.open').waitFor({ state: 'detached' });
            }
          }
          if (section === 'profile' || section === 'account') {
            const phone = page.getByLabel('Mobile number', { exact: true });
            await phone.waitFor();
            await page.waitForFunction(() => [...document.querySelectorAll('input[type="tel"]')].some(input => input.value === '09123456789'));
            const save = page.getByRole('button', { name: role === 'ADMIN' ? 'Save profile' : 'Save number', exact: true });
            assert.equal(await save.isDisabled(), true);
            await phone.fill('09987654321');
            await save.click({ trial: true });
            assert.equal(await save.isEnabled(), true);
            await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
            assert.equal(await phone.inputValue(), '09123456789');
            assert.equal(saves, 0);
            await phone.fill('09987654321');
            await save.click();
            await page.locator('.app-toast.success').waitFor();
            assert.equal(await page.locator('.notice.success, .feedback.success').count(), 0, 'Success appears once in the toast, without a duplicate banner');
            assert.equal(saves, 1);
            assert.equal(profile.phone, '09987654321');
            // Restore synthetic data for navigation and the next viewport.
            profile.phone = '09123456789';
            await page.reload();
            await page.waitForFunction(() => [...document.querySelectorAll('input[type="tel"]')].some(input => input.value === '09123456789'));
          }
          if (section === 'password' || section === 'security') {
            await page.getByLabel('Show passwords', { exact: true }).check();
            assert.equal(await page.locator('input[autocomplete="current-password"]').getAttribute('type'), 'text');
            await page.getByLabel('Show passwords', { exact: true }).uncheck();
          }
          if (section === 'appearance') {
            await page.getByRole('button', { name: `Use ${theme} appearance` }).click();
            assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
          }
          assert.equal(await main.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${role} ${section} ${width}: no horizontal overflow`);
          const nav = page.locator('nav[aria-label$="settings sections" i]:visible, nav[aria-label="Settings sections"]:visible');
          assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
          const card = page.locator('.setting-card:visible, .settings-card:visible');
          const box = await card.boundingBox();
          if (width === 1366 && ['profile', 'account'].includes(section)) {
            assert.ok(box.y + box.height <= height, `${role} profile card and actions fit the desktop viewport`);
            if (role === 'ADMIN') {
              const tops = await page.locator('fieldset input').evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().top));
              assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, 'Desktop profile fields align');
            }
          }
          metrics.push({ role, section, theme, width, bottom: Math.round(box.y + box.height) });
          await page.screenshot({ path: `.audit/settings-ui/${role.toLowerCase()}-${section}-${theme}-${width}.png`, animations: 'disabled' });
        }
        await context.close();
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(metrics.filter(item => item.width === 1366 && item.theme === 'dark')));
  console.log('Settings browser checks passed: admin, boarding, ticketing; profile save/discard; password visibility; themes; active navigation; desktop/tablet/mobile. Screenshots: .audit/settings-ui');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
