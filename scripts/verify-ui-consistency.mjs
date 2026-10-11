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
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { sessionStorage.setItem('ui-copied-password', text) } } }))
    let profile = { uid: id, fullName: 'UI User', email: user.email, role, phone: '09123456789', assignedPortId: sailing.origin.id, assignedPort: { ...sailing.origin, isActive: true } }
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
          assert.equal(await logo.evaluate(el => el.complete && el.naturalWidth > 0), true, path + ': ferry logo loaded')
        }
        fs.mkdirSync('docs/screenshots/consistency', { recursive: true })
        await page.screenshot({ path: 'docs/screenshots/consistency/' + role.toLowerCase() + '-' + width + '-' + path.split('?')[0].replaceAll('/', '-').slice(1) + '-' + theme + '.png' })
      }
    }
    await context.close()
    console.log(role + ': shared buttons, icons, branding and layouts passed at ' + width + 'px in both themes.')
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
