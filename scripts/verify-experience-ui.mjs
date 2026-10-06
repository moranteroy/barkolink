import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

// Every Supabase request is intercepted. These checks never use real account tokens or write hosted data.
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110'
const projectUrl = fs.readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const projectRef = new URL(projectUrl).hostname.split('.')[0]
const id = '11111111-1111-4111-8111-111111111111'
const sailing = { code: 'UI-TRIP', departureAt: '2099-01-01T08:00:00Z', arrivalAt: '2099-01-01T10:00:00Z', durationMinutes: 120, status: 'SCHEDULED', availableSeats: 98, regularFare: 600, studentFare: 480, seniorFare: 480, pwdFare: 480, childFare: 300, pregnantFare: 600, origin: { id: 'origin', name: 'Calapan Port', city: 'Calapan' }, destination: { id: 'destination', name: 'Batangas Port', city: 'Batangas' }, vessel: { id: 'vessel', name: 'UI Ferry', passengerCapacity: 100, isActive: true } }
const passenger = { fare: 600, sex: 'FEMALE', id, fullName: 'UI Traveler', passengerType: 'REGULAR', ticketCode: id, ticketStatus: 'ISSUED', checkedInAt: null, boardedAt: null, noShow: false }
const booking = { owner: { fullName: 'UI User', email: 'ui@example.invalid' }, createdAt: '2026-01-01T08:00:00Z', bookingChannel: 'ONLINE', id, reference: 'UI-BOOKING', status: 'CONFIRMED', paymentStatus: 'PAID', total: 600, passengerCount: 1, sailing, bookingPassengers_on_booking: [passenger] }
const advisory = { id, title: 'Terminal reminder', message: 'Keep your booking reference ready.', category: 'GENERAL', priority: 'MEDIUM', sailingCode: null, startsAt: '2000-01-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', published: true }
const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const width of (process.env.BARKOLINK_UI_WIDTHS?.split(',').map(Number) || [1440, 768, 390])) for (const role of ['ADMIN', 'PASSENGER', 'TICKETING', 'BOARDING']) {
    if (process.env.BARKOLINK_UI_ROLE && process.env.BARKOLINK_UI_ROLE !== role) continue
    const context = await browser.newContext({ viewport: { width, height: 950 }, acceptDownloads: true, timezoneId: 'America/Los_Angeles' })
    const user = { id, email: 'ui@example.invalid', app_metadata: { role }, user_metadata: { fullName: 'UI User' }, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' }
    const exp = Math.floor(Date.now() / 1000) + 3600
    const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
    const session = { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: id, exp, role: 'authenticated', app_metadata: { role } })}.test`, refresh_token: 'ui-test', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }
    await context.addInitScript(({ key, session }) => { if (!localStorage.getItem('barkolink-theme')) localStorage.setItem('barkolink-theme', 'light'); localStorage.setItem(key, JSON.stringify(session)) }, { key: `sb-${projectRef}-auth-token`, session })
    let fareConfig = {code:'vessel',regularFare:600,studentDiscount:20,seniorDiscount:20,childDiscount:50,pwdDiscount:20,pregnantDiscount:0,customDiscounts:[]}, fareSaves=0
    let readAt = null, markAllCalls = 0, lastBookingArgs = null, lastAuditArgs = null
    let managedAccountCalls = 0, lastManagedInput = null
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { sessionStorage.setItem('ui-copied-password', text) } } }))
    let profile = { fullName: 'UI User', email: user.email, role, phone: '09123456789' }
    await context.route(`${projectUrl}/**`, async route => {
      const url = route.request().url()
      if (url.includes('/auth/v1/')) return route.fulfill({ json: user })
      if (url.includes('/functions/v1/manage-account')) {
        const { action, input } = route.request().postDataJSON()
        if (action === 'generateTemporaryPassword') return route.fulfill({ json: { password: 'Ui-generated-password123' } })
        assert.equal(action, 'createManagedUser')
        managedAccountCalls++; lastManagedInput = input
        return route.fulfill({ json: { email: input.email, role: input.role } })
      }
      if (!url.includes('/rpc/barkolink_execute')) return route.fulfill({ status: 403, json: { message: 'Direct access is blocked in this test.' } })
      const { operation, args } = route.request().postDataJSON()
      let result
      if (operation === 'TicketingCreateGuestWalkIn') return route.fulfill({ json: {} })
      if (operation === 'AdminSaveFareSettings') { fareConfig={...fareConfig,...args};fareSaves++;result={} }
      else if (operation === 'MyMarkAllNotificationsRead') { markAllCalls++; readAt = new Date().toISOString(); result = { marked: 1 } }
      else if (operation === 'UpdateMyProfile') { profile = { ...profile, fullName: args.fullName, phone: args.phone }; user.user_metadata.fullName = args.fullName; result = { user_update: { uid: id } } }
      else if (operation === 'StaffBookings') { lastBookingArgs = args; const matches = (!args.search || booking.reference.toLowerCase().includes(args.search.toLowerCase())) && (!args.status || args.status === 'ALL' || args.status === 'PAID'); result = { bookings: matches ? [booking] : [], totalCount: matches ? 1 : 0 } }
      else if (operation === 'AdminAuditLog') {
        lastAuditArgs=args
        const fixture=args.entityType==='operation_settings'
          ? {id,actorName:'UI Administrator',actorRole:'ADMIN',actorRoleRecorded:true,action:'UPDATE',entityType:'operation_settings',entityId:'DEFAULT',createdAt:'2026-10-05T01:00:00Z',details:{reservationMinutes:{before:1440,after:720}}}
          : {id,actorName:'UI User',actorRole:'TICKETING',actorRoleRecorded:false,action:'PAYMENT_RECEIVED',entityType:'booking',entityId:'UI-BOOKING',details:{amount:600,status:{after:'COMPLETED',before:'BOARDING'}},createdAt:'2026-10-05T01:00:00Z'}
        const matches=(!args.search || (fixture.actorName+' '+fixture.action+' '+fixture.entityId).toLowerCase().includes(args.search.toLowerCase())) && (!args.action || args.action===fixture.action)
        result={records:matches ? [fixture] : [],totalCount:matches ? 1 : 0,actions:['PAYMENT_RECEIVED','UPDATE']}
      }
      else result = {
        MyProfile: { user: profile },
        MyBookings: { bookings: [booking, { ...booking, id: 'unpaid', reference: 'UI-UNPAID', paymentStatus: 'UNPAID', status: 'PENDING', paymentDeadline: new Date(Date.now() + 3600000).toISOString() }] },
        MyNotifications: { notifications: [{ id, title: 'Booking updated', message: 'Your ticket is ready.', category: 'BOOKING', createdAt: new Date().toISOString(), readAt }] },
        MySavedTravelers: { travelers: [{ id, fullName: 'UI Traveler', birthDate: '1990-01-01', sex: 'FEMALE', phone: '09123456789', nationality: 'Filipino' }] },
        ActiveAdvisories: { advisories: [advisory] }, AdminAdvisories: { advisories: [advisory] },
        AdminSailingOptions: { sailings: [sailing] }, AdminReports: { sailings: [] }, TicketingSailings: { sailings: [sailing] }, AdminSailings: { sailings: [sailing], totalCount: 1 }, BrowseSailings: { sailings: [sailing] },
        BrowseActivePorts: { ports: [sailing.origin, sailing.destination] },
        AdminPorts: { ports: [sailing.origin, sailing.destination] }, AdminVessels: { vessels: [sailing.vessel] },
        AdminSailingBookings:{bookings:[]}, AdminUsers: { users: [{uid:'user-z',fullName:'Zelda User',email:'zelda@example.invalid',role:'PASSENGER',createdAt:'2026-10-05T01:00:00Z'},{uid:'user-a',fullName:'Anna User',email:'anna@example.invalid',role:'TICKETING',createdAt:'2026-10-05T01:00:00Z'},{uid:'user-m',fullName:'Marco User',email:'marco@example.invalid',role:'BOARDING',createdAt:'2026-10-05T01:00:00Z'}],totalCount:3 }, AdminPassengerRecords: { bookingPassengers: [], totalCount: 0 },
        AdminOperationsSettings: { reservationMinutes: 1440 },
        AdminActivityLog: { records: [{ id, actorName: 'UI Administrator', action: 'UPDATE', entityType: 'operation_settings', entityId: 'DEFAULT', createdAt: '2026-10-05T01:00:00Z', details: { reservationMinutes: { before: 1440, after: 720 } } }], totalCount: 1 },
        StaffBookings: { bookings: [booking], totalCount: 1 }, BoardingSailings: { sailings: [sailing] }, BoardingManifest: { bookings: [booking] }, BoardingActivity: { boardingEvents: [] }, AdminDashboardStats: {},
        AdminFareSettings: { fareSettings: null, vesselFareSettings: [fareConfig] }, AdminNextTripCode: { nextTripCode: { code: 'TRP2026-1004001' } },
        AdminOverview: {stats:{todayTrips:1,todayBookings:6,todayPassengers:9,checkedIn:7,boarded:4,noShow:1,cancelled:1,utilization:62},trips:[sailing],monthly:[{month:'May',bookings:10,passengers:18},{month:'Jun',bookings:18,passengers:24},{month:'Jul',bookings:22,passengers:35},{month:'Aug',bookings:25,passengers:41},{month:'Sep',bookings:30,passengers:46},{month:'Oct',bookings:34,passengers:50}],bookingStatus:[{name:'Confirmed',value:35},{name:'Pending',value:7},{name:'Cancelled',value:4}],categories:[{name:'REGULAR',value:30},{name:'STUDENT',value:8},{name:'SENIOR',value:4},{name:'CHILD',value:3}],routes:[{route:'Calapan ? Batangas',passengers:50}]},
        AdminAccommodations: {accommodations:[]}, AdminRoutes:{routes:[]}, AdminNotificationCampaigns:{campaigns:[],totalCount:0},
        StaffSailings:{sailings:[sailing],totalCount:1}, StaffPassengers:{passengers:[{...passenger,booking}],totalCount:1}, StaffFares:{fares:[{vesselName:sailing.vessel.name,regularFare:600,studentDiscount:20,seniorDiscount:20,childDiscount:50,pwdDiscount:20,pregnantDiscount:0,accommodations:[]}]},StaffNoShows:{sailing,passengers:[{...passenger,booking,noShow:false}]},StaffDashboard:{bookings:6,paid:4,unpaid:2,trips:1},
        AdminTripOperations: { sailing, bookings: [booking], passengers: [{ ...passenger, booking }], activity: [] },
      }[operation]
      assert.notEqual(result, undefined, `Unhandled fixture operation: ${operation}`)
      await route.fulfill({ json: result })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if(['error','warning'].includes(message.type()) && message.text().includes('AG Grid')) errors.push(message.text()) })
    const paths = role === 'ADMIN' ? ['/admin', '/admin/accommodation', '/admin/routes', '/admin/no-shows', '/admin/notifications', '/admin/analytics', '/admin/audit-logs', '/admin/advisories', '/admin/trip-operations?sailing=UI-TRIP', '/admin/trips', '/admin/bookings', '/admin/settings/profile', '/admin/settings/password', '/admin/settings/appearance'] : role === 'TICKETING' || role === 'BOARDING' ? [`/staff/${role.toLowerCase()}`, ...((role === 'TICKETING' ? ['bookings','passengers','trips','fares','notifications'] : ['trips','check-in','boarding','manifest','no-shows','notifications']).map(section=>`/staff/${role.toLowerCase()}/${section}`)), ...['account','security','appearance'].map(section => `/staff/${role.toLowerCase()}/settings/${section}`)] : ['/home', '/profile', '/settings/profile', '/settings/password', '/settings/appearance', '/notifications', '/bookings', '/ticket?reference=UI-BOOKING', '/travelers', '/help', '/search?all=1']
    if (role === 'ADMIN') paths.push('/admin/users', '/admin/operations', '/admin/fares')
    if (role === 'ADMIN') paths.push('/admin/manifest', '/admin/inbox')
    if (role === 'TICKETING') paths.push('/staff/ticketing/walk-in')
    if (role === 'PASSENGER') {
      paths.push('/passenger-info', '/booking-confirmed?reference=UI-BOOKING')
      await context.addInitScript(({ sailing }) => localStorage.setItem('barkolink-selected-trip', JSON.stringify({
        id: sailing.code, selectionId: 'ui-check', from: sailing.origin.city, to: sailing.destination.city,
        departureAt: sailing.departureAt, date: 'Jan 1, 2099', departure: '4:00 PM', arrival: '6:00 PM',
        vessel: sailing.vessel.name, available: 98, regularFare: 600, passengerCount: 1,
      })), { sailing })
    }
    const selectedPaths = process.env.BARKOLINK_UI_PATHS?.split(',')
    for (const path of paths.filter(path => !selectedPaths || selectedPaths.includes(path.split('?')[0]))) {
      await page.goto(baseUrl + path)
      await page.locator('h1').first().waitFor()
      await page.waitForTimeout(450)
      const overflow = await page.locator('main').first().evaluate(el => el.scrollWidth > el.clientWidth + 2)
      assert.equal(overflow, false, `${role} ${width}px ${path} overflow`)
      assert.equal(await page.locator('[role=alert]').count(), 0, `${path}: unexpected error`)
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light')
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim()), 'hsl(220 29% 97%)')
      if (['/admin/audit-logs','/staff/ticketing','/staff/boarding','/home'].includes(path)) {
        const selector=role==='ADMIN' ? '.sidebar nav ion-icon' : role==='PASSENGER' ? '.bottom-nav ion-icon' : '.staff-navigation ion-icon'
        const icons=await page.locator(selector).evaluateAll(nodes=>nodes.map(node=>node.icon))
        assert.ok(icons.length>0,`${role}: navigation icons rendered`)
        assert.equal(new Set(icons).size,icons.length,`${role}: each navigation destination has a distinct icon`)
        const brand=role==='PASSENGER' ? '.passenger-header .brand-mark' : 'aside .brand-mark'
        if(role!=='PASSENGER') assert.equal(await page.locator(brand).count(),1,`${role}: one sidebar brand`)
      }
      if (path === '/admin/fares') {
        await page.getByRole('button',{name:'+ Add discount',exact:true}).click()
        await page.getByPlaceholder('Special discount',{exact:true}).fill('Special discount')
        await page.locator('.custom-discount-row').last().getByLabel('Discount (%)',{exact:true}).fill('15')
        assert.ok((await page.locator('.fare-preview').innerText()).includes('PHP 510'))
        await page.getByRole('button',{name:'Save fares & discounts',exact:true}).click()
        await page.getByRole('status').filter({hasText:'Fares & discounts saved'}).waitFor()
        assert.equal(fareConfig.passengerDiscounts.at(-1).name,'Special discount')
        assert.equal(fareConfig.passengerDiscounts.at(-1).percentage,15)
        await page.getByRole('button',{name:'Refresh',exact:true}).click()
        assert.equal(await page.getByPlaceholder('Special discount',{exact:true}).inputValue(),'Special discount')
        assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth > el.clientWidth+2),false)
        await page.locator('.custom-discount-row').last().getByLabel('Active',{exact:true}).uncheck()
        await page.getByRole('button',{name:'Save fares & discounts',exact:true}).click()
        await page.waitForTimeout(100)
        assert.equal(fareConfig.passengerDiscounts.at(-1).isActive,false)
        await page.getByRole('button',{name:'Delete discount Special discount',exact:true}).click()
        await page.getByRole('button',{name:'Save fares & discounts',exact:true}).click()
        await page.waitForTimeout(100)
        assert.equal(fareConfig.passengerDiscounts.length,5)
        assert.equal(fareSaves,3)
        const student=page.locator('.custom-discount-row').first()
        await student.getByRole('textbox').fill('Scholar')
        await student.getByRole('spinbutton').fill('35')
        await page.getByRole('button',{name:'Save fares & discounts',exact:true}).click()
        await page.waitForTimeout(100)
        assert.equal(fareConfig.passengerDiscounts[0].name,'Scholar')
        assert.equal(fareConfig.passengerDiscounts[0].percentage,35)
        await page.getByRole('button',{name:'Delete discount Scholar',exact:true}).click()
        await page.getByRole('button',{name:'Save fares & discounts',exact:true}).click()
        await page.waitForTimeout(100)
        assert.equal(fareConfig.passengerDiscounts.some(d=>d.name==='Student' || d.name==='Scholar'),false)
        await page.getByRole('button',{name:'Refresh',exact:true}).click()
        assert.equal(await page.getByPlaceholder('Student',{exact:true}).count(),0)
      }
      if (path === '/admin/trips') {
        await page.getByRole('button',{name:'Edit',exact:true}).click()
        await page.getByRole('heading',{name:'Edit sailing',exact:true}).waitFor()
        await page.getByRole('button',{name:'Close dialog',exact:true}).click()
        await page.locator('ion-modal .modal-body').waitFor({state:'detached'})
      }
      if (path === '/admin/routes' && width === 390) {
        await page.getByRole('button', { name: 'Add route', exact: true }).click()
        await page.getByLabel('Route code', { exact: true }).fill('UNSAVED-ROUTE')
        await page.getByRole('button', { name: 'Refresh', exact: true }).click()
        await page.getByRole('button', { name: 'Go back', exact: true }).click()
        await page.locator('ion-alert').waitFor({ state: 'detached' })
        assert.equal(await page.getByLabel('Route code', { exact: true }).inputValue(), 'UNSAVED-ROUTE')
        await page.getByRole('button', { name: 'Refresh', exact: true }).click()
        await page.getByRole('button', { name: 'Discard and refresh', exact: true }).click()
        await page.getByLabel('Route code', { exact: true }).waitFor({ state: 'detached' })
      }
      if (path === '/staff/boarding/check-in' && width === 390) {
        await page.getByRole('button').filter({ hasText: 'UI Traveler' }).first().click()
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Ticket review')
        assert.equal(await page.getByRole('button', { name: 'Export manifest', exact: true }).count(), 0, 'Boarding staff have no manifest export action')
      }
      if (path === '/admin/users') {
        if(width>=700){
          const grid=page.locator('.records-grid')
          await grid.locator('.ag-cell[col-id="cell-0"]').first().hover()
          await page.locator('.ag-tooltip').filter({hasText:'Zelda User'}).waitFor()
          await page.mouse.move(0,0)
          const nameHeader=grid.locator('.ag-header-cell[col-id="cell-0"]')
          await nameHeader.locator('.ag-header-cell-label').click()
          assert.equal(await nameHeader.getAttribute('aria-sort'),'ascending')
          const names=grid.locator('.ag-cell[col-id="cell-0"] .grid-cell-content')
          assert.deepEqual(await names.allTextContents(),['Anna User','Marco User','Zelda User'])
          await nameHeader.locator('.ag-header-cell-filter-button').click()
          const filter=page.locator('.ag-filter-body input').first()
          await filter.fill('Marco')
          await page.waitForTimeout(500)
          assert.deepEqual(await names.allTextContents(),['Marco User'])
          await page.keyboard.press('Escape')
          await grid.getByRole('button',{name:'Reset table',exact:true}).click()
          await page.waitForTimeout(200)
          assert.equal(await names.count(),3)
          assert.equal(await nameHeader.getAttribute('aria-sort'),'none')
          await grid.getByRole('button',{name:'Fit columns',exact:true}).click()
          await grid.getByRole('button',{name:'Columns',exact:true}).click()
          const emailColumn = page.getByRole('menuitemcheckbox', { name: 'Email', exact: true })
          await emailColumn.click()
          assert.equal(await emailColumn.getAttribute('aria-checked'),'false')
          assert.equal(await grid.locator('.ag-header-cell[col-id="cell-1"]').count(),0,'Column menu hides the selected column')
          await page.keyboard.press('Escape')
          await grid.getByRole('button',{name:'Reset table',exact:true}).click()
          assert.equal(await grid.locator('.ag-header-cell[col-id="cell-1"]').count(),1,'Reset restores hidden columns')
          await page.screenshot({path:`docs/screenshots/experience/admin-${width}-ag-grid-users.png`})
        } else {
          assert.equal(await page.locator('.mobile-record').count(),3)
          assert.equal(await page.locator('.ag-root').count(),0)
        }
        await page.getByRole('button', { name: 'Add user', exact: true }).click()
        const dialog = page.locator('ion-modal.user-modal .user-dialog')
        await dialog.waitFor()
        await page.waitForTimeout(400)
        assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 2), false, `${width}px account dialog overflow`)
        await dialog.getByLabel('Full name', { exact: true }).fill('UI Ticketing Staff')
        await dialog.getByLabel('Email address', { exact: true }).fill('new-staff@example.invalid')
        await dialog.getByLabel('Account role', { exact: true }).selectOption('TICKETING')
        await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
        await page.waitForTimeout(250)
        assert.equal(await dialog.locator('#new-user-password').inputValue(), 'Ui-generated-password123')
        assert.equal(await dialog.locator('#new-user-password').getAttribute('type'), 'password')
        await dialog.getByRole('button', { name: 'Show temporary password', exact: true }).click()
        assert.equal(await dialog.locator('#new-user-password').getAttribute('type'), 'text')
        await dialog.getByRole('button', { name: 'Hide temporary password', exact: true }).click()
        fs.mkdirSync('docs/screenshots/experience', { recursive: true })
        await page.screenshot({ path: `docs/screenshots/experience/admin-${width}-create-account.png` })
        await dialog.getByRole('button', { name: 'Create account', exact: true }).click()
        await dialog.getByRole('heading', { name: 'Account created', exact: true }).waitFor()
        assert.equal(managedAccountCalls, 1)
        assert.deepEqual(lastManagedInput, { fullName: 'UI Ticketing Staff', email: 'new-staff@example.invalid', role: 'TICKETING', password: 'Ui-generated-password123' })
        await dialog.getByRole('button', { name: 'Copy temporary password', exact: true }).click()
        await dialog.getByRole('status').waitFor()
        assert.equal(await page.evaluate(() => sessionStorage.getItem('ui-copied-password')), 'Ui-generated-password123')
        await page.screenshot({ path: `docs/screenshots/experience/admin-${width}-account-created.png` })
        await dialog.getByRole('button', { name: 'Done', exact: true }).click()
        await dialog.waitFor({ state: 'detached' })
        await page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' })
      }
      if (path === '/admin/operations') {
        const visible=page.locator('.ion-page:not(.ion-page-hidden)').last()
        assert.equal(await visible.getByText('Operations activity log',{exact:true}).count(),0)
        await visible.getByRole('link',{name:'View settings history'}).click()
        await visible.getByText('DEFAULT',{exact:true}).waitFor()
        assert.equal(new URL(page.url()).searchParams.get('entityType'),'operation_settings')
        assert.equal(lastAuditArgs.entityType,'operation_settings')
        assert.equal(await visible.getByLabel('Record type',{exact:true}).inputValue(),'operation_settings')
        assert.equal(await visible.locator('.actor-role').innerText(),'Administrator')
        const details=visible.locator('.records-grid details')
        assert.equal(await details.evaluate(el=>el.open),false)
        await visible.getByText('View changes',{exact:true}).click()
        await visible.getByText('Changed from 24 hours to 12 hours',{exact:true}).waitFor()
        assert.equal((await details.innerText()).includes('"after"'),false)
        await page.screenshot({path:`docs/screenshots/experience/admin-${width}-settings-history.png`})
        await visible.getByRole('button',{name:'Reset',exact:true}).click()
        await visible.getByText('UI-BOOKING',{exact:true}).waitFor()
        assert.equal(await visible.locator('.actor-role').innerText(),'Ticketing staff')
        await page.goto(baseUrl+path)
        await visible.getByRole('link',{name:'View settings history'}).waitFor()
      }
      if (path === '/admin/audit-logs') {
        assert.equal(await page.locator('.actor-role').innerText(),'Ticketing staff')
        assert.equal((await page.locator('.actor-info').innerText()).includes('current role'),false)
        const legacyHelp=page.locator('.legacy-role-help')
        assert.equal(await legacyHelp.evaluate(el=>el.open),false)
        await legacyHelp.locator('summary').click()
        assert.equal(await legacyHelp.locator('p').isVisible(),true)
        await legacyHelp.locator('summary').click()
        await page.getByLabel('Search activity').fill('UI-BOOKING')
        await page.getByLabel('Action',{exact:true}).selectOption('PAYMENT_RECEIVED')
        await page.getByLabel('From date').fill('2026-10-05')
        await page.getByLabel('To date').fill('2026-10-05')
        await page.getByRole('button',{name:'Apply filters'}).click()
        await page.getByText('UI-BOOKING',{exact:true}).waitFor()
        assert.deepEqual(lastAuditArgs,{entityType:'',search:'UI-BOOKING',action:'PAYMENT_RECEIVED',fromDate:'2026-10-05',toDate:'2026-10-05',page:0})
        await page.getByLabel('Search activity').fill('no-match')
        await page.getByRole('button',{name:'Apply filters'}).click()
        await page.getByRole('heading',{name:'No matching activity'}).waitFor()
        await page.getByRole('button',{name:'Reset',exact:true}).click()
        await page.getByText('UI-BOOKING',{exact:true}).waitFor()
        await page.getByText('View changes',{exact:true}).click()
        await page.getByText('Changed from Boarding to Completed',{exact:true}).waitFor()
        assert.equal(await page.getByText('PHP 600.00',{exact:true}).isVisible(),true)
        if(width>=700) await page.waitForFunction(()=>{const content=document.querySelector('.records-grid .readable-changes');const cell=content?.closest('.ag-cell');return !!content && !!cell && content.getBoundingClientRect().bottom<=cell.getBoundingClientRect().bottom+2})
        assert.equal((await page.locator('.readable-changes').innerText()).includes('"after"'),false)
      }
      if (path === '/home') {
        assert.equal(await page.locator('.workspace-welcome').count(),1)
        if (path === '/home') {
          const appWidth=await page.locator('ion-app > ion-router-outlet').evaluate(el=>el.getBoundingClientRect().width)
          assert.equal(Math.round(appWidth),Math.min(width,560),'Passenger web uses the compact mobile canvas')
          assert.equal(await page.getByRole('navigation',{name:'Passenger shortcuts'}).isVisible(),false)
          assert.equal(await page.getByRole('navigation',{name:'Passenger navigation'}).isVisible(),true)
        }
      }
      if (path === '/admin/bookings') {
        if (width >= 1024) {
          await page.getByLabel('Search all bookings').fill('missing-reference')
          await page.getByLabel('Search all bookings').press('Enter')
          await page.waitForTimeout(600)
          assert.equal(lastBookingArgs.search, 'missing-reference', 'Same-page header search reaches the database')
          assert.equal(await page.getByLabel('Search Booking management').inputValue(), 'missing-reference')
        }
        await page.getByLabel('Search Booking management').fill('UI-BOOKING')
        await page.waitForTimeout(600)
        assert.equal(lastBookingArgs.search, 'UI-BOOKING')
        await page.getByLabel('Filter by status').selectOption('REFUND PENDING')
        await page.waitForTimeout(600)
        assert.equal(lastBookingArgs.status, 'REFUND_PENDING')
        assert.equal(lastBookingArgs.page, 0)
        await page.getByLabel('Filter by status').selectOption('ALL'); await page.waitForTimeout(500)
      }
      if (path.endsWith('/settings/account')) {
        await page.getByLabel('Mobile number').fill('+63 (912) 345-6789')
        await page.getByRole('button', { name: 'Save number', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'Contact number saved.' }).waitFor()
        assert.equal(profile.phone, '+639123456789')
        await page.reload()
        await page.waitForFunction(() => document.querySelector('input[type="tel"]')?.value === '+639123456789')
        assert.equal(await page.getByLabel('Mobile number').inputValue(), '+639123456789')
      }
      if (path.endsWith('/settings/security')) {
        await page.getByLabel('Show passwords').check()
        assert.equal(await page.getByLabel('Current password', { exact: true }).getAttribute('type'), 'text')
      }
      if (path === '/staff/boarding') {
        await page.getByLabel('Search manifest').fill('no-such-ticket')
        await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
        await page.getByRole('button').filter({ hasText: 'UI Traveler' }).waitFor()
        assert.equal(await page.getByRole('link', { name: 'My staff account' }).first().getAttribute('href'), '/staff/boarding/settings/account')
      }
      if (path === '/staff/ticketing') {
        if (width < 900) await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click()
        await page.getByRole('link', { name: 'Bookings', exact: true }).click()
        await page.waitForURL('**/staff/ticketing/bookings'); await page.waitForTimeout(250)
        assert.match(await page.locator('#staff-sidebar a[href="/staff/ticketing/bookings"]').first().getAttribute('class'), /active/)
        assert.equal(await page.getByRole('link', { name: 'My staff account' }).first().getAttribute('href'), '/staff/ticketing/settings/account')
      }
      if (path === '/admin/settings/profile') {
        await page.locator('input[autocomplete=name]').fill('UI Administrator')
        await page.getByRole('button', { name: 'Save profile', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'Your profile has been updated.' }).waitFor()
        assert.equal(profile.fullName, 'UI Administrator')
      }
      if (path === '/profile') {
        await page.getByRole('link', { name: 'Saved passengers' }).waitFor()
        assert.equal(await page.getByRole('link', { name: 'Saved passengers' }).getAttribute('href'), '/travelers')
      }
      if (path === '/settings/profile') {
        await page.locator('input[autocomplete=name]').fill('UI Updated Name')
        await page.locator('input[type=tel]').fill('+63 (912) 345-6789')
        await page.getByRole('button', { name: 'Save profile', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'Your profile has been updated.' }).waitFor()
        assert.equal(profile.phone, '+639123456789')
        await page.reload()
        await page.waitForFunction(() => document.querySelector('input[autocomplete="name"]')?.value === 'UI Updated Name')
        assert.equal(await page.locator('input[autocomplete=name]').inputValue(), 'UI Updated Name')
        await page.getByRole('link', { name: 'Back to my profile', exact: true }).click()
        await page.getByRole('heading', { name: 'UI Updated Name', exact: true }).waitFor()
        await page.goto(baseUrl + path)
        await page.locator('input[autocomplete=name]').waitFor()
      }
      if (path === '/settings/password') {
        assert.equal(await page.locator('#personal-info').count(), 0)
        await page.getByLabel('Show passwords').check()
        assert.equal(await page.getByLabel('Current password', { exact: true }).getAttribute('type'), 'text')
      }
      if (path.includes('trip-operations')) {
        await page.getByRole('button', { name: 'Bookings', exact: true }).click()
        await page.getByText('UI-BOOKING', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'No-shows', exact: true }).click()
        assert.equal(await page.getByRole('button', { name: 'Reconcile no-shows', exact: true }).isDisabled(), true)
      }
      if (path === '/notifications') {
        await page.getByRole('button', { name: 'Mark all read', exact: true }).click()
        await page.getByText('0 unread', { exact: true }).waitFor()
        assert.equal(markAllCalls, 1)
      }
      if (path === '/bookings') {
        assert.match(await page.locator('.booking-card').first().innerText(), /Booking total: PHP 600/)
        await page.getByLabel('Payment status').selectOption('PAID')
        assert.equal(await page.locator('.booking-card').count(), 1)
        await page.getByLabel('Find a booking').fill('no-such-reference')
        await page.getByRole('heading', { name: 'No matching bookings' }).waitFor()
        await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
        assert.equal(await page.locator('.booking-card').count(), 2)
        await page.getByRole('link', { name: 'View details', exact: true }).first().click()
        await page.getByRole('heading', { name: 'Booking details', exact: true }).last().waitFor()
        assert.match(await page.locator('.booking-detail-card').last().innerText(), /Booking total: PHP 600/)
        await page.goto(baseUrl + path)
        await page.locator('.booking-card').first().waitFor()
        if (width === 390) {
          const failBookings = async route => {
            if (route.request().postDataJSON().operation !== 'MyBookings') return route.fallback()
            await new Promise(resolve => setTimeout(resolve, 600))
            await route.fulfill({ status: 503, json: { message: 'Service temporarily unavailable' } })
          }
          await context.route('**/rpc/barkolink_execute', failBookings)
          await page.goto(baseUrl + path)
          await page.getByRole('status').filter({ hasText: 'Loading my bookings' }).waitFor()
          assert.equal(await page.getByRole('heading', { name: 'No matching bookings' }).count(), 0)
          await page.getByRole('heading', { name: 'Could not load my bookings' }).waitFor()
          await context.unroute('**/rpc/barkolink_execute', failBookings)
          await page.getByRole('button', { name: 'Retry', exact: true }).click()
          await page.locator('.booking-card').first().waitFor()
          assert.equal(await page.locator('.booking-card').count(), 2)
        }
      }
      if (path === '/search?all=1') {
        assert.match(await page.locator('.trip-card').first().innerText(), /Departure: Jan 1, 2099/)
        assert.match(await page.locator('.trip-card').first().innerText(), /4:00 PM/)
      }
      if (path === '/passenger-info') {
        const surface = () => page.locator('.passenger-card').first().evaluate(el => getComputedStyle(el).backgroundColor)
        const light = await surface()
        await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'barkolink-theme', newValue: 'dark' })))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
        assert.notEqual(await surface(), light, 'Passenger form follows the selected theme')
        await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'barkolink-theme', newValue: 'light' })))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
      }
      if (path.startsWith('/booking-confirmed')) {
        assert.match(await page.locator('.confirmed-card').innerText(), /BOOKING TOTAL\s+PHP 600/)
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied') } } }))
        await page.getByRole('button', { name: 'Copy', exact: true }).click()
        await page.getByText('Could not copy the reference. Select the booking reference and copy it manually.', { exact: true }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Copied', exact: true }).count(), 0)
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
      }
      if (path === '/staff/ticketing/walk-in') {
        await page.locator('.form-section select').first().selectOption(sailing.code)
        await page.getByLabel('Full name', { exact: true }).fill('UI Passenger')
        await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01')
        await page.locator('.passenger-section select').first().selectOption('Female')
        const review = page.getByRole('button', { name: 'Review cash payment', exact: true })
        await review.click()
        await page.getByRole('dialog').waitFor()
        assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), true)
        for (let step = 0; step < 4; step++) {
          await page.keyboard.press('Tab')
          assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), true, 'Tab stays in the payment dialog')
        }
        await page.keyboard.press('Escape')
        await page.getByRole('dialog').waitFor({ state: 'detached' })
        assert.equal(await review.evaluate(el => el === document.activeElement), true)
        await review.click()
        await page.locator('.confirm-actions .issue-button').click()
        await page.locator('.receipt').waitFor()
        await page.emulateMedia({ media: 'print' })
        assert.equal(await page.locator('.receipt').evaluate(el => getComputedStyle(el).visibility), 'visible')
        assert.equal(await page.locator('.receipt h2').evaluate(el => getComputedStyle(el).visibility), 'visible')
        assert.equal(await page.locator('.receipt-actions').evaluate(el => getComputedStyle(el).display), 'none')
        fs.mkdirSync('docs/screenshots/experience', { recursive: true })
        await page.screenshot({ path: `docs/screenshots/experience/walk-in-receipt-print-${width}.png` })
        await page.emulateMedia({ media: 'screen' })
        if (width === 390) {
          let written = null, mutations = 0, checksAfterWrite = 0
          const lostResponse = async route => {
            const { operation, args } = route.request().postDataJSON()
            if (operation === 'TicketingCreateGuestWalkIn') {
              mutations++
              written = { ...booking, reference: args.reference, total: 600 }
              return route.fulfill({ status: 503, json: { message: 'Simulated response loss' } })
            }
            if (operation === 'StaffBookings') {
              if (written && checksAfterWrite++ === 0) return route.fulfill({ status: 503, json: { message: 'Offline' } })
              return route.fulfill({ json: { bookings: written ? [written] : [], totalCount: written ? 1 : 0 } })
            }
            return route.fallback()
          }
          await context.route('**/rpc/barkolink_execute', lostResponse)
          await page.reload()
          await page.locator('.form-section select').first().selectOption(sailing.code)
          await page.getByLabel('Full name', { exact: true }).fill('Retry Passenger')
          await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01')
          await page.locator('.passenger-section select').first().selectOption('Female')
          await page.getByRole('button', { name: 'Review cash payment', exact: true }).click()
          await page.locator('.confirm-actions .issue-button').click()
          await page.getByRole('button', { name: 'Check / retry sale', exact: true }).waitFor()
          const pendingReference = await page.evaluate(() => JSON.parse(sessionStorage.getItem('barkolink-pending-walk-in')).args.reference)
          await page.reload()
          await page.getByRole('button', { name: 'Check / retry sale', exact: true }).click()
          await page.locator('.receipt').waitFor()
          assert.match(await page.locator('.receipt').innerText(), new RegExp(pendingReference))
          assert.equal(mutations, 1, 'Response loss recovers the original sale without another cash mutation')
          assert.equal(await page.evaluate(() => sessionStorage.getItem('barkolink-pending-walk-in')), null)
          await context.unroute('**/rpc/barkolink_execute', lostResponse)
        }
      }
      if (path.startsWith('/ticket')) {
        await page.locator('.qr-block img').waitFor()
        assert.match(await page.locator('.qr-block img').getAttribute('src'), /^data:image\/png;base64,/)
        const pending = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Download ticket', exact: true }).click()
        const download = await pending
        const text = fs.readFileSync(await download.path(), 'utf8')
        assert.ok(text.includes('data:image/png;base64,'), 'Downloaded ticket embeds its QR')
        assert.ok(!text.includes('https://'), 'Downloaded ticket has no external dependencies')
        await page.emulateMedia({ media: 'print' })
        assert.equal(await page.locator('.ticket').evaluate(el => getComputedStyle(el).visibility), 'visible')
        await page.emulateMedia({ media: 'screen' })
      }
      if (path.endsWith('/settings/appearance')) {
        await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark')
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ion-palette-dark')), true)
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true)
        await page.reload()
        await page.getByRole('button', { name: 'Dark theme', exact: true }).waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'Theme persists after reload')
        await page.getByRole('button', { name: 'System theme', exact: true }).click()
        await page.emulateMedia({ colorScheme: 'light' })
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
        fs.mkdirSync('docs/screenshots/experience', { recursive: true })
        await page.screenshot({ path: `docs/screenshots/experience/${role.toLowerCase()}-${width}-appearance-dark.png` })
        await page.getByRole('button', { name: 'Light theme', exact: true }).click()
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ion-palette-dark')), false)
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false)
        await page.emulateMedia({ colorScheme: 'light' })
      }
      fs.mkdirSync('docs/screenshots/experience', { recursive: true })
      if (['/home','/search','/bookings','/admin/users'].includes(path.split('?')[0])) {
        await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'barkolink-theme', newValue: 'dark' })))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
        await page.locator('[data-slot="button"]').evaluateAll(nodes => Promise.all(nodes.flatMap(el => el.getAnimations()).map(animation => animation.finished.catch(() => {}))))
        if (path.startsWith('/search')) {
          const button = page.getByRole('button', { name: 'Modify search', exact: true })
          assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(20, 34, 53)', 'Outline buttons follow the dark surface palette')
        }
        await page.screenshot({ path: `docs/screenshots/experience/${role.toLowerCase()}-${width}-${path.split('?')[0].replaceAll('/', '-').slice(1)}-dark.png` })
        await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'barkolink-theme', newValue: 'light' })))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
        await page.locator('[data-slot="button"]').evaluateAll(nodes => Promise.all(nodes.flatMap(el => el.getAnimations()).map(animation => animation.finished.catch(() => {}))))
      }
      await page.screenshot({ path: `docs/screenshots/experience/${role.toLowerCase()}-${width}-${path.split('?')[0].replaceAll('/', '-').slice(1)}.png` })
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log('Experience UI checks passed at desktop, tablet, and mobile widths; all backend traffic used isolated fixtures.')
} finally { await browser.close() }
