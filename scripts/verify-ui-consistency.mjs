import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

// Visual regression checks for shared actions, icons and branding.
// All backend requests use isolated fixtures; no real accounts or hosted writes.
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
    let managedAccountCalls = 0, lastManagedInput = null, lastPortAssignment = null
    let travelerSaveFails = false
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { sessionStorage.setItem('ui-copied-password', text) } } }))
    let profile = { uid: id, fullName: 'UI User', email: user.email, role, phone: '09123456789', assignedPortId: sailing.origin.id, assignedPort: { ...sailing.origin, isActive: true } }
    await context.route(`${projectUrl}/**`, async route => {
      const url = route.request().url()
      if (url.includes('/auth/v1/')) return route.fulfill({ json: user })
      if (url.includes('/functions/v1/weather') && process.env.BARKOLINK_WEATHER_CHECK === '1') {
        const {portId} = route.request().postDataJSON()
        const current = {at:new Date().toISOString(),condition:'Partly cloudy',temperatureC:28,windKph:18,gustKph:25,visibilityKm:9,rainChance:35,cloudCover:42}
        const days = Array.from({length:7},(_,i)=>({date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+i*86400000)),condition:'Partly cloudy',conditionCode:2,highC:30,lowC:24,rainChance:35,windKph:18}))
        const ports = [sailing.origin,sailing.destination].filter(port=>!portId || port.id===portId).map((port,i)=>({...port,available:true,current,days,forecast:portId?null:current,role:i===0?'Departure port':'Arrival port'}))
        return route.fulfill({json:{configured:true,departureAt:sailing.departureAt,ports}})
      }
      if (url.includes('/functions/v1/manage-account')) {
        const { action, input } = route.request().postDataJSON()
        if (action === 'generateTemporaryPassword') return route.fulfill({ json: { password: 'Ui-generated-password123' } })
        assert.equal(action, 'createManagedUser')
        managedAccountCalls++; lastManagedInput = input
        return route.fulfill({ json: { email: input.email, role: input.role } })
      }
      if (!url.includes('/rpc/barkolink_execute')) return route.fulfill({ status: 403, json: { message: 'Direct access is blocked in this test.' } })
      const { operation, args } = route.request().postDataJSON()
      if (operation === 'MySaveTraveler') return route.fulfill(travelerSaveFails
        ? { status: 500, json: { message: 'Could not save traveler. Please retry.' } }
        : { json: {} })
      if (operation === 'MyDeleteTraveler') return route.fulfill({ json: {} })
      let result
      if (operation === 'AdminAssignStaffPort') { lastPortAssignment = args; return route.fulfill({ json: { uid: args.uid, assignedPortId: args.portId } }) }
      if (operation === 'AdminStaffPortAssignments') {
        const staff = [{uid:'user-a',fullName:'Anna User',email:'anna@example.invalid',role:'TICKETING',assignedPortId:null,assignedPort:null},{uid:'user-m',fullName:'Marco User',email:'marco@example.invalid',role:'BOARDING',assignedPortId:null,assignedPort:null}].filter(u => (!args.role || args.role === 'ALL' || args.role === u.role) && (!args.search || `${u.fullName} ${u.email}`.toLowerCase().includes(args.search.toLowerCase())))
        return route.fulfill({ json: { staff, totalCount: staff.length, ports: [sailing.origin, sailing.destination].map(p => ({ ...p, isActive: true })) } })
      }
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
        PassengerSailingBoard: { date: '2099-01-01', updatedAt: new Date().toISOString(), sailings: [] },
        ActiveTravelAdvisories: { advisories: [] },
        QuoteLoyaltyVoucher: { quote: null },
        MyLoyalty: { completedTrips: 0, rewardValue: 100, tripsToNextReward: 5, tripsPerReward: 5, currentTier: "Bronze", tiers: [{ name: 'Bronze', trips: 5, value: 100 }], vouchers: [] },
        AdminPorts: { ports: [sailing.origin, sailing.destination].map(p => ({ ...p, isActive: true })) }, AdminVessels: { vessels: [sailing.vessel] },
        AdminSailingBookings:{bookings:[]}, AdminUsers: { users: [{uid:'user-z',fullName:'Zelda User',email:'zelda@example.invalid',role:'PASSENGER',createdAt:'2026-10-05T01:00:00Z'},{uid:'user-a',fullName:'Anna User',email:'anna@example.invalid',role:'TICKETING',createdAt:'2026-10-05T01:00:00Z'},{uid:'user-m',fullName:'Marco User',email:'marco@example.invalid',role:'BOARDING',createdAt:'2026-10-05T01:00:00Z'}],totalCount:3 }, AdminPassengerRecords: { bookingPassengers: [], totalCount: 0 },
        AdminOperationsSettings: { reservationMinutes: 1440 },
        AdminDailySchedules: { schedules: [], routes: [] },
        AdminSailingStatusPolicies: { policies: [{ operator: 'UI Ferry Operator', boardingLeadMinutes: null, boardingTimeSource: null, autoComplete: true }] },
        AdminVesselPositions: { vessels: [{ ...sailing.vessel, position: { state: 'UNKNOWN' } }], ports: [sailing.origin, sailing.destination] },
        AdminVesselAvailability: { vessels: [{ id: sailing.vessel.id, issue: null }] },
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
    if (role === 'ADMIN') paths.push('/admin/users', '/admin/staff-ports', '/admin/operations', '/admin/fares')
    if (role === 'ADMIN') paths.push('/admin/manifest', '/admin/inbox')
    if (role === 'ADMIN') paths.push('/admin/ports', '/admin/vessels')
    if (role === 'TICKETING') paths.push('/staff/ticketing/walk-in')
    if (role === 'PASSENGER') {
      paths.push('/trip-details', '/booking-summary', '/assistant', '/privacy?from=profile')
      paths.push('/passenger-info', '/booking-confirmed?reference=UI-BOOKING')
      await context.addInitScript(({ sailing }) => localStorage.setItem('barkolink-selected-trip', JSON.stringify({
        id: sailing.code, selectionId: 'ui-check', from: sailing.origin.city, to: sailing.destination.city,
        departureAt: sailing.departureAt, date: 'Jan 1, 2099', departure: '4:00 PM', arrival: '6:00 PM',
        vessel: sailing.vessel.name, available: 98, regularFare: 600, passengerCount: 1,
      })), { sailing })
    }
    const selectedPaths = process.env.BARKOLINK_UI_PATHS?.split(',')
    for (const path of paths.filter(path => !selectedPaths || selectedPaths.includes(path.split('?')[0]))) {
      booking.paymentVerificationRequired = path === '/home'
      await page.goto(baseUrl + path)
      await page.locator('h1').first().waitFor()
      await page.waitForTimeout(450)
      if (path === '/admin/trips') {
        assert.equal(await page.locator('.trip-records-panel').isVisible(), true, 'Actual trips are the default view')
        await page.getByRole('button', { name:'Daily schedules', exact:true }).click()
        await page.locator('.daily-schedules').waitFor()
        assert.equal(await page.locator('.trip-records-panel').isVisible(), false, 'Templates do not bury actual trip records')
        await page.getByRole('button', { name:'Actual trips', exact:true }).click()
        await page.locator('.trip-records-panel').getByText('Jan 1, 2099, 4:00 PM', { exact:true }).waitFor()
        assert.ok((await page.locator('.trip-records-panel').innerText()).includes('4:00 PM'), 'Admin departures stay in Philippine time on an overseas device')
        if (process.env.BARKOLINK_UX_DRAFT_CHECK === '1') {
          await page.getByRole('button',{name:'Create trip',exact:true}).click()
          await page.locator('.trip-form').waitFor()
          await page.locator('.trip-form select').nth(0).selectOption(sailing.origin.id)
          await page.locator('.trip-form select').nth(1).selectOption(sailing.destination.id)
          await page.locator('.trip-form select').nth(2).selectOption(sailing.vessel.id)
          await page.locator('.trip-form input[type="datetime-local"]').nth(0).fill('2099-01-02T10:00')
          await page.locator('.trip-form input[type="datetime-local"]').nth(1).fill('2099-01-02T12:00')
          await page.getByRole('link',{name:'Status settings · keep draft',exact:true}).click()
          await page.waitForURL(url=>url.pathname==='/admin/operations')
          await page.getByRole('link',{name:'Return to the trip draft',exact:true}).last().click()
          await page.locator('.trip-form').waitFor()
          assert.equal(await page.locator('.trip-form input[type="datetime-local"]').nth(0).inputValue(),'2099-01-02T10:00','Setup navigation preserves the unsaved Philippine departure')
          assert.equal(await page.locator('.trip-form select').nth(2).inputValue(),sailing.vessel.id,'Setup navigation preserves the selected vessel')
          await page.keyboard.press('Escape')
          await page.locator('.trip-form').waitFor({state:'hidden'})
        }
      }
      if (path === '/home') {
        assert.ok((await page.locator('.upcoming-block').innerText()).includes('Do not pay again'), 'Received online payments never prompt another payment')
        assert.equal((await page.locator('.upcoming-block ion-button').innerText()).trim(),'Check verification','Ticket action waits for payment verification')
        const journey=await page.locator('.upcoming-block').boundingBox()
        const board=await page.locator('.sailing-board').boundingBox()
        assert.ok(journey.y < board.y, 'Active booking appears before secondary schedule content')
        if (process.env.BARKOLINK_WEATHER_CHECK === '1') {
          await page.locator('.smart-weather').waitFor()
          assert.equal(await page.locator('.forecast-day').count(),7,'Seven daily forecasts render')
          assert.match(await page.locator('.forecast-badge').innerText(),/7-day forecast/)
        }
      }
      if (role === 'PASSENGER') {
        const frame=await page.locator('ion-app > ion-router-outlet').boundingBox()
        assert.ok(frame.width <= 560.5,'Passenger web and mobile keep the same compact canvas')
        assert.ok(Math.abs((frame.x + frame.width / 2) - width / 2) < 2,'Passenger canvas stays centered')
        const nav=page.locator('.ion-page:not(.ion-page-hidden) .bottom-nav')
        if (await nav.count()) {
          const bounds=await nav.first().boundingBox()
          assert.ok(Math.abs(bounds.x-frame.x)<2 && Math.abs(bounds.width-frame.width)<2,'Bottom navigation matches the passenger canvas')
        }
      }
      if (path === '/staff/ticketing' || path === '/staff/boarding') {
        assert.ok((await page.locator('.queue-freshness').innerText()).includes('Updated'), 'Staff can see the last successful queue update')
      }
      if (path === '/admin/ports' || path === '/admin/vessels') {
        assert.equal(await page.locator('#directory-status').inputValue(),'ACTIVE','Operational directories default to active records')
        await page.locator('#directory-status').selectOption('INACTIVE')
        assert.ok((await page.locator('.archive-guidance').innerText()).includes('past trips and tickets'),'History explains retained inactive identities')
        await page.getByRole('button',{name:'Reset filters',exact:true}).click()
        assert.equal(await page.locator('#directory-status').inputValue(),'ACTIVE','Reset returns to active operations')
      }
      const overflow = await page.locator('main').first().evaluate(el => el.scrollWidth > el.clientWidth + 2)
      if (overflow) console.log(JSON.stringify(await page.locator('main').first().evaluate(root => {
        const boundary=root.getBoundingClientRect();
        return Array.from(root.querySelectorAll('*')).filter(el=>el.getClientRects().length && el.getBoundingClientRect().right>boundary.right+2).slice(0,10).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.trim().slice(0,50),width:el.getBoundingClientRect().width,minWidth:getComputedStyle(el).minWidth}));
      })))
      assert.equal(overflow, false, `${role} ${width}px ${path} overflow`)
      assert.equal(await page.locator('[role=alert]').count(), 0, `${path}: unexpected error`)
      if (process.env.BARKOLINK_TOAST_CHECK === '1' && path === '/travelers') {
        await page.getByRole('button', { name: 'Save traveler', exact: true }).click()
        assert.equal(await page.locator('.app-toast').count(), 0, 'Required fields remain inline/browser validation')
        await page.getByLabel('Full name', { exact: true }).fill('Toast Test Traveler')
        await page.getByLabel('Birth date', { exact: true }).fill('1990-01-01')
        await page.locator('.travelers-page form select').selectOption('FEMALE')
        await page.getByLabel('Mobile number', { exact: true }).fill('09123456789')
        await page.getByRole('button', { name: 'Save traveler', exact: true }).click()
        await page.locator('.app-toast.success').getByText('Traveler saved.', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Dismiss notification' }).click()
        await page.locator('.app-toast').waitFor({state:'hidden'})
        await page.getByRole('button', { name: 'Edit', exact: true }).click()
        travelerSaveFails = true
        await page.getByRole('button', { name: 'Save traveler', exact: true }).click()
        await page.locator('.app-toast.error').waitFor()
        assert.match(await page.locator('.app-toast.error').innerText(), /Could not save traveler/)
        assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), 'UI Traveler', 'Failed save retains form input')
        await page.getByRole('button', { name: 'Dismiss notification' }).click()
        await page.locator('.app-toast').waitFor({state:'hidden'})
        travelerSaveFails = false
        await page.getByRole('button', { name: 'Delete', exact: true }).click()
        await page.locator('ion-alert button').filter({hasText:'Delete traveler'}).click()
        await page.locator('.app-toast.success').getByText('Traveler deleted.', {exact:true}).waitFor()
        await page.getByRole('button', { name: 'Dismiss notification' }).click()
        await page.locator('.app-toast').waitFor({state:'hidden'})
      }
      const actionStyleProblems = await page.locator('[data-slot="button"][data-size]').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).flatMap(el => {
        const style = getComputedStyle(el)
        return parseFloat(style.minHeight) < 44 || style.borderRadius !== '10px'
          ? [`${el.textContent.trim() || el.getAttribute('aria-label')}: ${style.minHeight}, ${style.borderRadius}`] : []
      }))
      assert.deepEqual(actionStyleProblems, [], `${path}: shared action sizes survive page styles`)
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light')
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim()), 'hsl(220 29% 97%)')
      if (['/admin/audit-logs','/staff/ticketing','/staff/boarding','/home'].includes(path)) {
        const selector=role==='ADMIN' ? '.sidebar nav a svg.app-icon' : role==='PASSENGER' ? '.bottom-nav svg.app-icon' : '.staff-navigation svg.app-icon'
        const icons=await page.locator(selector).evaluateAll(nodes=>nodes.map(node=>node.innerHTML))
        assert.ok(icons.length>0,`${role}: navigation icons rendered`)
        assert.equal(new Set(icons).size,icons.length,`${role}: each navigation destination has a distinct icon`)
        const brand=role==='PASSENGER' ? '.passenger-header .brand-mark' : 'aside .brand-mark'
        if(role!=='PASSENGER') assert.equal(await page.locator(brand).count(),1,`${role}: one sidebar brand`)
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.dispatchEvent(new StorageEvent('storage', { key: 'barkolink-theme', newValue: theme })), theme)
        await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme)
        const styleIssues = await page.locator('[data-slot="button"][data-size]').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).flatMap(el => {
          const style = getComputedStyle(el)
          return parseFloat(style.minHeight) < 44 || style.borderRadius !== '10px'
            ? [el.textContent.trim() + ': ' + style.minHeight + ', ' + style.borderRadius] : []
        }))
        assert.deepEqual(styleIssues, [], role + ' ' + width + ' ' + path + ' ' + theme + ': action styles')
        const ionicStyleIssues = await page.locator('ion-button').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).flatMap(el => {
          const style = getComputedStyle(el)
          return parseFloat(style.minHeight) < 44 || style.getPropertyValue('--border-radius').trim() !== '10px'
            ? [el.textContent.trim() + ': ' + style.minHeight + ', ' + style.getPropertyValue('--border-radius')] : []
        }))
        assert.deepEqual(ionicStyleIssues, [], path + ' ' + theme + ': Ionic actions share the same size and radius')
        assert.equal(await page.locator('ion-icon.app-icon').count(), 0, path + ': all common icons use Lucide')
        const navIconSizes = await page.locator('.bottom-nav svg.app-icon').evaluateAll(nodes => nodes.map(el => {
          const style = getComputedStyle(el)
          return style.width + 'x' + style.height + ':' + style.padding
        }))
        assert.ok(new Set(navIconSizes).size <= 1, path + ': active and inactive navigation icons keep the same size')
        assert.equal(await page.locator('main').first().evaluate(el => el.scrollWidth > el.clientWidth + 2), false, path + ': no horizontal overflow')
        for (const logo of await page.locator('.brand-symbol img').all()) {
          await logo.evaluate(el => el.decode().catch(() => undefined))
          assert.equal(await logo.evaluate(el => el.complete && el.naturalWidth > 0), true, path + ': ferry logo loaded')
        }
        fs.mkdirSync('docs/screenshots/consistency', { recursive: true })
        if (process.env.BARKOLINK_WEATHER_CHECK === '1' && path === '/admin/trips') {
          const details = page.locator('.admin-trip-weather')
          if (!await details.evaluate(el=>el.open)) await details.locator('summary').click()
          await page.locator('.weather-trigger').click()
          await page.getByRole('option').filter({hasText:'UI-TRIP'}).click()
          await page.locator('.smart-weather').first().waitFor()
        }
        if (process.env.BARKOLINK_WEATHER_CHECK === '1' && await page.locator('.smart-weather').count()) {
          const weather = page.locator(path === '/home' ? '.port-forecast' : '.trip-weather').first()
          await weather.scrollIntoViewIfNeeded()
          assert.equal(await weather.evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'Weather card fits its canvas')
          assert.match(await weather.locator('.weather-metrics').first().innerText(), /18 km\/h/, 'Wind measurement stays visible in the card')
          await weather.screenshot({path:`docs/screenshots/consistency/weather-${role.toLowerCase()}-${path.split('?')[0].replaceAll('/','-').slice(1)}-${width}-${theme}.png`})
          await weather.locator('.smart-weather').first().scrollIntoViewIfNeeded()
          await weather.locator('.smart-weather').first().screenshot({path:`docs/screenshots/consistency/weather-card-${role.toLowerCase()}-${width}-${theme}.png`})
        }
        if (process.env.BARKOLINK_TOAST_CHECK === '1') {
          await page.evaluate(async () => {
            const { notifyError, clearToasts } = await import('/src/composables/toast.ts')
            clearToasts(); notifyError('Could not save changes. Check your connection and try again.')
          })
          await page.locator('.app-toast.error').waitFor()
          await page.waitForFunction(() => {
            const toast = document.querySelector('.app-toast.error')
            return toast && getComputedStyle(toast).opacity === '1'
          })
          const toastBounds = await page.locator('.app-toast').boundingBox()
          assert.ok(toastBounds.x >= 0 && toastBounds.x + toastBounds.width <= width, 'Toast fits the viewport')
          assert.ok(Math.abs(toastBounds.x + toastBounds.width / 2 - width / 2) < 2, 'Toast stays centered')
          assert.equal(await page.locator('.app-toast').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'Toast text has no horizontal overflow')
          await page.screenshot({ path: `docs/screenshots/consistency/toast-${role.toLowerCase()}-${width}-${theme}.png` })
          await page.getByRole('button', {name:'Dismiss notification'}).click()
          await page.locator('.app-toast').waitFor({state:'hidden'})
        }
        await page.screenshot({ path: 'docs/screenshots/consistency/' + role.toLowerCase() + '-' + width + '-' + path.split('?')[0].replaceAll('/', '-').slice(1) + '-' + theme + '.png' })
      }
    }
    await context.close()
    console.log(role + ': shared buttons, icons, branding and layouts passed at ' + width + 'px in both themes.')
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
