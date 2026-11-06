import { awaitingPaymentVerification, bookingTicketReady } from './paymentVerification';

export type TravelBooking = {
  status: string;
  paymentStatus: string;
  paymentVerificationRequired?: boolean | null;
  departureAt?: string;
  arrivalAt?: string;
  sailingStatus?: string;
  passengers?: Array<{ ticketStatus?: string }>;
};

// Travel eligibility is separate from payment history. A past reservation must
// never become verified, refunded, or boarded simply because time has passed.
export function travelWindow(booking: TravelBooking, now = new Date()) {
  const ended =
    booking.sailingStatus === 'COMPLETED' ||
    (!!booking.arrivalAt && Date.parse(booking.arrivalAt) <= now.getTime());
  const closed =
    ['CANCELLED', 'EXPIRED'].includes(booking.status) || booking.sailingStatus === 'CANCELLED';
  const departed =
    !!booking.departureAt &&
    Date.parse(booking.departureAt) <= now.getTime() &&
    !['BOARDING', 'DELAYED'].includes(booking.sailingStatus || '');
  return { ended, closed, departed, recordOnly: ended || closed || departed };
}

export function bookingTravelStatus(booking: TravelBooking, now = new Date()) {
  if (booking.paymentStatus === 'REFUND_PENDING')
    return { label: 'Refund pending', tone: 'warning' };
  if (booking.paymentStatus === 'REFUNDED') return { label: 'Refunded', tone: 'neutral' };
  if (booking.status === 'CANCELLED' || booking.sailingStatus === 'CANCELLED')
    return { label: 'Cancelled', tone: 'cancelled' };
  if (booking.status === 'EXPIRED') return { label: 'Expired', tone: 'warning' };
  const window = travelWindow(booking, now);
  if (window.ended)
    return {
      label: booking.sailingStatus === 'COMPLETED' ? 'Trip completed' : 'Travel period ended',
      tone: 'neutral',
    };
  const passengers = booking.passengers || [];
  const boarded = passengers.filter((p) => p.ticketStatus === 'BOARDED').length;
  if (boarded && boarded === passengers.length) return { label: 'Boarded · Used', tone: 'success' };
  if (window.departed) return { label: 'Departure passed', tone: 'neutral' };
  if (boarded) return { label: 'Partially boarded', tone: 'success' };
  if (passengers.some((p) => p.ticketStatus === 'CHECKED_IN'))
    return { label: 'Checked in', tone: 'success' };
  if (awaitingPaymentVerification(booking))
    return { label: 'Awaiting staff verification', tone: 'warning' };
  return booking.paymentStatus === 'PAID'
    ? { label: 'Paid', tone: 'success' }
    : { label: 'Awaiting payment', tone: 'warning' };
}

export function bookingPaymentRecord(booking: TravelBooking, now = new Date()) {
  if (awaitingPaymentVerification(booking))
    return travelWindow(booking, now).recordOnly
      ? 'Payment received. Staff verification was not completed before travel closed. Contact ticketing for assistance; do not pay again.'
      : 'Payment received. Staff verification is pending; your e-ticket will appear once verified.';
  return 'Payment confirmed';
}

export function passengerTicketState(
  booking: TravelBooking,
  passenger: { ticketStatus?: string },
  now = new Date(),
) {
  const window = travelWindow(booking, now);
  if (passenger.ticketStatus === 'BOARDED')
    return {
      label: 'Used · Boarded',
      showQr: false,
      message:
        'Boarding has been recorded for this passenger. This ticket cannot be used again. Keep it for your transaction records.',
    };
  if (window.recordOnly)
    return {
      label: window.closed
        ? 'No longer valid'
        : window.ended
          ? 'Travel period ended'
          : 'Departure passed',
      showQr: false,
      message: `${passenger.ticketStatus === 'CHECKED_IN' ? 'Check-in was recorded. ' : ''}This ticket is retained for your transaction records and is no longer valid for travel.`,
    };
  if (passenger.ticketStatus === 'CHECKED_IN')
    return {
      label: 'Checked in',
      showQr: bookingTicketReady(booking),
      message:
        'Check-in recorded. Present this ticket to boarding staff; boarding can be recorded only once.',
    };
  if (passenger.ticketStatus !== 'ISSUED')
    return {
      label: 'Not issued',
      showQr: false,
      message: 'No issued ticket is recorded for this passenger. Contact ticketing for assistance.',
    };
  return {
    label: 'Ready for check-in',
    showQr: passenger.ticketStatus === 'ISSUED' && bookingTicketReady(booking),
    message: 'Show your passenger ID. Staff verifies the live ticket before check-in and boarding.',
  };
}
