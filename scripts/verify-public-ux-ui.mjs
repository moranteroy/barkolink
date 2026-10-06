import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route(`${projectUrl}/**`, async route => {
      if (route.request().url().includes('/auth/')) return route.fulfill({ status: 401, json: { message: 'Not signed in' } })
      const { operation } = route.request().postDataJSON()
      const fixture = { BrowseSailings: { sailings: [] }, BrowseActivePorts: { ports: [] }, ActiveAdvisories: { advisories: [] } }[operation]
      assert.ok(fixture, `Unexpected guest operation: ${operation}`)
      return route.fulfill({ json: fixture })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const path of ['/search?all=1', '/help', '/privacy']) {
      await page.goto(baseUrl + path)
      await page.locator('h1').waitFor()
      assert.equal(new URL(page.url()).pathname, path.split('?')[0])
      assert.equal(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth + 2), false)
      assert.equal(await page.locator('[role=alert]').count(), 0)
      if (path !== '/privacy') assert.equal(await page.getByRole('link', { name: 'Sign in', exact: true }).count(), 1)
      await page.waitForTimeout(650)
      assert.notEqual(await page.title(), 'BarkoLink')
    }
    await page.goto(baseUrl + '/bookings')
    await page.waitForURL(url => url.pathname === '/login')
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('Public browsing/help/privacy and protected booking checks passed at desktop and mobile widths with isolated fixtures.')
} finally { await browser.close() }
