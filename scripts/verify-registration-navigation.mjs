import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8100';
      const visible = selector => page.locator(`.ion-page:not(.ion-page-hidden):not(.ion-page-invisible) ${selector}`).filter({ visible: true });
      const waitForPath = async path => {
        await page.waitForURL(url => url.pathname === path);
        await page.waitForTimeout(650);
      };
      await page.goto(baseUrl + '/login?redirect=%2Ftrip-details');
      await visible('.auth-mode-tabs').getByRole('link', { name: 'Create account' }).click();
      await waitForPath('/register');
      assert.equal(new URL(page.url()).searchParams.get('redirect'), '/trip-details');
      await visible('#full-name').fill('Navigation Test');
      await visible('#email').fill('navigation@example.invalid');
      await visible('#password').fill('TestPassword123!');
      await visible('#confirm-password').fill('TestPassword123!');
      assert.equal(await visible('#terms').isChecked(), false);
      for (const link of ['.back-link', '.return-link']) {
        await visible('.terms').getByRole('link', { name: 'Privacy notice' }).click();
        await waitForPath('/privacy');
        assert.equal(new URL(page.url()).searchParams.get('from'), 'register');
        assert.equal(new URL(page.url()).searchParams.get('redirect'), '/trip-details');
        assert.equal((await visible('.back-link').textContent()).trim(), 'Back to create account');
        await visible(link).click();
        await waitForPath('/register');
        assert.equal(new URL(page.url()).searchParams.get('redirect'), '/trip-details');
        assert.equal(await visible('#full-name').inputValue(), 'Navigation Test');
        assert.equal(await visible('#email').inputValue(), 'navigation@example.invalid');
        assert.equal(await visible('#password').inputValue(), 'TestPassword123!');
        assert.equal(await visible('#confirm-password').inputValue(), 'TestPassword123!');
        assert.equal(await visible('#terms').isChecked(), false);
      }
      await visible('#terms').check();
      await visible('.terms').getByRole('link', { name: 'Privacy notice' }).click();
      await waitForPath('/privacy');
      await page.goBack();
      await waitForPath('/register');
      assert.equal(await visible('#terms').isChecked(), true);
      assert.equal(await visible('#password').inputValue(), 'TestPassword123!');
      await visible('.switch-copy').getByRole('link', { name: 'Sign in' }).click();
      await waitForPath('/login');
      assert.equal(new URL(page.url()).searchParams.get('redirect'), '/trip-details');
      assert.equal(await visible('#password').inputValue(), '');
      await page.goto(baseUrl + '/privacy');
      await visible('.back-link').waitFor();
      assert.equal(await visible('.back-link').getAttribute('href'), '/');
      await visible('.return-link').click();
      await waitForPath('/register');
      assert.equal(await visible('#terms').isChecked(), false);
      assert.deepEqual(errors, []);
      console.log(`Registration/privacy return, form preservation, manual acknowledgement and booking redirect passed: ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
