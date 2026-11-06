import { beforeEach, describe, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { ticketDocument, printTicketDocument } from '../../src/data/ticketExport';
const native = vi.hoisted(() => ({ platform: 'web', print: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform },
  registerPlugin: () => ({ print: native.print }),
}));
beforeEach(() => {
  native.platform = 'web';
  native.print.mockClear();
});
const code = '11111111-1111-4111-8111-111111111111';
const payload = JSON.stringify({
  BarkoLink: 'Ticket v2',
  Name: 'Passenger & One',
  Date: '2026-10-04 08:00 Philippine time',
  Vessel: 'Test ferry',
  Route: 'Calapan to Batangas',
  Booking: 'BL-TEST',
  Ticket: code,
  Verification: 'a'.repeat(64),
});
const booking = {
  reference: 'BL-TEST',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  from: '<script>alert(1)</script>',
  to: 'Batangas',
  date: 'Oct 4, 2026',
  departure: '8:00 AM',
  vessel: 'Test ferry',
  passengers: [
    {
      name: 'Passenger & One',
      type: 'Regular',
      ticketCode: code,
      ticketQrPayload: payload,
      ticketStatus: 'ISSUED',
    },
  ],
};
describe('Downloadable tickets', () => {
  it('opens Android printing with only an eligible isolated ticket document', async () => {
    native.platform = 'android';
    await printTicketDocument(booking);
    expect(native.print).toHaveBeenCalledOnce();
    const document = native.print.mock.calls[0][0];
    expect(document.jobName).toContain(booking.reference);
    expect(document.html).toContain('Passenger &amp; One');
    expect(document.html).toContain('data:image/png');
    expect(document.html).not.toContain('ticket-actions');
    await expect(printTicketDocument({ ...booking, paymentStatus: 'UNPAID' })).rejects.toThrow(
      'paid',
    );
    expect(native.print).toHaveBeenCalledOnce();
  });
  it('exports historical and used tickets as records without a reusable QR', async () => {
    for (const record of [
      { ...booking, arrivalAt: '2000-01-01T00:00:00Z' },
      { ...booking, sailingStatus: 'COMPLETED' },
      {
        ...booking,
        passengers: [{ ...booking.passengers[0], ticketStatus: 'BOARDED', ticketQrPayload: null }],
      },
    ]) {
      const html = await ticketDocument(record);
      expect(html).toContain('Transaction record only');
      expect(html).not.toContain('data:image/png');
      expect(html).toContain(code);
    }
    await expect(ticketDocument({ ...booking, paymentVerificationRequired: true })).rejects.toThrow(
      'paid',
    );
  });
  it('uses the normal payment status on exported online tickets', async () => {
    const html = await ticketDocument({ ...booking, paymentMethod: 'PAYMONGO_TEST' });
    expect(html).toContain('PAID');
    expect(html).not.toContain('TEST PAYMENT');
  });
  it('exports issued paid tickets with embedded QR and escaped passenger text', async () => {
    const html = await ticketDocument(booking);
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('Passenger &amp; One');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('https://');
    expect(html).toContain(code);
    await expect(ticketDocument({ ...booking, paymentStatus: 'UNPAID' })).rejects.toThrow('paid');
    await expect(ticketDocument({ ...booking, status: 'CANCELLED' })).rejects.toThrow('paid');
    await expect(
      ticketDocument({
        ...booking,
        passengers: [{ ...booking.passengers[0], ticketStatus: 'CANCELLED' }],
      }),
    ).rejects.toThrow('No issued');
    await expect(
      ticketDocument({
        ...booking,
        passengers: [{ ...booking.passengers[0], ticketQrPayload: null }],
      }),
    ).rejects.toThrow('verified QR');
  });
  it('encodes a real ticket value that the boarding decoder can read', () => {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const scale = 6,
      margin = 4,
      size = (qr.modules.size + margin * 2) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < qr.modules.size; y++)
      for (let x = 0; x < qr.modules.size; x++) {
        if (!qr.modules.get(y, x)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const offset = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
            pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
          }
      }
    const scanned = jsQR(pixels, size, size)?.data;
    expect(scanned).toBe(payload);
    expect(JSON.parse(scanned!)).toMatchObject({
      Name: 'Passenger & One',
      Vessel: 'Test ferry',
      Date: '2026-10-04 08:00 Philippine time',
    });
  });
});
