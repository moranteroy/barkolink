import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import { createTicketPdf } from '../../src/data/ticketPdf';
import type { TicketBooking } from '../../src/data/ticketExport';

const booking: TicketBooking = {
  reference: 'PDF-TEST',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  from: 'Calapan Port',
  to: 'Batangas Port',
  date: 'Nov 7, 2099',
  departure: '1:00 PM',
  departureAt: '2099-11-07T05:00:00Z',
  arrivalAt: '2099-11-07T07:00:00Z',
  vessel: 'MV Test Ferry',
  sailingStatus: 'SCHEDULED',
  passengers: [
    {
      name: 'José Peña',
      type: 'Regular',
      ticketCode: 'PDF-TICKET',
      ticketStatus: 'ISSUED',
      ticketQrPayload: 'server-issued-payload',
    },
  ],
};
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      arrayBuffer: async () => {
        const data = readFileSync(
          url.includes('Bold')
            ? 'public/fonts/NotoSans-Bold.ttf'
            : 'public/fonts/NotoSans-Regular.ttf',
        );
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      },
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('creates a real Unicode PDF with a separate page and server QR for every passenger', async () => {
  const encode = vi.spyOn(QRCode, 'toDataURL');
  const pdf = await createTicketPdf({
    ...booking,
    passengers: [
      booking.passengers[0]!,
      {
        ...booking.passengers[0]!,
        name: 'Second Passenger',
        ticketQrPayload: 'second-server-payload',
      },
    ],
  });
  expect(pdf.getNumberOfPages()).toBe(2);
  expect(pdf.getFontList()).toHaveProperty('NotoSans');
  expect(pdf.output()).toMatch(/^%PDF-/);
  expect(pdf.output()).toContain('/Subtype /Image');
  expect(encode.mock.calls.map((call) => call[0])).toEqual([
    'server-issued-payload',
    'second-server-payload',
  ]);
  mkdirSync('.audit/ticket-pdf', { recursive: true });
  writeFileSync('.audit/ticket-pdf/sample-group.pdf', Buffer.from(pdf.output('arraybuffer')));
});
it('keeps used and expired tickets as records without a reusable QR', async () => {
  const encode = vi.spyOn(QRCode, 'toDataURL');
  const pdf = await createTicketPdf({
    ...booking,
    passengers: [{ ...booking.passengers[0]!, ticketStatus: 'BOARDED' }],
  });
  expect(pdf.output()).not.toContain('/Subtype /Image');
  await createTicketPdf({ ...booking, arrivalAt: '2020-01-01T00:00:00Z' });
  expect(encode).not.toHaveBeenCalled();
});
it('blocks unpaid and unverified exports', async () => {
  await expect(createTicketPdf({ ...booking, paymentStatus: 'UNPAID' })).rejects.toThrow('paid');
  await expect(createTicketPdf({ ...booking, paymentVerificationRequired: true })).rejects.toThrow(
    'paid',
  );
});
it('rejects missing server QR data instead of encoding the plain ticket code', async () => {
  await expect(
    createTicketPdf({
      ...booking,
      passengers: [{ ...booking.passengers[0]!, ticketQrPayload: null }],
    }),
  ).rejects.toThrow('verified QR');
});
