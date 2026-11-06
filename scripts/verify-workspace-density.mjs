import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { boardingTimingFixture } from './boarding-timing-fixture.mjs';

// Visual regression checks for shared actions, icons and branding.
// All backend requests use isolated fixtures; no real accounts or hosted writes.
const baseUrl = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8110';
const projectUrl = fs
  .readFileSync('.env.local', 'utf8')
  .match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]
  ?.trim()
  .replace(/^['"]|['"]$/g, '');
const projectRef = new URL(projectUrl).hostname.split('.')[0];
const id = '11111111-1111-4111-8111-111111111111';
const sailing = {
  code: 'UI-TRIP',
  departureAt: '2099-01-01T08:00:00Z',
  arrivalAt: '2099-01-01T10:00:00Z',
  durationMinutes: 120,
  status: 'SCHEDULED',
  availableSeats: 98,
  regularFare: 600,
  studentFare: 480,
  seniorFare: 480,
  pwdFare: 480,
  childFare: 300,
  pregnantFare: 600,
  origin: { id: 'origin', name: 'Calapan Port', city: 'Calapan' },
  destination: { id: 'destination', name: 'Batangas Port', city: 'Batangas' },
  vessel: { id: 'vessel', name: 'UI Ferry', passengerCapacity: 100, isActive: true },
};
const passenger = {
  fare: 600,
  sex: 'FEMALE',
  id,
  fullName: 'UI Traveler',
  passengerType: 'REGULAR',
  ticketCode: id,
  ticketStatus: 'ISSUED',
  checkedInAt: null,
  boardedAt: null,
  noShow: false,
};
const booking = {
  owner: { fullName: 'UI User', email: 'ui@example.invalid' },
  createdAt: '2026-01-01T08:00:00Z',
  bookingChannel: 'ONLINE',
  id,
  reference: 'UI-BOOKING',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  total: 600,
  passengerCount: 1,
  sailing,
  bookingPassengers_on_booking: [passenger],
};
const advisory = {
  id,
  title: 'Terminal reminder',
  message: 'Keep your booking reference ready.',
  category: 'GENERAL',
  priority: 'MEDIUM',
  sailingCode: null,
  startsAt: '2000-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z',
  published: true,
};
const errors = [],
  reports = [],
  problems = [],
  missing = new Set();
fs.mkdirSync('.audit/workspace-density', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of process.env.BARKOLINK_UI_WIDTHS?.split(',').map(Number) || [1366, 390])
    for (const role of ['ADMIN', 'TICKETING', 'BOARDING'])
      for (const theme of ['dark', 'light']) {
        if (process.env.BARKOLINK_UI_ROLE && process.env.BARKOLINK_UI_ROLE !== role) continue;
        const context = await browser.newContext({
          viewport: { width, height: width === 1366 ? 636 : 844 },
          acceptDownloads: true,
          timezoneId: 'America/Los_Angeles',
        });
        const user = {
          id,
          email: 'ui@example.invalid',
          app_metadata: { role },
          user_metadata: { fullName: 'UI User' },
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        };
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const session = {
          access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: id, exp, aal: 'aal2', role: 'authenticated', app_metadata: { role } })}.test`,
          refresh_token: 'ui-test',
          token_type: 'bearer',
          expires_at: exp,
          expires_in: 3600,
          user,
        };
        await context.addInitScript(
          ({ key, session }) => {
            if (!localStorage.getItem('barkolink-theme'))
              localStorage.setItem('barkolink-theme', 'light');
            localStorage.setItem(key, JSON.stringify(session));
          },
          { key: `sb-${projectRef}-auth-token`, session },
        );
        let fareConfig = {
            code: 'vessel',
            regularFare: 600,
            studentDiscount: 20,
            seniorDiscount: 20,
            childDiscount: 50,
            pwdDiscount: 20,
            pregnantDiscount: 0,
            customDiscounts: [],
          },
          fareSaves = 0;
        let readAt = null,
          markAllCalls = 0,
          lastBookingArgs = null,
          lastAuditArgs = null;
        let managedAccountCalls = 0,
          lastManagedInput = null,
          lastPortAssignment = null;
        let travelerSaveFails = false;
        await context.addInitScript(() =>
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: async (text) => {
                sessionStorage.setItem('ui-copied-password', text);
              },
            },
          }),
        );
        let profile = {
          uid: id,
          fullName: 'UI User',
          email: user.email,
          role,
          phone: '09123456789',
          assignedPortId: sailing.origin.id,
          assignedPort: { ...sailing.origin, isActive: true },
        };
        await context.route(`${projectUrl}/**`, async (route) => {
          const url = route.request().url();
          if (
            url.includes('/rest/v1/rpc/my_mfa_settings') ||
            url.includes('/rest/v1/rpc/set_staff_mfa_required')
          )
            return route.fulfill({
              json: {
                role,
                enabled: true,
                staffRequired: true,
                policyRequired: role !== 'ADMIN',
                mfaRequired: true,
              },
            });
          if (url.includes('/auth/v1/')) return route.fulfill({ json: user });
          if (url.includes('/functions/v1/weather'))
            return route.fulfill({ json: { configured: false, ports: [] } });
          if (
            url.includes('/functions/v1/weather') &&
            process.env.BARKOLINK_WEATHER_CHECK === '1'
          ) {
            const { portId } = route.request().postDataJSON();
            const current = {
              at: new Date().toISOString(),
              condition: 'Partly cloudy',
              temperatureC: 28,
              windKph: 18,
              gustKph: 25,
              visibilityKm: 9,
              rainChance: 35,
              cloudCover: 42,
            };
            const days = Array.from({ length: 7 }, (_, i) => ({
              date: new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(Date.now() + i * 86400000)),
              condition: 'Partly cloudy',
              conditionCode: 2,
              highC: 30,
              lowC: 24,
              rainChance: 35,
              windKph: 18,
            }));
            const ports = [sailing.origin, sailing.destination]
              .filter((port) => !portId || port.id === portId)
              .map((port, i) => ({
                ...port,
                available: true,
                current,
                days,
                forecast: portId ? null : current,
                role: i === 0 ? 'Departure port' : 'Arrival port',
              }));
            return route.fulfill({
              json: { configured: true, departureAt: sailing.departureAt, ports },
            });
          }
          if (url.includes('/functions/v1/manage-account')) {
            const { action, input } = route.request().postDataJSON();
            if (action === 'generateTemporaryPassword')
              return route.fulfill({ json: { password: 'Ui-generated-password123' } });
            assert.equal(action, 'createManagedUser');
            managedAccountCalls++;
            lastManagedInput = input;
            return route.fulfill({ json: { email: input.email, role: input.role } });
          }
          if (!url.includes('/rpc/barkolink_execute'))
            return route.fulfill({
              status: 403,
              json: { message: 'Direct access is blocked in this test.' },
            });
          const { operation, args } = route.request().postDataJSON();
          if (operation === 'MySaveTraveler')
            return route.fulfill(
              travelerSaveFails
                ? { status: 500, json: { message: 'Could not save traveler. Please retry.' } }
                : { json: {} },
            );
          if (operation === 'MyDeleteTraveler') return route.fulfill({ json: {} });
          let result;
          if (operation === 'AdminAssignStaffPort') {
            lastPortAssignment = args;
            return route.fulfill({ json: { uid: args.uid, assignedPortId: args.portId } });
          }
          if (operation === 'AdminStaffPortAssignments') {
            const staff = [
              {
                uid: 'user-a',
                fullName: 'Anna User',
                email: 'anna@example.invalid',
                role: 'TICKETING',
                assignedPortId: null,
                assignedPort: null,
              },
              {
                uid: 'user-m',
                fullName: 'Marco User',
                email: 'marco@example.invalid',
                role: 'BOARDING',
                assignedPortId: null,
                assignedPort: null,
              },
            ].filter(
              (u) =>
                (!args.role || args.role === 'ALL' || args.role === u.role) &&
                (!args.search ||
                  `${u.fullName} ${u.email}`.toLowerCase().includes(args.search.toLowerCase())),
            );
            return route.fulfill({
              json: {
                staff,
                totalCount: staff.length,
                ports: [sailing.origin, sailing.destination].map((p) => ({ ...p, isActive: true })),
              },
            });
          }
          if (operation === 'TicketingCreateGuestWalkIn') return route.fulfill({ json: {} });
          if (operation === 'AdminSaveFareSettings') {
            fareConfig = { ...fareConfig, ...args };
            fareSaves++;
            result = {};
          } else if (operation === 'MyMarkAllNotificationsRead') {
            markAllCalls++;
            readAt = new Date().toISOString();
            result = { marked: 1 };
          } else if (operation === 'UpdateMyProfile') {
            profile = { ...profile, fullName: args.fullName, phone: args.phone };
            user.user_metadata.fullName = args.fullName;
            result = { user_update: { uid: id } };
          } else if (operation === 'StaffBookings') {
            lastBookingArgs = args;
            const matches =
              (!args.search ||
                booking.reference.toLowerCase().includes(args.search.toLowerCase())) &&
              (!args.status || args.status === 'ALL' || args.status === 'PAID');
            result = { bookings: matches ? [booking] : [], totalCount: matches ? 1 : 0 };
          } else if (operation === 'AdminAuditLog') {
            lastAuditArgs = args;
            const fixture =
              args.entityType === 'operation_settings'
                ? {
                    id,
                    actorName: 'UI Administrator',
                    actorRole: 'ADMIN',
                    actorRoleRecorded: true,
                    action: 'UPDATE',
                    entityType: 'operation_settings',
                    entityId: 'DEFAULT',
                    createdAt: '2026-10-05T01:00:00Z',
                    details: { reservationMinutes: { before: 1440, after: 720 } },
                  }
                : {
                    id,
                    actorName: 'UI User',
                    actorRole: 'TICKETING',
                    actorRoleRecorded: false,
                    action: 'PAYMENT_RECEIVED',
                    entityType: 'booking',
                    entityId: 'UI-BOOKING',
                    details: { amount: 600, status: { after: 'COMPLETED', before: 'BOARDING' } },
                    createdAt: '2026-10-05T01:00:00Z',
                  };
            const matches =
              (!args.search ||
                (fixture.actorName + ' ' + fixture.action + ' ' + fixture.entityId)
                  .toLowerCase()
                  .includes(args.search.toLowerCase())) &&
              (!args.action || args.action === fixture.action);
            result = {
              records: matches ? [fixture] : [],
              totalCount: matches ? 1 : 0,
              actions: ['PAYMENT_RECEIVED', 'UPDATE'],
            };
          } else
            result = {
              MyProfile: { user: profile },
              AdminVouchers: { vouchers: [] },
              AdminLoyaltySettings: {
                settings: {
                  tripsPerReward: 5,
                  silverReward: 100,
                  goldReward: 200,
                  platinumReward: 300,
                  expiryDays: 30,
                },
              },
              MyBookings: {
                bookings: [
                  booking,
                  {
                    ...booking,
                    id: 'unpaid',
                    reference: 'UI-UNPAID',
                    paymentStatus: 'UNPAID',
                    status: 'PENDING',
                    paymentDeadline: new Date(Date.now() + 3600000).toISOString(),
                  },
                ],
              },
              MyNotifications: {
                notifications: [
                  {
                    id,
                    title: 'Booking updated',
                    message: 'Your ticket is ready.',
                    category: 'BOOKING',
                    createdAt: new Date().toISOString(),
                    readAt,
                  },
                ],
              },
              MySavedTravelers: {
                travelers: [
                  {
                    id,
                    fullName: 'UI Traveler',
                    birthDate: '1990-01-01',
                    sex: 'FEMALE',
                    phone: '09123456789',
                    nationality: 'Filipino',
                  },
                ],
              },
              ActiveAdvisories: { advisories: [advisory] },
              AdminAdvisories: { advisories: [advisory] },
              AdminSailingOptions: { sailings: [sailing] },
              AdminReports: { sailings: [] },
              TicketingSailings: { sailings: [sailing] },
              AdminSailings: { sailings: [sailing], totalCount: 1 },
              BrowseSailings: { sailings: [sailing] },
              BrowseActivePorts: { ports: [sailing.origin, sailing.destination] },
              PassengerSailingBoard: {
                date: '2099-01-01',
                updatedAt: new Date().toISOString(),
                sailings: [],
              },
              ActiveTravelAdvisories: { advisories: [] },
              QuoteLoyaltyVoucher: { quote: null },
              MyLoyalty: {
                completedTrips: 0,
                rewardValue: 100,
                tripsToNextReward: 5,
                tripsPerReward: 5,
                currentTier: 'Bronze',
                tiers: [{ name: 'Bronze', trips: 5, value: 100 }],
                vouchers: [],
              },
              AdminPorts: {
                ports: [sailing.origin, sailing.destination].map((p) => ({ ...p, isActive: true })),
              },
              AdminVessels: { vessels: [sailing.vessel] },
              AdminSailingBookings: { bookings: [] },
              AdminUsers: {
                users: [
                  {
                    uid: 'user-z',
                    fullName: 'Zelda User',
                    email: 'zelda@example.invalid',
                    role: 'PASSENGER',
                    createdAt: '2026-10-05T01:00:00Z',
                  },
                  {
                    uid: 'user-a',
                    fullName: 'Anna User',
                    email: 'anna@example.invalid',
                    role: 'TICKETING',
                    createdAt: '2026-10-05T01:00:00Z',
                  },
                  {
                    uid: 'user-m',
                    fullName: 'Marco User',
                    email: 'marco@example.invalid',
                    role: 'BOARDING',
                    createdAt: '2026-10-05T01:00:00Z',
                  },
                ],
                totalCount: 3,
              },
              AdminPassengerRecords: { bookingPassengers: [], totalCount: 0 },
              AdminOperationsSettings: { reservationMinutes: 1440 },
              AdminDailySchedules: { schedules: [], routes: [] },
              AdminSailingStatusPolicies: {
                policies: [
                  {
                    operator: 'UI Ferry Operator',
                    boardingLeadMinutes: null,
                    boardingTimeSource: null,
                    autoComplete: true,
                  },
                ],
              },
              AdminVesselPositions: {
                vessels: Array.from({ length: 12 }, (_, i) => ({
                  ...sailing.vessel,
                  id: `vessel-${i}`,
                  name: `MV Example ${i + 1}`,
                  operator: 'Sample Shipping Lines',
                  position:
                    i === 2
                      ? { state: 'DELAYED', tripCode: 'TRIP-DELAYED' }
                      : i === 1
                        ? {
                            state: 'UNDERWAY',
                            originPortId: sailing.origin.id,
                            destinationPortId: sailing.destination.id,
                            arrivalAt: sailing.arrivalAt,
                          }
                        : {
                            state: 'EXPECTED',
                            portName: i % 2 ? 'Batangas Port' : 'Calapan Port',
                            tripCode: `TRIP-${i + 1}`,
                          },
                })),
                ports: [sailing.origin, sailing.destination],
              },
              AdminVesselAvailability: { vessels: [{ id: sailing.vessel.id, issue: null }] },
              AdminActivityLog: {
                records: [
                  {
                    id,
                    actorName: 'UI Administrator',
                    action: 'UPDATE',
                    entityType: 'operation_settings',
                    entityId: 'DEFAULT',
                    createdAt: '2026-10-05T01:00:00Z',
                    details: { reservationMinutes: { before: 1440, after: 720 } },
                  },
                ],
                totalCount: 1,
              },
              BoardingSailingTiming: boardingTimingFixture(sailing),
              StaffBookings: { bookings: [booking], totalCount: 1 },
              BoardingSailings: { sailings: [sailing] },
              BoardingManifest: { bookings: [booking] },
              BoardingActivity: { boardingEvents: [] },
              AdminDashboardStats: {},
              AdminFareSettings: { fareSettings: null, vesselFareSettings: [fareConfig] },
              AdminNextTripCode: { nextTripCode: { code: 'TRP2026-1004001' } },
              AdminOverview: {
                stats: {
                  todayTrips: 5,
                  todayBookings: 0,
                  todayPassengers: 72,
                  checkedIn: 0,
                  boarded: 0,
                  noShow: 0,
                  cancelled: 0,
                  utilization: 4.5,
                },
                trips: Array.from({ length: 5 }, (_, i) => ({
                  ...sailing,
                  code: `UI-TRIP-${i + 1}`,
                  status: i === 4 ? 'BOARDING' : 'COMPLETED',
                  vessel: { ...sailing.vessel, name: `MV Example ${i + 1}` },
                })),
                monthly: [
                  { month: 'May', bookings: 10, passengers: 18 },
                  { month: 'Jun', bookings: 18, passengers: 24 },
                  { month: 'Jul', bookings: 22, passengers: 35 },
                  { month: 'Aug', bookings: 25, passengers: 41 },
                  { month: 'Sep', bookings: 30, passengers: 46 },
                  { month: 'Oct', bookings: 729, passengers: 2294 },
                ],
                bookingStatus: [
                  { name: 'Cancelled', value: 43 },
                  { name: 'Completed', value: 596 },
                  { name: 'Confirmed', value: 94 },
                  { name: 'Expired', value: 133 },
                ],
                categories: [
                  'REGULAR',
                  'STUDENT',
                  'SENIOR',
                  'CHILD',
                  'PWD',
                  'PREGNANT',
                  'RESIDENT',
                ].map((name, i) => ({ name, value: [391, 316, 314, 307, 301, 295, 3][i] })),
                routes: [
                  { route: 'Calapan City to Batangas City', passengers: 1199 },
                  { route: 'Batangas City to Calapan City', passengers: 725 },
                  { route: 'Batangas City to Puerto Galera', passengers: 3 },
                ],
              },
              AdminAccommodations: { accommodations: [] },
              AdminRoutes: { routes: [] },
              AdminNotificationCampaigns: { campaigns: [], totalCount: 0 },
              StaffSailings: { sailings: [sailing], totalCount: 1 },
              StaffPassengers: { passengers: [{ ...passenger, booking }], totalCount: 1 },
              StaffFares: {
                fares: [
                  {
                    vesselName: sailing.vessel.name,
                    regularFare: 600,
                    studentDiscount: 20,
                    seniorDiscount: 20,
                    childDiscount: 50,
                    pwdDiscount: 20,
                    pregnantDiscount: 0,
                    accommodations: [],
                  },
                ],
              },
              StaffNoShows: { sailing, passengers: [{ ...passenger, booking, noShow: false }] },
              StaffDashboard: { bookings: 6, paid: 4, unpaid: 2, trips: 1 },
              AdminTripOperations: {
                sailing,
                bookings: [booking],
                passengers: [{ ...passenger, booking }],
                activity: [],
              },
            }[operation];
          if (result === undefined) {
            missing.add(operation);
            return route.fulfill({
              status: 500,
              json: { message: 'Missing audit fixture: ' + operation },
            });
          }
          assert.notEqual(result, undefined, `Unhandled fixture operation: ${operation}`);
          await route.fulfill({ json: result });
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (['error', 'warning'].includes(message.type()) && message.text().includes('AG Grid'))
            errors.push(message.text());
        });
        await context.addInitScript(
          (theme) => localStorage.setItem('barkolink-theme', theme),
          theme,
        );
        const paths =
          role === 'ADMIN'
            ? [
                '/admin',
                ...[
                  'bookings',
                  'passengers',
                  'trips',
                  'trip-operations',
                  'ports',
                  'routes',
                  'vessels',
                  'accommodation',
                  'fares',
                  'vouchers',
                  'check-in',
                  'boarding',
                  'manifest',
                  'no-shows',
                  'advisories',
                  'notifications',
                  'reports',
                  'analytics',
                  'users',
                  'staff-ports',
                  'audit-logs',
                  'operations',
                  'inbox',
                ].map((section) => '/admin/' + section),
                ...['profile', 'password', 'appearance'].map(
                  (section) => '/admin/settings/' + section,
                ),
              ]
            : [
                `/staff/${role.toLowerCase()}`,
                ...(role === 'TICKETING'
                  ? ['bookings', 'walk-in', 'passengers', 'trips', 'fares', 'notifications']
                  : ['trips', 'check-in', 'boarding', 'manifest', 'no-shows', 'notifications']
                ).map((section) => `/staff/${role.toLowerCase()}/${section}`),
                ...['account', 'security', 'appearance'].map(
                  (section) => `/staff/${role.toLowerCase()}/settings/${section}`,
                ),
              ];
        const selected = process.env.BARKOLINK_UI_PATHS?.split(',');
        for (const target of paths.filter((target) => !selected || selected.includes(target))) {
          const name = `${role.toLowerCase()}-${width}-${theme}-${target.replaceAll('/', '-').slice(1)}`;
          try {
            await page.goto(baseUrl + target, { waitUntil: 'domcontentloaded' });
            await page.locator('main:visible h1').first().waitFor({ timeout: 15000 });
            await page.waitForTimeout(300);
            assert.equal(
              new URL(page.url()).pathname,
              target === '/admin/analytics' ? '/admin/reports' : target,
              'Assigned role enters the requested page',
            );
            const content = page
              .locator(
                '.content:visible, .reference-content:visible, .staff-settings-page:visible, .walk-in-page:visible, .settings-page:visible',
              )
              .first();
            const layout = await content.evaluate((el) => ({
              width: el.clientWidth,
              scroll: el.scrollWidth,
              padding: parseFloat(getComputedStyle(el).paddingTop),
            }));
            assert.ok(
              layout.scroll <= layout.width + 2,
              `Content overflows: ${JSON.stringify(layout)}`,
            );
            assert.ok(layout.padding <= 20, `Page padding stays compact: ${layout.padding}`);
            const alerts = await page.locator('[role="alert"]:visible').allTextContents();
            assert.deepEqual(alerts, [], 'Page loads without errors');
            if (role !== 'ADMIN') {
              const navigation = page.locator('.staff-navigation');
              if (width > 800) {
                const links = await navigation
                  .locator('a')
                  .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
                assert.ok(
                  links.every((height) => height <= 42),
                  `Staff navigation stays compact: ${links}`,
                );
                assert.equal(
                  await navigation.locator('a[aria-current="page"]').count(),
                  target.includes('/settings/') || target.endsWith('/notifications') ? 0 : 1,
                );
              }
              if (
                role === 'BOARDING' &&
                !target.includes('/settings/') &&
                !target.endsWith('/notifications') &&
                !target.endsWith('/trips') &&
                !target.endsWith('/no-shows')
              ) {
                assert.equal(await page.locator('.sailing-status').innerText(), 'Scheduled');
                assert.match(
                  await page.locator('.gate-note').innerText(),
                  /automatically at the saved boarding time/,
                );
                if (width <= 700) {
                  const picker = await page.locator('#boarding-sailing').boundingBox();
                  assert.ok(
                    picker.width > 290,
                    `Sailing selector uses the card width: ${picker.width}`,
                  );
                }
              }
            }
            if (target === '/admin/bookings' || target === '/admin/trips') {
              const panel = page.locator('.booking-records-panel');
              assert.equal(
                await panel.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
                0,
                'Records container does not double its internal padding',
              );
              await panel.getByRole('button', { name: 'Columns', exact: true }).waitFor();
              assert.equal(await panel.locator('.grid-scope').innerText(), 'on this page');
              if (width > 700) {
                const grid = await panel.locator('.desktop-grid').boundingBox();
                assert.ok(grid.y < 580, `Records start within the first screen: ${grid.y}`);
                reports.push({ target, width, theme, recordsTop: Math.round(grid.y) });
              }
              if (target === '/admin/trips') {
                await page.getByRole('button', { name: 'Daily schedules', exact: true }).click();
                assert.equal(await page.locator('.daily-schedules').isVisible(), true);
                assert.equal(await panel.isVisible(), false);
                await page.getByRole('button', { name: 'Actual trips', exact: true }).click();
                assert.equal(await panel.isVisible(), true);
                await content.evaluate((el) => el.closest('ion-content')?.scrollToTop(0));
              }
            }
            if (target === '/admin') {
              const cards = await page
                .locator('.overview-metrics article')
                .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
              const chart = await page.locator('.analytics-grid').boundingBox();
              assert.ok(
                cards.every((height) => height <= (width > 700 ? 145 : 175)),
                `Summary cards remain compact: ${cards}`,
              );
              const attendance = await page.locator('.attendance-strip').boundingBox();
              assert.ok(
                chart.y >= attendance.y + attendance.height &&
                  chart.y - attendance.y - attendance.height <= 20,
                'Charts follow the attendance summary without overlap or excess space',
              );
              const overview = page.locator('.operations-overview');
              const trend = overview.locator('.trend-panel');
              const svg = trend.locator('svg');
              const figureBox = await svg.boundingBox();
              assert.ok(
                figureBox.width <= (await trend.boundingBox()).width,
                'Chart fits its card',
              );
              const focusTarget = trend.locator('svg rect[tabindex]').last();
              await focusTarget.focus();
              assert.match(await trend.locator('.trend-readout').innerText(), /729 bookings/);
              await focusTarget.blur();
              if (width <= 700)
                assert.equal(
                  await overview
                    .locator('.today-trips table')
                    .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
                  true,
                  'Departures do not need sideways scrolling',
                );
              reports.push({
                target,
                width,
                theme,
                cards,
                chartTop: Math.round(chart.y),
                dashboardHeight: Math.round((await overview.boundingBox()).height),
              });
              await page.locator('.content:visible').evaluate((el) => {
                const scroll = el.closest('ion-content');
                void scroll?.scrollToTop(0);
              });
            }
            if (target === '/admin/vessels') {
              const tracking = page.locator('.tracking-panel');
              await tracking
                .getByRole('heading', { name: 'Vessel locations', exact: true })
                .waitFor();
              assert.equal(
                await tracking.getByRole('button', { name: 'Confirm port', exact: true }).count(),
                0,
              );
              assert.equal(await tracking.locator('.location-list article').count(), 5);
              assert.equal(
                await tracking
                  .locator('.location-list')
                  .evaluate((el) => getComputedStyle(el).overflowY),
                'visible',
              );
              assert.equal(await tracking.locator('.manual-correction').getAttribute('open'), null);
              await tracking.getByRole('button', { name: 'Next', exact: true }).click();
              assert.match(
                await tracking.locator('.tracking-pagination').innerText(),
                /6-10 of 12/,
              );
              await tracking.getByRole('button', { name: 'Previous', exact: true }).click();
              await tracking.scrollIntoViewIfNeeded();
              await tracking.screenshot({
                path: `.audit/workspace-density/tracking-${width}-${theme}.png`,
              });
            }
            await page.screenshot({
              path: `.audit/workspace-density/${name}.png`,
              animations: 'disabled',
            });
            if (target === '/admin')
              for (const panel of [
                'trend-panel',
                'booking-panel',
                'routes-panel',
                'categories-panel',
                'today-trips',
              ]) {
                const card = page.locator(`.operations-overview .${panel}`);
                await card.scrollIntoViewIfNeeded();
                await card.screenshot({
                  path: `.audit/workspace-density/dashboard-${panel}-${width}-${theme}.png`,
                });
              }
            reports.push({ target, width, theme, passed: true });
          } catch (error) {
            problems.push({ target, width, theme, message: error.message });
            console.error(`${target} ${width}px ${theme}: ${error.message}`);
            await page
              .screenshot({
                path: `.audit/workspace-density/${name}-failure.png`,
                animations: 'disabled',
              })
              .catch(() => {});
          }
        }
        console.log(
          `${role} ${width}px ${theme}: checked ${paths.filter((target) => !selected || selected.includes(target)).length} pages`,
        );
        fs.writeFileSync(
          '.audit/workspace-density/report.json',
          JSON.stringify({ reports, problems, missing: [...missing], errors }, null, 2),
        );
        await context.close();
      }
  fs.writeFileSync(
    '.audit/workspace-density/report.json',
    JSON.stringify({ reports, problems, missing: [...missing], errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      checked: reports.filter((report) => report.passed).length,
      dashboards: reports.filter((report) => report.cards),
      problems,
      missing: [...missing],
      errors,
    }),
  );
  assert.deepEqual([...missing], [], 'All backend data comes from supported audit fixtures');
  assert.deepEqual(problems, [], 'Every admin and staff page passes density and layout checks');
  assert.deepEqual(errors, [], 'No browser runtime errors');
} finally {
  await browser.close();
}
