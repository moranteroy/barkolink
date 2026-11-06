import fs from 'node:fs';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { verifyTicketQrUi } from './verify-ticket-qr-ui.mjs';

fs.mkdirSync('.audit/mobile-ticket-actions', { recursive: true });
await verifyTicketQrUi({
  widths: [320, 360, 390, 430, 560],
  roles: ['PASSENGER'],
  setupContext: (context) =>
    context.addInitScript(() => {
      window.print = () => {
        window.__ticketPrinted = true;
      };
    }),
  afterPassenger: async (page, width, payload) => {
    const toolbar = page.locator('.ticket-actions');
    for (const scale of [1, 1.5]) {
      await toolbar
        .locator('button')
        .evaluateAll(
          (nodes, scale) => nodes.forEach((el) => (el.style.fontSize = 12 * scale + 'px')),
          scale,
        );
      const boxes = await toolbar.locator('button').evaluateAll((nodes) =>
        nodes.map((el) => {
          const b = el.getBoundingClientRect();
          return { top: b.top, height: b.height, scroll: el.scrollWidth, client: el.clientWidth };
        }),
      );
      assert.equal(boxes.length, 3);
      assert.ok(
        Math.max(...boxes.map((b) => b.top)) - Math.min(...boxes.map((b) => b.top)) < 1,
        'Action tops align',
      );
      assert.ok(
        Math.max(...boxes.map((b) => b.height)) - Math.min(...boxes.map((b) => b.height)) < 1,
        'Action heights match',
      );
      assert.ok(
        boxes.every((b) => b.height >= 44 && b.scroll <= b.client + 1),
        'Labels fit accessible action buttons',
      );
      await page.locator('ion-content').evaluate(async (el) => {
        const scroll = await el.getScrollElement();
        scroll.scrollTop = 0;
      });
      await page.screenshot({
        path: '.audit/mobile-ticket-actions/toolbar-' + width + '-' + scale + '.png',
      });
    }
    const [printed] = await Promise.all([
      page.waitForEvent('popup'),
      toolbar.getByRole('button', { name: 'Print/PDF', exact: true }).click(),
    ]);
    await printed.waitForFunction(() => window.__ticketPrinted === true);
    await printed.emulateMedia({ media: 'print' });
    assert.equal(
      await printed.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(255, 255, 255)',
    );
    assert.match(await printed.locator('body').textContent(), /QR-BOOKING/);
    assert.equal(await printed.locator('ion-tab-bar').count(), 0);
    const frame = await printed
      .locator('img')
      .first()
      .evaluate((img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return {
          width: canvas.width,
          height: canvas.height,
          data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
        };
      });
    assert.equal(jsQR(new Uint8ClampedArray(frame.data), frame.width, frame.height)?.data, payload);
    await printed.screenshot({
      path: '.audit/mobile-ticket-actions/print-' + width + '.png',
      fullPage: true,
    });
    await printed.close();
  },
});
