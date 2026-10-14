import { describe, expect, it } from 'vitest';
import { bookingPaymentGuidance, bookingTicketReady } from '../../src/data/paymentVerification';

describe('upcoming booking guidance', () => {
  it('never asks a passenger to pay again while their received payment awaits verification', () => {
    const booking = { status: 'CONFIRMED', paymentStatus: 'PAID', paymentVerificationRequired: true };
    expect(bookingTicketReady(booking)).toBe(false);
    expect(bookingPaymentGuidance(booking)).toMatchObject({ label: 'Awaiting verification', action: 'Check verification' });
    expect(bookingPaymentGuidance(booking).message).toContain('Do not pay again');
  });
  it('offers payment options only for an unpaid booking and a ticket only after verification', () => {
    expect(bookingPaymentGuidance({status:'PENDING',paymentStatus:'UNPAID'}).action).toBe('View payment options');
    expect(bookingPaymentGuidance({status:'CONFIRMED',paymentStatus:'PAID',paymentVerificationRequired:false}).action).toBe('View e-ticket');
  });
});
