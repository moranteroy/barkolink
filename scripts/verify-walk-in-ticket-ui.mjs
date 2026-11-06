import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import jsQR from 'jsqr';
import { fixtureProject, fixtureBrowserOptions } from './browser-fixture-config.mjs';

const project = fixtureProject(),
  base = process.env.BARKOLINK_UI_URL || 'http://127.0.0.1:8127';
const id = '11111111-1111-4111-8111-111111111111';
const sailing = {
  code: 'WALK-IN-TRIP',
  departureAt: '2099-11-06T05:00:00Z',
  arrivalAt: '2099-11-06T07:00:00Z',
  status: 'SCHEDULED',
  availableSeats: 100,
  regularFare: 600,
  studentFare: 480,
  seniorFare: 480,
  childFare: 300,
  pwdFare: 480,
  origin: { id: 'batangas', name: 'Batangas Port', city: 'Batangas' },
  destination: { name: 'Calapan Port', city: 'Calapan' },
  vessel: { name: 'Fixture Ferry' },
  accommodations: [],
};
fs.mkdirSync('.audit/walk-in-ticket', { recursive: true });
const browser = await chromium.launch(fixtureBrowserOptions());
let activePage;
async function decode(image) {
  const frame = await image.evaluate((img) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
    };
  });
  return jsQR(new Uint8ClampedArray(frame.data), frame.width, frame.height)?.data;
}
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark']) {
      const user = {
        id,
        email: 'ticketing@example.invalid',
        app_metadata: { role: 'TICKETING' },
        user_metadata: { fullName: 'Counter Staff' },
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
      };
      const exp = Math.floor(Date.now() / 1000) + 3600,
        encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const session = {
        access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: id, exp, aal: 'aal2', role: 'authenticated', app_metadata: user.app_metadata })}.fixture`,
        refresh_token: 'fixture',
        token_type: 'bearer',
        expires_at: exp,
        expires_in: 3600,
        user,
      };
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(
        ({ project, session, theme }) => {
          localStorage.setItem(
            'sb-' + new URL(project).hostname.split('.')[0] + '-auth-token',
            JSON.stringify(session),
          );
          localStorage.setItem('barkolink-theme', theme);
          window.print = () => {
            window.__ticketPrinted = true;
          };
        },
        { project, session, theme },
      );
      let booking = null,
        mutations = 0,
        payload;
      await context.route(project + '/**', (route) => {
        if (route.request().url().includes('/auth/')) return route.fulfill({ json: user });
        const { operation, args } = route.request().postDataJSON() || {};
        if (operation === 'TicketingCreateGuestWalkIn') {
          mutations++;
          payload = JSON.stringify({
            BarkoLink: 'Ticket v2',
            Name: args.passengerName,
            Date: '2099-11-06 13:00 Philippine time',
            Vessel: sailing.vessel.name,
            Route: 'Batangas Port to Calapan Port',
            Booking: args.reference,
            Ticket: args.ticketCode,
            Verification: 'f'.repeat(64),
          });
          booking = {
            id,
            reference: args.reference,
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
            passengerCount: 1,
            total: 600,
            serviceFee: 0,
            bookingChannel: 'WALK_IN',
            createdAt: new Date().toISOString(),
            owner: { fullName: args.passengerName, email: args.guestEmail },
            sailing,
            bookingPassengers_on_booking: [
              {
                id,
                fullName: args.passengerName,
                passengerType: 'REGULAR',
                fare: 600,
                ticketStatus: 'ISSUED',
                ticketCode: args.ticketCode,
                ticketQrPayload: payload,
              },
            ],
          };
          if (width === 390 && theme === 'dark')
            return route.fulfill({
              status: 500,
              json: { message: 'Sale committed; response was lost.' },
            });
          return route.fulfill({ json: { booking_insert: { id } } });
        }
        const fixtures = {
          MyProfile: {
            user: {
              uid: id,
              fullName: 'Counter Staff',
              role: 'TICKETING',
              assignedPortId: 'batangas',
              assignedPort: { id: 'batangas', name: 'Batangas Port', isActive: true },
            },
          },
          TicketingSailings: { sailings: [sailing] },
          StaffBookings: { bookings: booking ? [booking] : [], totalCount: booking ? 1 : 0 },
          StaffDashboard: { bookings: booking ? 1 : 0, paid: booking ? 1 : 0, unpaid: 0, trips: 1 },
          MyNotifications: { notifications: [] },
        };
        return route.fulfill({ json: fixtures[operation] || {} });
      });
      const page = await context.newPage(),
        errors = [];
      activePage = page;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/staff/ticketing/walk-in', { waitUntil: 'networkidle' });
      await page.getByLabel(/^Sailing/).selectOption(sailing.code);
      await page.getByLabel('Full name', { exact: true }).fill('Walk-in Guest');
      await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01');
      await page.getByLabel(/^Sex/).selectOption('Male');
      await page.getByRole('button', { name: 'Review cash payment', exact: true }).click();
      await page.getByRole('button', { name: /Cash received.*issue ticket/ }).click();
      const ticket = page.getByRole('region', { name: 'Passenger e-tickets' });
      await ticket.locator('img').waitFor();
      assert.equal(await decode(ticket.locator('img')), payload);
      assert.equal(mutations, 1);
      assert.match(await ticket.innerText(), /1:00 PM/);
      await ticket.screenshot({ path: '.audit/walk-in-ticket/' + width + '-' + theme + '.png' });
      const [printed] = await Promise.all([
        page.waitForEvent('popup'),
        ticket.getByRole('button', { name: 'Print/PDF e-ticket', exact: true }).click(),
      ]);
      await printed.waitForFunction(() => window.__ticketPrinted === true);
      assert.equal(await decode(printed.locator('img')), payload);
      assert.match(await printed.locator('body').innerText(), new RegExp(booking.reference));
      await printed.close();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        ticket.getByRole('button', { name: 'Download e-ticket', exact: true }).click(),
      ]);
      assert.equal(download.suggestedFilename(), 'BarkoLink-' + booking.reference + '.html');
      await page.goto(base + '/staff/ticketing/bookings', { waitUntil: 'networkidle' });
      await page.locator('.queue-update').first().click();
      await page.getByRole('heading', { name: 'Booking and payment', exact: true }).waitFor();
      const reopened = page.getByRole('region', { name: 'Passenger e-tickets' });
      await reopened.locator('img').waitFor();
      assert.equal(await decode(reopened.locator('img')), payload);
      assert.equal(mutations, 1);
      assert.deepEqual(errors, []);
      console.log(
        'PASS walk-in ' +
          width +
          'px ' +
          theme +
          ': cash issuance, server QR, print/download and queue reprint; no duplicate sale.',
      );
      await context.close();
    }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: '.audit/walk-in-ticket/failure.png', fullPage: true });
    fs.writeFileSync('.audit/walk-in-ticket/failure.html', await activePage.content());
  }
  throw error;
} finally {
  await browser.close();
}
