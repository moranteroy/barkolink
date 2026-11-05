import { describe, it, expect } from 'vitest';
import { bookingPaymentRecord, bookingTravelStatus, passengerTicketState, travelWindow } from '../../src/data/bookingLifecycle';

const now = new Date('2026-11-05T09:00:00Z');
const booking = { status:'CONFIRMED', paymentStatus:'PAID', departureAt:'2026-11-06T01:00:00Z', arrivalAt:'2026-11-06T03:00:00Z', sailingStatus:'SCHEDULED', passengers:[{ticketStatus:'ISSUED'}] };
describe('travel status and transaction history', () => {
  it('keeps future payment verification pending and does not invent a ticket', () => {
    const record={...booking,paymentVerificationRequired:true};
    expect(bookingTravelStatus(record,now).label).toBe('Awaiting staff verification');
    expect(bookingPaymentRecord(record,now)).toContain('pending');
    expect(passengerTicketState(record,record.passengers[0],now).showQr).toBe(false);
  });
  it('replaces stale verification guidance without changing the payment truth', () => {
    const record={...booking,arrivalAt:'2026-11-04T03:00:00Z',departureAt:'2026-11-04T01:00:00Z',paymentVerificationRequired:true};
    expect(bookingTravelStatus(record,now).label).toBe('Travel period ended');
    expect(bookingPaymentRecord(record,now)).toContain('verification was not completed');
    expect(bookingPaymentRecord(record,now)).not.toContain('will appear');
    expect(record.paymentVerificationRequired).toBe(true);
    expect(record.paymentStatus).toBe('PAID');
  });
  it('retains used ticket identity but hides its QR immediately after boarding', () => {
    const state=passengerTicketState(booking,{ticketStatus:'BOARDED'},now);
    expect(state.label).toBe('Used · Boarded');expect(state.showQr).toBe(false);
    expect(state.message).toContain('cannot be used again');
  });
  it('keeps checked-in tickets usable for the separate boarding step', () => {
    const state=passengerTicketState(booking,{ticketStatus:'CHECKED_IN'},now);
    expect(state.label).toBe('Checked in');expect(state.showQr).toBe(true);
    expect(state.message).toContain('boarding staff');
  });
  it('handles mixed group attendance per passenger', () => {
    const record={...booking,passengers:[{ticketStatus:'BOARDED'},{ticketStatus:'CHECKED_IN'},{ticketStatus:'ISSUED'}]};
    expect(bookingTravelStatus(record,now).label).toBe('Partially boarded');
    expect(record.passengers.map(p=>passengerTicketState(record,p,now).showQr)).toEqual([false,true,true]);
  });
  it('closes completed trips and travel windows including stale boarding status', () => {
    expect(travelWindow({...booking,sailingStatus:'COMPLETED'},now).recordOnly).toBe(true);
    const record={...booking,sailingStatus:'BOARDING',arrivalAt:now.toISOString()};
    expect(passengerTicketState(record,{ticketStatus:'CHECKED_IN'},now).showQr).toBe(false);
    expect(bookingTravelStatus({...booking,sailingStatus:'COMPLETED'},now).label).toBe('Trip completed');
  });
  it('honors active boarding after departure until arrival, while scheduled check-in closes at departure', () => {
    const record={...booking,departureAt:now.toISOString()};
    expect(travelWindow(record,now).recordOnly).toBe(true);
    expect(travelWindow({...record,sailingStatus:'BOARDING'},now).recordOnly).toBe(false);
  });
  it('keeps refunds, cancellations and expiry distinct from travel completion', () => {
    expect(bookingTravelStatus({...booking,status:'CANCELLED'},now).label).toBe('Cancelled');
    expect(bookingTravelStatus({...booking,status:'EXPIRED'},now).label).toBe('Expired');
    expect(bookingTravelStatus({...booking,paymentStatus:'REFUNDED'},now).label).toBe('Refunded');
    expect(passengerTicketState({...booking,status:'CANCELLED'},booking.passengers[0],now).showQr).toBe(false);
  });
});
