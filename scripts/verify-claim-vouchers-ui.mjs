import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

// All account and voucher requests use isolated fixtures. No hosted claims or promos are created.
async function main() {
  const base = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8113';
  const project = fs
    .readFileSync('.env.local', 'utf8')
    .match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)[1]
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const ref = new URL(project).hostname.split('.')[0],
    uid = '11111111-1111-4111-8111-111111111111';
  const directory = '.audit/claim-vouchers';
  fs.mkdirSync(directory, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const role of process.env.BARKOLINK_UI_ROLE
      ? [process.env.BARKOLINK_UI_ROLE]
      : ['PASSENGER', 'ADMIN'])
      for (const width of role === 'ADMIN'
        ? [1366, 768, 700, 699, 560, 390, 320]
        : [1366, 768, 560, 390, 320])
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({
            viewport: { width, height: width === 1366 ? 636 : 950 },
            timezoneId: 'America/Los_Angeles',
          });
          const user = {
            id: uid,
            email: 'voucher-ui@example.invalid',
            app_metadata: { role },
            user_metadata: { fullName: 'Voucher Preview' },
            aud: 'authenticated',
          };
          const exp = Math.floor(Date.now() / 1000) + 3600,
            encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
          const session = {
            access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, exp, aal: 'aal2', role: 'authenticated', app_metadata: { role } })}.fixture`,
            refresh_token: 'fixture',
            token_type: 'bearer',
            expires_at: exp,
            expires_in: 3600,
            user,
          };
          await context.addInitScript(
            ({ key, session, theme }) => {
              localStorage.setItem(key, JSON.stringify(session));
              localStorage.setItem('barkolink-theme', theme);
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                  writeText: async (text) => {
                    sessionStorage.setItem('copied-voucher', text);
                  },
                },
              });
            },
            { key: `sb-${ref}-auth-token`, session, theme },
          );
          const now = Date.now(),
            iso = (offset) => new Date(now + offset * 86400000).toISOString();
          const offer = {
            id: 'event',
            title: 'Weekend sailing treat',
            description: 'A little extra for your next journey with family and friends.',
            discountType: 'FIXED',
            value: 50,
            minimumSpend: 500,
            startsAt: iso(-1),
            expiresAt: iso(7),
            isActive: true,
            requiredTrips: 0,
            remaining: 1,
            claimedAt: null,
            code: null,
            used: false,
          };
          const offers = [
            { ...offer },
            {
              ...offer,
              id: 'mission',
              title: 'Frequent sailor reward',
              value: 100,
              requiredTrips: 3,
              remaining: 10,
            },
            {
              ...offer,
              id: 'ready',
              title: 'Holiday travel reward for your next island journey',
              claimedAt: iso(-1),
              code: 'HOLIDAY50',
              remaining: 0,
            },
            {
              ...offer,
              id: 'used',
              title: 'Previously used promo',
              claimedAt: iso(-1),
              code: 'USED50',
              used: true,
            },
            {
              ...offer,
              id: 'paused',
              title: 'Paused event promo',
              claimedAt: iso(-1),
              code: 'PAUSED50',
              isActive: false,
            },
            {
              ...offer,
              id: 'expired',
              title: 'Expired event promo',
              claimedAt: iso(-2),
              code: 'EXPIRED50',
              expiresAt: iso(-1),
            },
          ];
          let fail = false,
            empty = false,
            saved = null,
            updated = null;
          const adminOffers = () =>
            offers.map((o) => ({
              ...o,
              code: o.code || `FIXTURE-${o.id}`,
              claimable: true,
              usageLimit: 20,
              used: o.used ? 1 : 0,
              claimed: o.claimedAt ? 1 : 0,
            }));
          await context.route(`${project}/**`, async (route) => {
            const url = route.request().url();
            if (url.includes('/auth/v1/')) return route.fulfill({ json: user });
            if (url.endsWith('/rpc/my_mfa_settings'))
              return route.fulfill({
                json: {
                  role,
                  enabled: true,
                  mfaRequired: role !== 'PASSENGER',
                  staffRequired: true,
                  policyRequired: false,
                },
              });
            if (!url.includes('/rpc/barkolink_execute'))
              return route.fulfill({
                status: 403,
                json: { message: 'Unexpected direct API request' },
              });
            const { operation, args } = route.request().postDataJSON();
            if (operation === 'PassengerVouchers')
              return fail
                ? route.fulfill({
                    status: 503,
                    json: { message: 'Fixture connection unavailable' },
                  })
                : route.fulfill({ json: { completedTrips: 2, vouchers: empty ? [] : offers } });
            if (operation === 'ClaimVoucher') {
              const v = offers.find((o) => o.id === args.voucherId);
              assert.equal(v.id, 'event');
              v.claimedAt = iso(0);
              v.code = 'EVENT50';
              v.remaining = 0;
              return route.fulfill({ json: { code: v.code, claimedAt: v.claimedAt } });
            }
            if (operation === 'AdminUpdateVoucherDetails') {
              updated = args;
              Object.assign(
                offers.find((o) => o.id === args.id),
                args,
              );
              return route.fulfill({ json: { id: args.id } });
            }
            if (operation === 'AdminSaveVoucher') {
              saved = args;
              offers.push({
                ...offer,
                id: 'new',
                title: args.title,
                code: args.code,
                requiredTrips: args.requiredTrips,
              });
              return route.fulfill({ json: { id: 'new' } });
            }
            const payload = {
              MyProfile: {
                user: {
                  uid,
                  fullName: 'Voucher Preview',
                  email: user.email,
                  phone: '09123456789',
                  role,
                },
              },
              MyNotifications: { notifications: [] },
              AdminVouchers: { vouchers: adminOffers() },
              AdminSailings: { sailings: [], totalCount: 0 },
              AdminLoyaltySettings: {
                settings: {
                  tripsPerReward: 5,
                  silverReward: 100,
                  goldReward: 200,
                  platinumReward: 300,
                  expiryDays: 90,
                },
              },
            }[operation];
            assert.notEqual(payload, undefined, `Unexpected operation ${operation}`);
            return route.fulfill({ json: payload });
          });
          const page = await context.newPage();
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(`${base}${role === 'PASSENGER' ? '/vouchers' : '/admin/vouchers'}`);
          await page
            .getByRole('heading', {
              name: role === 'PASSENGER' ? 'Claim vouchers' : 'Voucher directory',
              exact: true,
            })
            .waitFor();
          if (role === 'PASSENGER') {
            await page.locator('.promo-card').first().waitFor();
            assert.equal(await page.locator('.promo-card').count(), 2);
            assert.equal(
              await page
                .locator('ion-app')
                .evaluate((el) => el.classList.contains('passenger-preview')),
              true,
            );
            const layout = await page.evaluate(() => {
              const canvas = document.querySelector('ion-router-outlet').getBoundingClientRect();
              const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
              const cards = [...document.querySelectorAll('.promo-card')].map((el) =>
                el.getBoundingClientRect(),
              );
              return {
                width: canvas.width,
                left: canvas.left,
                navWidth: nav.width,
                navLeft: nav.left,
                singleColumn: cards[1].top >= cards[0].bottom,
              };
            });
            assert.ok(
              Math.abs(layout.width - Math.min(width, 560)) <= 1,
              'Use the shared passenger canvas',
            );
            assert.ok(
              Math.abs(layout.navWidth - layout.width) <= 1 &&
                Math.abs(layout.navLeft - layout.left) <= 1,
              'Navigation stays inside the passenger canvas',
            );
            assert.equal(layout.singleColumn, true, 'Voucher cards use the passenger column');
            await page.locator('.claim-intro summary').click();
            assert.equal(await page.locator('.claim-intro').getAttribute('open'), '');
            await page.locator('.claim-intro summary').click();
            assert.equal(
              await page
                .getByRole('button', { name: 'Claim Frequent sailor reward', exact: true })
                .isDisabled(),
              true,
            );
            assert.equal(await page.locator('.claimed-code').count(), 0);
            const contrast = await page
              .getByRole('button', { name: 'Claim Weekend sailing treat', exact: true })
              .evaluate((el) => {
                const lum = (color) =>
                  color
                    .match(/[\d.]+/g)
                    .slice(0, 3)
                    .map(Number)
                    .map((n) => n / 255)
                    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
                    .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
                const css = getComputedStyle(el),
                  a = lum(css.color),
                  b = lum(css.backgroundColor);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              });
            assert.ok(contrast >= 4.5, `Claim button text contrast ${contrast}`);
            assert.equal(
              await page.locator('.bottom-nav a[aria-current="page"]').getAttribute('href'),
              '/profile',
            );
            await page.screenshot({
              path: `${directory}/available-${width}-${theme}.png`,
              fullPage: true,
            });
            await page
              .getByRole('button', { name: 'Claim Weekend sailing treat', exact: true })
              .click();
            await page.locator('.claimed-code code').filter({ hasText: 'EVENT50' }).waitFor();
            await page
              .getByRole('button', { name: 'Copy code for Weekend sailing treat', exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => sessionStorage.getItem('copied-voucher')),
              'EVENT50',
            );
            assert.equal(await page.locator('.book-link').count(), 2);
            await page.screenshot({
              path: `${directory}/claimed-${width}-${theme}.png`,
              fullPage: true,
            });
            if (width === 1366 && theme === 'light') {
              fail = true;
              await page.getByRole('button', { name: 'Refresh', exact: true }).click();
              await page.locator('.wallet-state[role="alert"]').waitFor();
              fail = false;
              await page.getByRole('button', { name: 'Try again', exact: true }).click();
              await page.locator('.promo-card').first().waitFor();
              empty = true;
              await page.getByRole('button', { name: 'Available', exact: false }).click();
              await page.getByRole('button', { name: 'Refresh', exact: true }).click();
              await page
                .getByRole('heading', { name: 'No vouchers available right now', exact: true })
                .waitFor();
              await page.screenshot({ path: `${directory}/empty.png` });
              await page.goto(`${base}/profile`);
              await page.locator('a[href="/vouchers"]').first().click();
              await page.getByRole('heading', { name: 'Claim vouchers', exact: true }).waitFor();
            }
          } else {
            await page.locator('tbody tr').first().waitFor();
            assert.equal(
              await page.locator('thead th').count(),
              6,
              'Keep a compact six-column directory',
            );
            const rowCells = await page.locator('tbody tr').first().locator('td').count();
            assert.equal(rowCells, 6, 'Every row matches the table headings');
            assert.equal(
              await page.locator('.voucher-identity .status-badge').count(),
              6,
              'Keep the status beside voucher identity',
            );
            await page
              .getByRole('button', { name: 'Edit details for FIXTURE-event', exact: true })
              .click();
            await page.locator('.voucher-dialog').waitFor();
            await page.getByLabel(/^Mission/).selectOption('TRIPS');
            await page.getByLabel('Completed trips required', { exact: false }).fill('2');
            await page.getByLabel(/^Claim limit/).fill('10');
            await page.waitForTimeout(400);
            await page.screenshot({
              path: `${directory}/admin-edit-${width}-${theme}.png`,
              fullPage: true,
            });
            await page.locator('.voucher-dialog button[type="submit"]').click();
            await page.locator('.voucher-dialog').waitFor({ state: 'hidden' });
            assert.equal(updated.requiredTrips, 2);
            assert.equal(updated.usageLimit, 10);
            await page
              .getByRole('button', { name: 'Edit details for FIXTURE-event', exact: true })
              .click();
            await page.getByLabel(/^Mission/).selectOption('NONE');
            await page.locator('.voucher-dialog button[type="submit"]').click();
            await page.locator('.voucher-dialog').waitFor({ state: 'hidden' });
            assert.equal(updated.requiredTrips, 0);
            await page
              .getByRole('button', { name: 'Edit details for HOLIDAY50', exact: true })
              .click();
            assert.equal(await page.getByLabel(/^Mission/).isDisabled(), true);
            await page.getByRole('button', { name: 'Close voucher details', exact: true }).click();
            await page.locator('.voucher-dialog').waitFor({ state: 'hidden' });
            await page.getByRole('button', { name: 'Create voucher', exact: true }).click();
            await page.locator('.voucher-dialog').waitFor();
            await page.waitForTimeout(400);
            await page.screenshot({
              path: `${directory}/admin-create-top-${width}-${theme}.png`,
              fullPage: true,
            });
            await page.getByLabel('Promo name', { exact: true }).fill('Weekend bonus');
            await page
              .getByLabel('Promo description', { exact: true })
              .fill('A promo for passengers who complete three trips.');
            await page.getByLabel(/^Mission/).selectOption('TRIPS');
            await page.getByLabel('Completed trips required', { exact: false }).fill('3');
            const local = (days) =>
              new Date(now + days * 86400000 + 8 * 3600000).toISOString().slice(0, 16);
            await page.getByLabel('Starts (Philippine time)', { exact: true }).fill(local(0));
            await page.getByLabel('Expires (Philippine time)', { exact: true }).fill(local(7));
            await page.waitForTimeout(400);
            const modalLayout = await page.locator('form.voucher-dialog').evaluate((el) => {
              const footer = el.querySelector('.form-footer').getBoundingClientRect(),
                body = el.querySelector('.form-scroll');
              return {
                footerVisible: footer.bottom <= innerHeight && footer.top >= 0,
                bodyFits: body.scrollWidth <= body.clientWidth + 1,
                sections: el.querySelectorAll('.form-section').length,
              };
            });
            assert.equal(modalLayout.footerVisible, true, 'Create actions remain visible');
            assert.equal(modalLayout.bodyFits, true, 'Create fields stay inside the dialog');
            assert.equal(modalLayout.sections, 3);
            await page.screenshot({
              path: `${directory}/admin-mission-${width}-${theme}.png`,
              fullPage: true,
            });
            await page.locator('.voucher-dialog button[type="submit"]').click();
            await page.locator('.voucher-dialog').waitFor({ state: 'hidden' });
            assert.equal(saved.claimable, true);
            assert.equal(saved.requiredTrips, 3);
            assert.equal(saved.title, 'Weekend bonus');
            await page.screenshot({
              path: `${directory}/admin-directory-${width}-${theme}.png`,
              fullPage: true,
            });
          }
          assert.equal(
            await page
              .locator('main')
              .first()
              .evaluate((el) => el.scrollWidth > el.clientWidth + 1),
            false,
            `${role} ${width} horizontal overflow`,
          );
          await context.close();
          console.log(`${role} ${width}px ${theme}: claim/mission workflow passed`);
        }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
