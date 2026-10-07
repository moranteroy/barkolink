export function canResumeReservation(booking: {
  status: string;
  paymentStatus: string;
  paymentDeadline?: string | null;
  sailing: { departureAt: string };
}, now = Date.now()) {
  return ['PENDING', 'CONFIRMED'].includes(booking.status) && booking.paymentStatus === 'UNPAID'
    && new Date(booking.sailing.departureAt).getTime() > now
    && (!booking.paymentDeadline || new Date(booking.paymentDeadline).getTime() > now);
}
