import { expect, it } from 'vitest';
import { bookingReference, voucherCode } from '../../src/data/recordCodes';

it('uses the Philippine date even around midnight and keeps a longer numeric booking suffix', () => {
  expect(bookingReference(new Date('2026-10-11T16:00:00Z'))).toMatch(/^BKG2026-1012\d{12}$/);
  expect(bookingReference(new Date('2026-12-31T16:00:00Z'))).toMatch(/^BKG2027-0101\d{12}$/);
});
it('generates different booking and voucher codes containing letters and numbers', () => {
  const bookings = new Set<string>(), vouchers = new Set<string>();
  for (let i = 0; i < 100; i++) {
    bookings.add(bookingReference());
    const code = voucherCode(), token = code.slice(4);
    expect(code).toMatch(/^VCH-[A-HJ-NP-Z2-9]{16}$/);
    expect(token).toMatch(/[A-Z]/);
    expect(token).toMatch(/[2-9]/);
    vouchers.add(code);
  }
  expect(bookings.size).toBe(100);
  expect(vouchers.size).toBe(100);
});
