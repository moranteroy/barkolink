import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

// Local production bundle, actual CSP headers, and synthetic Auth responses only.
const root = path.resolve('dist');
const headers = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers;
const server = http.createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const candidate = path.resolve(root, '.' + requested);
  if (!candidate.startsWith(root + path.sep) && candidate !== root) {
    response.writeHead(404).end();
    return;
  }
  const file =
    fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, 'index.html');
  for (const header of headers) response.setHeader(header.key, header.value);
  const types = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  // Read only the browser-public project URL; never load private credential files.
  const env = fs.readFileSync('.env.local', 'utf8');
  const project = env
    .match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  assert.ok(project, 'Configured public Supabase URL required for bundled client verification.');
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'security-test@example.invalid',
    aud: 'authenticated',
    app_metadata: { role: 'ADMIN' },
    user_metadata: { fullName: 'Security Test' },
    factors: [{ id: 'test-factor', factor_type: 'totp', status: 'verified' }],
  };
  const setupUri =
    'otpauth://totp/BarkoLink:security-test%40example.invalid?secret=JBSWY3DPEHPK3PXP&issuer=BarkoLink&algorithm=SHA1&digits=6&period=30';
  const setupQr = await QRCode.toString(setupUri, { type: 'svg' });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, aal: 'aal1', role: 'authenticated', app_metadata: user.app_metadata })}.fixture`,
    refresh_token: 'synthetic-refresh',
    expires_at: exp,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${new URL(project).hostname.split('.')[0]}-auth-token`, session },
  );
  const observed = [];
  await context.route(`${project}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    observed.push(url.pathname);
    if (url.pathname.endsWith('/rpc/my_mfa_settings'))
      return route.fulfill({
        json: {
          role: user.app_metadata.role,
          enabled: true,
          authenticatorLinked: true,
          staffRequired: true,
          policyRequired: user.app_metadata.role !== 'ADMIN',
          mfaRequired: true,
        },
      });
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
    if (url.pathname.endsWith('/factors') && request.method() === 'POST')
      return route.fulfill({
        json: {
          id: 'setup-factor',
          type: 'totp',
          totp: { qr_code: setupQr, secret: 'SYNTHETIC-SETUP-KEY', uri: setupUri },
        },
      });
    if (url.pathname.endsWith('/rpc/barkolink_execute')) {
      const body = request.postDataJSON();
      assert.ok(
        ['MyNotifications'].includes(body.operation),
        'Privileged data RPC must not run before MFA.',
      );
      return route.fulfill({ json: { notifications: [] } });
    }
    throw new Error(`Unexpected backend request: ${url.pathname}`);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.securityPolicyViolations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      window.securityPolicyViolations.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
        source: event.sourceFile,
        line: event.lineNumber,
        sample: event.sample,
      }),
    );
  });
  await page.goto(`${base}/admin`);
  await page.waitForURL('**/verify-staff');
  await page.getByRole('heading', { name: 'Verify admin access' }).waitFor();
  await page.getByRole('button', { name: 'Verify and continue' }).waitFor();
  assert.equal(await page.locator('input').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.deepEqual(await page.evaluate(() => window.securityPolicyViolations), []);
  assert.deepEqual(errors, []);
  assert.ok(observed.some((value) => value.endsWith('/user')));
  fs.mkdirSync('.audit/mfa-ui', { recursive: true });
  for (const role of ['ADMIN', 'BOARDING', 'TICKETING']) {
    user.app_metadata.role = role;
    for (const enrolling of [false, true]) {
      user.factors = enrolling
        ? []
        : [{ id: 'test-factor', factor_type: 'totp', status: 'verified' }];
      const label = { ADMIN: 'admin', BOARDING: 'boarding staff', TICKETING: 'ticketing staff' }[
        role
      ];
      for (const theme of ['light', 'dark']) {
        for (const viewport of [
          { width: 1240, height: 580 },
          { width: 390, height: 844 },
          { width: 320, height: 640 },
        ]) {
          await page.setViewportSize(viewport);
          await page.reload();
          await page
            .getByRole('heading', {
              name: enrolling ? `Set up ${label} verification` : `Verify ${label} access`,
              exact: true,
            })
            .waitFor();
          await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
          if (enrolling) {
            const qr = page.getByAltText('Authenticator setup QR code');
            await qr.waitFor();
            await qr.evaluate((img) => img.decode());
            assert.ok(await qr.evaluate((img) => img.naturalWidth > 0), 'Setup QR image renders');
            const pixels = await qr.evaluate((img) => {
              const width = Math.round(img.getBoundingClientRect().width);
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = width;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, width);
              return { width, data: Array.from(ctx.getImageData(0, 0, width, width).data) };
            });
            assert.equal(
              jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.width)?.data,
              setupUri,
              'Rendered authenticator QR decodes to the exact enrollment URI',
            );
          }
          const input = page.getByLabel('Authenticator code', { exact: true });
          await input.fill('123456');
          assert.equal(
            await page.getByRole('button', { name: 'Verify and continue' }).isEnabled(),
            true,
          );
          const geometry = await page.locator('.mfa-panel').evaluate((el) => ({
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
            scroll: el.scrollWidth,
            client: el.clientWidth,
          }));
          assert.ok(
            geometry.width <= viewport.width,
            `Panel fits viewport: ${JSON.stringify({ role, enrolling, viewport, geometry })}`,
          );
          assert.ok(geometry.scroll <= geometry.client, 'Panel has no horizontal overflow');
          if (role !== 'TICKETING' && viewport.width !== 320)
            await page.screenshot({
              path: `.audit/mfa-ui/${role.toLowerCase()}-${enrolling ? 'setup' : 'verify'}-${theme}-${viewport.width}.png`,
              fullPage: true,
            });
          if (viewport.width === 1240)
            assert.ok(
              geometry.height + 32 <= viewport.height,
              `Desktop card fits without scrolling: ${JSON.stringify({ role, enrolling, theme, geometry })}`,
            );
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.securityPolicyViolations), []);
  console.log(
    'Production browser checks passed: admin/boarding/ticketing roles, verification and enrollment, light/dark themes, desktop/mobile layouts, and CSP. Screenshots: .audit/mfa-ui',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
