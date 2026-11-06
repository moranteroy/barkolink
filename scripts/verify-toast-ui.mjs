import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

// Exercise the real component, animations, and queue without account requests.
const fixture = `<!doctype html><html><head><title>Toast UI check</title></head><body>
<div id="app" style="width:min(560px,100%);margin:auto;transform:translateZ(0);height:100vh"></div>
<script type="module">
import { createApp, h } from 'vue';
import ToastHost from '/src/components/shared/ToastHost.vue';
import * as feedback from '/src/composables/toast.ts';
import '/src/theme/variables.css';
createApp({ render: () => h(ToastHost) }).mount('#app');
window.toastCheck = feedback;
</script></body></html>`;
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [
    {
      name: 'toast-ui-fixture',
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (request.url !== '/__toast-check') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml(request.url, fixture));
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  fs.mkdirSync('.audit/toasts', { recursive: true });
  for (const [width, height] of [
    [1366, 768],
    [768, 900],
    [390, 844],
    [320, 640],
  ]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/__toast-check');
      await page.waitForFunction(() => !!window.toastCheck);
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        window.maxToastCount = 0;
        const observe = () =>
          (window.maxToastCount = Math.max(
            window.maxToastCount,
            document.querySelectorAll('.app-toast').length,
          ));
        new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
        window.toastCheck.notifySuccess('Profile updated successfully.');
        window.toastCheck.notifySuccess('  Profile updated successfully.  ');
        window.toastCheck.notifyError('Could not save the next change. Please try again.');
        window.toastCheck.notifySuccess('Contact number saved.');
      }, theme);
      const toast = page.locator('.app-toast');
      await toast.waitFor();
      await page.waitForFunction(
        () => !document.querySelector('.toast-enter-active, .toast-leave-active'),
      );
      assert.equal(
        await page.evaluate(() => window.toastCheck.toastMessages.value.length),
        3,
        'Duplicates do not accumulate',
      );
      assert.equal(
        await page.locator('.toast-host').evaluate((el) => el.parentElement === document.body),
        true,
        'Toast position is independent of the centered app canvas',
      );
      const box = await toast.boundingBox();
      const inset = width <= 600 ? 12 : 16;
      assert.ok(
        Math.abs(width - box.x - box.width - inset) <= 1,
        `Toast is anchored to the right edge: ${JSON.stringify({ width, box, inset })}`,
      );
      assert.ok(
        box.x >= 0 && box.y >= 0 && box.x + box.width <= width,
        'Toast stays within the viewport',
      );
      if (width > 600) assert.ok(box.width <= 400, 'Desktop toast remains compact');
      await page.screenshot({
        path: `.audit/toasts/${theme}-${width}.png`,
        animations: 'disabled',
      });
      await page.getByRole('button', { name: 'Dismiss notification' }).click();
      await page.locator('.app-toast.error').waitFor();
      await page.getByRole('button', { name: 'Dismiss notification' }).click();
      await page.waitForFunction(
        () => document.querySelector('.app-toast p')?.textContent === 'Contact number saved.',
      );
      assert.equal(
        await page.evaluate(() => window.maxToastCount),
        1,
        'Incoming and outgoing toasts never overlap, including during animations',
      );
      await page.evaluate(() => window.toastCheck.clearToasts());
      await toast.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log(
    'Toast browser checks passed: right edge positioning, centered/translated app containers, desktop/tablet/mobile, light/dark, duplicate suppression, FIFO dismissal, and no overlapping toast elements during real animations. Screenshots: .audit/toasts',
  );
} finally {
  await browser?.close();
  await server.close();
}
