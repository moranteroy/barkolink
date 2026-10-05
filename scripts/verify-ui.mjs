import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8100'
const output = new URL('../docs/screenshots/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = []
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, colorScheme: 'light', reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    // Auth submissions are intercepted: this check never creates accounts or changes data.
    let authRequests = 0
    await page.route('**/auth/v1/**', async route => {
      authRequests++
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error_code: 'invalid_credentials', code: 'invalid_credentials', message: 'Invalid login credentials' }) })
    })
    const device = viewport.width > 700 ? 'desktop' : 'mobile'
    for (const [path, heading] of [['/', 'Less waiting.'], ['/login', 'Welcome back'], ['/register', 'Create your account'], ['/privacy', 'Privacy notice']]) {
      await page.goto(baseUrl + path)
      await page.getByRole('heading', { name: new RegExp(heading.replace('.', '\\.')) }).first().waitFor()
      await page.waitForTimeout(350)
      const overflow = await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth + 2)
      assert.equal(overflow, false, `${device} ${path} horizontal overflow`)
      if (path !== '/privacy') await page.screenshot({ path: fileURLToPath(new URL(`${device}-${path === '/' ? 'landing' : path.slice(1)}.png`, output)) })
    }
    await page.goto(baseUrl + '/register')
    await page.getByRole('heading', { name: 'Create your account' }).waitFor()
    await page.locator('#full-name').fill('UI Test')
    await page.locator('#email').fill('ui-test@example.invalid')
    await page.locator('#password').fill('Password123!')
    await page.locator('#confirm-password').fill('Different123!')
    await page.locator('#terms').check()
    await page.getByRole('button', { name: 'Show password' }).click()
    assert.equal(await page.locator('#password').getAttribute('type'), 'text')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Passwords do not match' }).waitFor()
    assert.equal(authRequests, 0, 'Invalid registration must not submit to Supabase')
    await page.goto(baseUrl + '/login')
    await page.locator('#email').fill('ui-test@example.invalid')
    await page.locator('#password').fill('Password123!')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'do not match' }).waitFor()
    assert.equal(authRequests, 1, 'Sign-in should make one request')
    await page.goto(baseUrl + '/')
    await page.locator('.port-map').waitFor()
    const portButtons = page.locator('.port-tabs button')
    if (await portButtons.count() > 1) {
      await portButtons.nth(1).click()
      const selectedPort = (await portButtons.nth(1).innerText()).split('\n')[0]
      assert.ok((await page.locator('.port-map iframe').getAttribute('title')).includes(selectedPort))
      const link = new URL(await page.locator('.map-footer a').getAttribute('href'))
      assert.ok(link.searchParams.get('destination').includes(selectedPort))
    }
    await page.locator('.port-map').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)
    await page.locator('.port-map').screenshot({ path: fileURLToPath(new URL(`${device}-port-guide.png`, output)) })
    await page.locator('ion-content').evaluate(el => el.scrollToTop(0))
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark' })
    await page.screenshot({ path: fileURLToPath(new URL(`${device}-landing-dark.png`, output)) })
    console.log(`${device}: layout, auth validation, password visibility, map switching, and dark theme passed`)
    await context.close()
  }
  const ports = [{ id: 'port-a', code: 'BTG', name: 'Batangas Port', city: 'Batangas', region: 'Batangas', isActive: true }, { id: 'port-b', code: 'CLP', name: 'Calapan Port', city: 'Calapan', region: 'Oriental Mindoro', isActive: true }]
  const trip = { id: 'trip-a', code: 'TRP2027-0101001', origin: ports[0], destination: ports[1], vessel: { id: 'v-a', code: 'FERRY-A', name: 'Test Ferry', passengerCapacity: 100 }, departureAt: '2027-01-01T02:00:00Z', arrivalAt: '2027-01-01T03:30:00Z', durationMinutes: 90, availableSeats: 100, status: 'SCHEDULED', regularFare: 500, studentFare: 400, seniorFare: 400, pwdFare: 400, pregnantFare: 500, childFare: 250 }
  const fixtures = {
    ActiveAdvisories: { advisories: [] },
    BrowseActivePorts: { ports }, BrowseSailings: { sailings: [trip] },
    MyProfile: { user: { id: 'ui-test', fullName: 'UI Test Passenger', email: 'ui-test@example.invalid', role: 'PASSENGER' } },
    MyBookings: { bookings: [] }, MyNotifications: { notifications: [] }, MyTickets: { bookings: [] },
    StaffBookings: { bookings: [], totalCount: 0 }, AdminSailings: { sailings: [trip], totalCount: 1 },
    AdminUsers: { users: [], totalCount: 0 }, AdminPorts: { ports }, AdminVessels: { vessels: [{ ...trip.vessel, isActive: true }] },
    AdminPassengerRecords: { bookingPassengers: [], totalCount: 0 },
    AdminDashboardStats: Object.fromEntries(['todaySailings', 'todayBookings', 'cancelledBookings', 'allPassengers', 'checkedInPassengers', 'boardedPassengers'].map(key => [key, [{ _count: 0 }]])),
    AdminFareSettings: { fareSettings: { regularFare: 500, studentDiscount: 20, seniorDiscount: 20, childDiscount: 50, pwdDiscount: 20, pregnantDiscount: 0 }, vesselFareSettings: [] },
    AdminNextTripCode: { nextTripCode: { code: 'TRP2027-0101002' } },
    BoardingSailings: { sailings: [trip] }, BoardingManifest: { bookings: [] }, BoardingActivity: { boardingEvents: [] },
  }
  for (const [role, paths] of [['ADMIN', ['/admin', '/admin/ports']], ['TICKETING', ['/staff/ticketing']], ['BOARDING', ['/staff/boarding']], ['PASSENGER', ['/home', '/search', '/trip-details']]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'ui-test@example.invalid', app_metadata: { role }, user_metadata: { fullName: 'UI Test' }, aud: 'authenticated', created_at: '2026-10-01T00:00:00Z' }
    const exp = Math.floor(Date.now() / 1000) + 3600
    const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp })).toString('base64url'), 'ui-test-signature'].join('.')
    await context.addInitScript(({ user, jwt, exp, trip }) => {
      localStorage.setItem('sb-utobfkfmuepuoseszxks-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'mock-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }))
      localStorage.setItem('barkolink-theme', 'light')
      localStorage.setItem('barkolink-selected-trip', JSON.stringify({ id: trip.code, from: 'Batangas', to: 'Calapan', originPortName: 'Batangas Port', destinationPortName: 'Calapan Port', departure: '10:00 AM', arrival: '11:30 AM', duration: '1h 30m', date: 'Jan 1, 2027', vessel: 'Test Ferry', available: 100, regularFare: 500, passengerCount: 1 }))
    }, { user, jwt, exp, trip })
    await context.route('https://*.supabase.co/**', async route => {
      if (route.request().url().includes('/auth/v1/user')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) })
      const operation = route.request().postDataJSON()?.operation
      assert.ok(fixtures[operation], `Unexpected operation in UI fixture: ${operation}`)
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixtures[operation]) })
    })
    const page = await context.newPage()
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message) })
    for (const path of paths) {
      await page.goto(baseUrl + path)
      try { await page.locator('main h1').first().waitFor({ timeout: 15000 }) }
      catch (error) {
        console.error('Failed workspace:', role, path, new URL(page.url()).pathname, errors)
        await page.screenshot({ path: fileURLToPath(new URL('workspace-failure.png', output)) })
        throw error
      }
      assert.equal(new URL(page.url()).pathname, path, `Mocked ${role} navigation`)
      await page.waitForTimeout(400)
      assert.equal(await page.locator('[role="alert"]').count(), 0, `${path} error banner`)
      await page.screenshot({ path: fileURLToPath(new URL(`workspace-${path.slice(1).replaceAll('/', '-')}.png`, output)) })
      if (path === '/trip-details' || path === '/admin/ports') assert.equal(await page.locator('.port-map iframe').count(), 1, 'Port map appears in workspace')
      if (path === '/trip-details') {
        const fare = await page.locator('.flow-aside').boundingBox()
        const map = await page.locator('.trip-port-map').boundingBox()
        assert.ok(fare.y + fare.height <= map.y + 2, 'Trip fare and Continue action appear before the port guide')
      }
    }
    console.log(`${role}: workspace rendering passed with isolated browser fixtures`)
    await context.close()
  }
  assert.deepEqual(errors, [], 'Uncaught browser errors')
} finally { await browser.close() }
