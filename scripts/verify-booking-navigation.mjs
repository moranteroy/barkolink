import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8111'
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const ports = [{ id: 'bat', code: 'BAT', name: 'Batangas Port', city: 'Batangas' }, { id: 'cal', code: 'CAL', name: 'Calapan Port', city: 'Calapan' }]
const departure = new Date(Date.now() + 86400000 * 2)
const dateKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const sailing = { id: 's1', code: 'MVO-001', status: 'SCHEDULED', origin: ports[0], destination: ports[1], vessel: { id: 'v1', name: 'Mindoro Voyager', code: 'MVO', passengerCapacity: 200 }, departureAt: departure.toISOString(), arrivalAt: new Date(+departure + 7200000).toISOString(), durationMinutes: 120, regularFare: 528, studentFare: 400, seniorFare: 400, pwdFare: 400, childFare: 200, availableSeats: 50 }
const reverse = { ...sailing, id: 's2', code: 'MVO-002', origin: ports[1], destination: ports[0], departureAt: new Date(+departure + 86400000).toISOString(), arrivalAt: new Date(+departure + 86400000 + 7200000).toISOString() }
async function verify() {
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await context.addInitScript(() => localStorage.setItem('barkolink-search-passengers', '8'))
    await context.route('https://www.google.com/**', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }))
    await context.route(`${projectUrl}/**`, route => {
      if (route.request().url().includes('/auth/')) return route.fulfill({ status: 401, json: { message: 'Not signed in' } })
      const { operation } = route.request().postDataJSON()
      const fixture = { BrowseSailings: { sailings: [sailing, reverse] }, BrowseActivePorts: { ports }, ActiveAdvisories: { advisories: [] } }[operation]
      assert.ok(fixture, `Unexpected operation: ${operation}`)
      return route.fulfill({ json: fixture })
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const visible = selector => page.locator(`.ion-page:not(.ion-page-hidden):not(.ion-page-invisible) ${selector}`)
    const home = async () => {
      await visible('header').getByRole('link', { name: 'BarkoLink home' }).click()
      await page.waitForURL(url => url.pathname === '/')
      await page.waitForTimeout(650)
      await visible('.route-card').first().waitFor()
    }
    await page.goto(baseUrl)
    await visible('.route-card').first().waitFor()
    for (const selector of ['.hero-actions', '.cta-section', '.landing-nav']) {
      if (selector === '.landing-nav' && width === 390) await visible('.menu-toggle').click()
      await visible(selector).getByRole('link', { name: /Book a Trip|Book Now/ }).last().click()
      await page.waitForURL(url => url.pathname === '/search' && url.searchParams.get('all') === '1')
      await page.waitForTimeout(650)
      await visible('.trip-card').first().waitFor()
      assert.equal(await visible('.trip-card').count(), 2)
      assert.equal(await visible('h1').textContent(), 'Available trips')
      if (selector === '.hero-actions') {
        await visible('.search-tools').getByRole('button', { name: 'Modify search' }).click()
        await visible('.search-card select').nth(0).selectOption('Calapan')
        await visible('.search-card select').nth(1).selectOption('Batangas')
        await visible('input[type=date]').fill(dateKey(new Date(reverse.departureAt)))
        await visible('.search-button').click()
        await page.waitForURL(url => url.pathname === '/search' && !url.search)
        await page.waitForFunction(() => document.querySelector('.search-page h1')?.textContent.includes('Calapan'))
        await visible('.trip-card').first().waitFor()
        assert.match(await visible('h1').textContent(), /Calapan.*Batangas/)
        assert.equal(await visible('.trip-card').count(), 1)
      }
      await home()
    }
    await visible('#routes').getByRole('button', { name: 'Find Batangas to Calapan sailings' }).click()
    await page.waitForURL(url => url.pathname === '/search' && !url.search)
    await page.waitForTimeout(650)
    await visible('.trip-card').first().waitFor()
    assert.equal(await visible('.trip-card').count(), 1)
    assert.match(await visible('h1').textContent(), /Batangas.*Calapan/)
    await visible('.time-filters button').filter({ hasText: 'Evening' }).click()
    await home()
    await visible('.search-frame select').nth(0).selectOption('Calapan')
    await visible('.search-frame select').nth(1).selectOption('Batangas')
    await visible('.search-frame input[type=date]').fill(dateKey(new Date(reverse.departureAt)))
    await visible('.search-button').click()
    await page.waitForURL(url => url.pathname === '/search' && !url.search)
    await page.waitForTimeout(650)
    await visible('.trip-card').first().waitFor()
    assert.match(await visible('h1').textContent(), /Calapan.*Batangas/)
    assert.equal(await visible('.trip-card').count(), 1)
    await home()
    await visible('.search-frame input[type=date]').fill(dateKey(new Date(+departure + 86400000 * 5)))
    await visible('.search-button').click()
    await visible('.no-trips').waitFor()
    await page.waitForTimeout(650)
    await visible('.no-trips').getByRole('button', { name: 'Change search' }).click()
    assert.equal(new URL(page.url()).pathname, '/search')
    await visible('.search-card').waitFor()
    await visible('input[type=date]').fill(dateKey(new Date(reverse.departureAt)))
    await visible('.search-button').click()
    await visible('.trip-card').first().waitFor()
    await visible('.trip-card').getByRole('button', { name: 'Book this sailing' }).click()
    await page.waitForURL(url => url.pathname === '/login')
    assert.equal(new URL(page.url()).searchParams.get('redirect'), '/trip-details')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('barkolink-selected-trip')).id), reverse.code)
    assert.deepEqual(errors, [])
    console.log(`Booking links, repeat search, empty search recovery and guest login redirect passed: ${width}px`)
    await context.close()
  }
} finally { await browser.close() }
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
