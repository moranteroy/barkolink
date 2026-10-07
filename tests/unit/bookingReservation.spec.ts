import { describe, expect, it } from 'vitest';
import { canResumeReservation } from '../../src/data/bookingReservation';
const now = Date.parse('2026-10-07T12:00:00Z');
const booking = { status:'CONFIRMED', paymentStatus:'UNPAID', paymentDeadline:'2026-10-07T13:00:00Z', sailing:{departureAt:'2026-10-08T12:00:00Z'} };
describe('resuming an existing reservation', () => {
  it('resumes an active unpaid reservation while rejecting previously paid bookings', () => {
    expect(canResumeReservation(booking,now)).toBe(true);
    expect(canResumeReservation({...booking,paymentStatus:'PAID'},now)).toBe(false);
    expect(canResumeReservation({...booking,paymentStatus:'REFUND_PENDING'},now)).toBe(false);
  });
  it('does not reuse cancelled, expired, overdue or departed reservations', () => {
    for (const status of ['CANCELLED','EXPIRED']) expect(canResumeReservation({...booking,status},now)).toBe(false);
    expect(canResumeReservation({...booking,paymentDeadline:'2026-10-07T11:00:00Z'},now)).toBe(false);
    expect(canResumeReservation({...booking,sailing:{departureAt:'2026-10-07T11:00:00Z'}},now)).toBe(false);
  });
});
