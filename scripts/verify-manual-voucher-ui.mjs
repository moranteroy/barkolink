import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { fixtureProject, fixtureBrowserOptions } from './browser-fixture-config.mjs';

const base = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8127',
  project = fixtureProject();
const id = '11111111-1111-4111-8111-111111111111';
const loyaltyCode = 'VCH-ABCDEFGHIJKLMNOPQRSTUVWX12';
const trip = {
  id: 'MANUAL-VOUCHER-TRIP',
  selectionId: 'MANUAL-SELECTION',
  from: 'Batangas Port',
  to: 'Calapan Port',
  vessel: 'Fixture Ferry',
  available: 20,
  passengerCount: 1,
  regularFare: 600,
  date: 'Oct 8, 2099',
  departure: '12:16 PM',
  arrival: '2:16 PM',
};
const sailing = {
  code: trip.id,
  status: 'SCHEDULED',
  departureAt: '2099-10-08T04:16:00Z',
  arrivalAt: '2099-10-08T06:16:00Z',
  availableSeats: 20,
  regularFare: 600,
  accommodations: [],
  origin: { name: trip.from, city: 'Batangas City' },
  destination: { name: trip.to, city: 'Calapan City' },
  vessel: { name: trip.vessel },
};
const person = {
  id,
  name: 'Voucher Traveler',
  type: 'Regular',
  birthDate: '1990-01-01',
  sex: 'Female',
  phone: '09171234567',
  nationality: 'Filipino',
};
const user = {
  id,
  email: 'voucher@example.invalid',
  app_metadata: { role: 'PASSENGER' },
  user_metadata: { fullName: person.name },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};
const exp = Math.floor(Date.now() / 1000) + 3600,
  encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const session = {
  access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: id, exp, role: 'authenticated', app_metadata: user.app_metadata })}.fixture`,
  refresh_token: 'fixture',
  token_type: 'bearer',
  expires_at: exp,
  expires_in: 3600,
  user,
};
fs.mkdirSync('.audit/manual-voucher', { recursive: true });
const browser = await chromium.launch(fixtureBrowserOptions());
let checks = 0;
try {
  for (const width of [320, 390, 1440])
    for (const theme of ['light', 'dark'])
      for (const manual of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: 'reduce',
        });
        await context.addInitScript(
          ({ key, session, trip, person, id, theme }) => {
            localStorage.setItem(key, JSON.stringify(session));
            localStorage.setItem('barkolink-theme', theme);
            localStorage.setItem('barkolink-selected-trip', JSON.stringify(trip));
            sessionStorage.setItem(
              'barkolink-booking-draft',
              JSON.stringify({
                ownerUid: id,
                sailingCode: trip.id,
                selectionId: trip.selectionId,
                passengers: [person],
              }),
            );
          },
          {
            key: `sb-${new URL(project).hostname.split('.')[0]}-auth-token`,
            session,
            trip,
            person,
            id,
            theme,
          },
        );
        const bookings = [],
          requests = [];
        let reservations = 0;
        await context.route(`${project}/**`, (route) => {
          const url = route.request().url();
          if (url.includes('/auth/')) return route.fulfill({ json: user });
          if (url.includes('/functions/v1/weather'))
            return route.fulfill({ json: { configured: false, ports: [] } });
          const { operation, args } = route.request().postDataJSON() || {};
          requests.push(operation);
          if (operation === 'QuoteLoyaltyVoucher')
            return route.fulfill({
              json: { quote: { code: 'LOYALTY100', discount: 100, subtotal: 600, total: 500 } },
            });
          if (operation === 'QuoteVoucher') {
            if (args.voucherCode === 'BAD')
              return route.fulfill({
                status: 400,
                json: { message: 'Voucher is invalid, inactive, or expired.' },
              });
            const discount = args.voucherCode === 'PROMO50' ? 50 : 100;
            return route.fulfill({
              json: { code: args.voucherCode, discount, subtotal: 600, total: 600 - discount },
            });
          }
          if (operation === 'ReserveSailing1') {
            assert.equal(args.voucherCode, manual ? loyaltyCode : undefined);
            assert.equal(args.expectedVoucherDiscount, manual ? 100 : undefined);
            reservations++;
            bookings.push({
              id: args.reference,
              reference: args.reference,
              sailing,
              total: manual ? 500 : 600,
              voucherCode: args.voucherCode,
              voucherDiscount: manual ? 100 : 0,
              passengerCount: 1,
              status: 'PENDING',
              paymentStatus: 'UNPAID',
              paymentDeadline: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              bookingPassengers_on_booking: [
                {
                  id,
                  fullName: person.name,
                  passengerType: 'REGULAR',
                  fare: 600,
                  ticketStatus: 'PENDING',
                },
              ],
            });
            return route.fulfill({ json: {} });
          }
          const response = {
            BrowseSailings: { sailings: [sailing] },
            MyBookings: { bookings },
            MyProfile: {
              user: { uid: id, fullName: person.name, phone: person.phone, role: 'PASSENGER' },
            },
            MySavedTravelers: { travelers: [] },
            SavedTravelers: { travelers: [] },
            MyNotifications: { notifications: [], unreadCount: 0 },
            ActiveAdvisories: { advisories: [] },
          }[operation];
          assert.ok(response, `Missing voucher fixture: ${operation}`);
          return route.fulfill({ json: response });
        });
        const page = await context.newPage(),
          errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(base + '/booking-summary');
        const input = page.getByLabel('Have a voucher?', { exact: true });
        await input.waitFor();
        await page.waitForTimeout(400);
        assert.equal(await input.inputValue(), '');
        assert.equal(await page.locator('.voucher-discount').count(), 0);
        assert.equal(
          requests.includes('QuoteLoyaltyVoucher'),
          false,
          'A ready loyalty reward must never auto-fill or auto-apply',
        );
        assert.equal(
          await page.getByText('Claim vouchers & view codes', { exact: true }).count(),
          0,
        );
        if (manual) {
          await input.fill('BAD');
          await page.getByRole('button', { name: 'Apply', exact: true }).click();
          await page.locator('.voucher-entry [role=alert]').waitFor();
          await input.fill('PROMO50');
          assert.equal(await page.locator('.voucher-discount').count(), 0);
          await page.getByRole('button', { name: 'Apply', exact: true }).click();
          await page.locator('.voucher-discount').waitFor();
          assert.match(await page.locator('.review-fares .total').textContent(), /550/);
          await page.getByRole('button', { name: 'Remove', exact: true }).click();
          assert.equal(await input.inputValue(), '');
          assert.match(await page.locator('.review-fares .total').textContent(), /600/);
          await input.fill(loyaltyCode);
          await page.getByRole('button', { name: 'Apply', exact: true }).click();
          await page.locator('.voucher-discount').waitFor();
          assert.match(await page.locator('.review-fares .total').textContent(), /500/);
          assert.equal(await page.locator('.voucher-applied code').innerText(), loyaltyCode);
          const result = page.locator('.voucher-applied');
          assert.ok(
            await result.evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
            'Applied voucher panel fits long codes',
          );
          assert.ok(
            (await result.getByRole('button', { name: 'Remove', exact: true }).boundingBox())
              .height >= 44,
          );
        }
        await page.locator('.voucher-entry').screenshot({
          path: `.audit/manual-voucher/${width}-${theme}-${manual ? 'applied' : 'empty'}.png`,
        });
        await page.getByRole('button', { name: 'Confirm reservation', exact: true }).click();
        await page.waitForURL('**/booking-confirmed?reference=**');
        assert.equal(reservations, 1);
        assert.equal(requests.includes('QuoteLoyaltyVoucher'), false);
        assert.deepEqual(errors, []);
        checks++;
        console.log(
          `PASS voucher ${width}px ${theme}: ${manual ? 'manual promo/loyalty apply' : 'full-fare without voucher'}`,
        );
        await context.close();
      }
  console.log(`${checks} manual-voucher booking checks passed.`);
} finally {
  await browser.close();
}
