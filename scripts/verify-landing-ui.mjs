import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const ports = [{ id: 'bat', code: 'BAT', name: 'Batangas Port', city: 'Batangas' }, { id: 'cal', code: 'CAL', name: 'Calapan Port', city: 'Calapan' }]
const date = new Date(Date.now() + 86400000 * 2)
const sailing = { id: 's1', code: 'MVO-001', status: 'SCHEDULED', origin: ports[0], destination: ports[1], vessel: { id: 'v1', name: 'Mindoro Voyager', code: 'MVO', passengerCapacity: 200 }, departureAt: date.toISOString(), arrivalAt: new Date(+date + 7200000).toISOString(), durationMinutes: 120, regularFare: 528, studentFare: 400, seniorFare: 400, pwdFare: 400, childFare: 200, availableSeats: 50 }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
fs.mkdirSync('docs/screenshots/landing', { recursive: true })
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' })
    await context.addInitScript(theme => localStorage.setItem('barkolink-theme', theme), theme)
    let state = 'ready'
    await context.route('https://www.google.com/**', route => route.fulfill({ body: '<html><body>Map preview</body></html>', contentType: 'text/html' }))
    await context.route(`${projectUrl}/**`, route => {
      if (route.request().url().includes('/auth/')) return route.fulfill({ status: 401, json: { message: 'Not signed in' } })
      const { operation } = route.request().postDataJSON()
      if (operation === 'BrowseSailings' && state === 'error') return route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      const fixture = { BrowseSailings: { sailings: state === 'empty' ? [] : [sailing] }, BrowseActivePorts: { ports }, ActiveAdvisories: { advisories: [] } }[operation]
      assert.ok(fixture, `Unexpected public operation: ${operation}`)
      return route.fulfill({ json: fixture })
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(baseUrl)
    await page.locator('.route-card').waitFor()
    await page.waitForTimeout(700)
    assert.equal(await page.locator('.landing-page h1').count(), 1)
    assert.equal(await page.locator('.fleet-card h3').textContent(), 'Mindoro Voyager')
    const overflow = await page.locator('.landing-page').evaluate(root => [...root.querySelectorAll('section, .landing-card, .search-card, input, select')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.left < -2 || b.right > innerWidth + 2) }).map(el => el.className))
    assert.deepEqual(overflow, [], `${theme} ${width}: overflow`)
    await page.screenshot({ path: `docs/screenshots/landing/${theme}-${width}.png` })
    if (width <= 768) {
      const toggle = page.getByRole('button', { name: 'Open navigation', exact: true })
      await toggle.click()
      assert.equal(await page.locator('#landing-mobile-menu').isVisible(), true)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#landing-mobile-menu').count(), 0)
      assert.equal(await toggle.evaluate(el => el === document.activeElement), true)
      await toggle.click()
      await page.locator('#landing-mobile-menu').getByRole('link', { name: 'Fleet', exact: true }).click()
      assert.equal(await page.locator('#landing-mobile-menu').count(), 0)
      await page.waitForTimeout(300)
      assert.equal(await page.locator('.landing-nav').evaluate(el => el.getBoundingClientRect().top >= -1), true)
      assert.equal(await page.locator('#fleet-heading').evaluate(el => el === document.activeElement), true)
    }
    await page.getByRole('button', { name: 'Find Batangas to Calapan sailings' }).click()
    await page.waitForURL(url => url.pathname === '/trips')
    await page.locator('.trip-card').first().waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('barkolink-search-route'))?.from), 'Batangas')
    await page.goto(baseUrl)
    await page.locator('.search-button:not(:disabled)').waitFor()
    await page.locator('.search-frame input[type=date]').fill(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date))
    await page.locator('.search-button').click()
    await page.waitForURL(url => url.pathname === '/trips')
    await page.locator('.trip-card').first().waitFor()
    if (theme === 'light' && width === 390) {
      state = 'empty'; await page.goto(baseUrl)
      await page.getByText('No upcoming routes with seats available.', { exact: false }).waitFor()
      assert.equal(await page.locator('.route-card').count(), 0)
      state = 'error'; await page.reload()
      await page.locator('#routes [role=alert]').waitFor()
      state = 'ready'; await page.locator('#routes').getByRole('button', { name: 'Try again' }).click()
      await page.locator('.route-card').waitFor()
    }
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`Landing layout, navigation and guest search passed: ${theme}, ${width}px`)
  }
} finally { await browser.close() }
