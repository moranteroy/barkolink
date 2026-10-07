type VerificationBooking = { paymentVerificationRequired?: boolean | null; paymentStatus?: string; status?: string };
export function awaitingPaymentVerification(booking: VerificationBooking | null | undefined) {
  return booking?.paymentStatus === 'PAID' && booking.paymentVerificationRequired === true && booking.status === 'CONFIRMED';
}
export function bookingTicketReady(booking: VerificationBooking | null | undefined) {
  return booking?.status === 'CONFIRMED' && booking.paymentStatus === 'PAID' && !booking.paymentVerificationRequired;
}
