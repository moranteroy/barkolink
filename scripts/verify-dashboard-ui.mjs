import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'
import { queryLive, projectRef } from './test-data-database.mjs'

const overview = (await queryLive(`select barkolink_private.camel(barkolink_private.execute_flexible_discounts('AdminOverview','{}',uid,'ADMIN')) as data
  from public.app_user where role='ADMIN' order by created_at,uid limit 1`, false))[0].data
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl = `https://${projectRef}.supabase.co`
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.invalid', app_metadata: { role: 'ADMIN' },
  user_metadata: { fullName: 'Administrator' }, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' }
const exp = Math.floor(Date.now() / 1000) + 3600
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const session = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, role: 'authenticated', app_metadata: { role: 'ADMIN' } })}.fixture`,
  refresh_token: 'fixture', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }
fs.mkdirSync('docs/screenshots/dashboard', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const widths = process.env.BARKOLINK_UI_WIDTHS?.split(',').map(Number) || [1440, 1240, 1024, 768, 390, 320]
  for (const width of widths) for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width, height: 1050 } })
    await context.addInitScript(({ session, key, theme }) => {
      localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('barkolink-theme', theme)
    }, { session, key: `sb-${projectRef}-auth-token`, theme })
    await context.route(`${projectUrl}/**`, async route => {
      if (route.request().url().includes('/auth/')) return route.fulfill({ json: user })
      const { operation } = route.request().postDataJSON()
      const fixtures = { AdminOverview: overview, MyProfile: { user: { fullName: 'Administrator', email: user.email, role: 'ADMIN' } }, MyNotifications: { notifications: [] } }
      if (!fixtures[operation]) throw new Error(`Unexpected dashboard operation: ${operation}`)
      return route.fulfill({ json: fixtures[operation] })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${baseUrl}/admin`)
    await page.locator('.overview-charts').waitFor()
    await page.waitForTimeout(650)
    const problems = await page.locator('.overview-charts').evaluate(root => {
      const issues = []
      for (const card of root.children) {
        const box = card.getBoundingClientRect()
        for (const el of card.querySelectorAll('.month-label,.month-total,.segment-list,.route-label,.donut,.volume-legend')) {
          const bounds = el.getBoundingClientRect()
          if (bounds.left < box.left - 1 || bounds.right > box.right + 1 || bounds.bottom > box.bottom + 1) issues.push(`${el.className} escapes card`)
        }
      }
      const legend = root.querySelector('.volume-legend').getBoundingClientRect()
      const chart = root.querySelector('.volume-chart').getBoundingClientRect()
      if (legend.bottom > chart.top + 1) issues.push('Monthly legend overlaps plot')
      for (const el of root.querySelectorAll('.month-total,.segment-list li,.route-label')) {
        if (el.scrollWidth > el.clientWidth + 2) issues.push(`${el.className || el.tagName} overflows`)
      }
      const content = document.querySelector('main')
      if (content && content.scrollWidth > content.clientWidth + 2) issues.push('Main content overflows')
      return issues
    })
    assert.deepEqual(problems, [], `${width}px ${theme}`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: `docs/screenshots/dashboard/${width}-${theme}.png`, fullPage: true })
    await page.locator('.overview-charts').screenshot({ path: `docs/screenshots/dashboard/charts-${width}-${theme}.png` })
    await context.close()
  }
  console.log(`Dashboard checks passed in both themes at ${widths.join(', ')}px using live aggregate data; all browser backend traffic was intercepted.`)
} finally { await browser.close() }
