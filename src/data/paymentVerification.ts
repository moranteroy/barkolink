type VerificationBooking = { paymentVerificationRequired?: boolean | null; paymentStatus?: string; status?: string };
export function awaitingPaymentVerification(booking: VerificationBooking | null | undefined) {
  return booking?.paymentStatus === 'PAID' && booking.paymentVerificationRequired === true && booking.status === 'CONFIRMED';
}
export function bookingTicketReady(booking: VerificationBooking | null | undefined) {
  return booking?.status === 'CONFIRMED' && booking.paymentStatus === 'PAID' && !booking.paymentVerificationRequired;
}

export function bookingPaymentGuidance(booking: VerificationBooking | null | undefined) {
  if (bookingTicketReady(booking)) return { label: 'Ticket ready', message: 'Your payment is verified. Keep your e-ticket ready for check-in.', action: 'View e-ticket' };
  if (booking?.paymentStatus === 'PAID') return { label: 'Awaiting verification', message: 'Payment received. Ticketing staff will verify it before your e-ticket is issued. Do not pay again.', action: 'Check verification' };
  if (booking?.paymentStatus === 'REFUND_PENDING') return { label: 'Refund pending', message: 'Contact ticketing to arrange your refund.', action: 'View refund details' };
  return { label: 'Awaiting payment', message: 'Pay online or at the ticketing counter before your payment deadline.', action: 'View payment options' };
}
