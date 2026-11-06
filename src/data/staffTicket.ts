import type { StaffBookingsData } from '../services/database/staff';
import type { TicketBooking } from './ticketExport';

export type StaffTicketBooking = StaffBookingsData['bookings'][number];

/** Use server-issued passenger QR payloads; a booking reference is not a ticket QR. */
export function staffTicket(booking: StaffTicketBooking): TicketBooking {
  const departure = new Date(booking.sailing.departureAt);
  const options = { timeZone: 'Asia/Manila' };
  return {
    reference: booking.reference,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    paymentVerificationRequired: booking.paymentVerificationRequired,
    accommodationName: booking.accommodationName,
    departureAt: booking.sailing.departureAt,
    arrivalAt: booking.sailing.arrivalAt,
    sailingStatus: booking.sailing.status,
    from: booking.sailing.origin.name,
    to: booking.sailing.destination.name,
    date: departure.toLocaleDateString('en-PH', { ...options, dateStyle: 'medium' }),
    departure: departure.toLocaleTimeString('en-PH', {
      ...options,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    vessel: booking.sailing.vessel.name,
    passengers: booking.bookingPassengers_on_booking.map((person) => ({
      name: person.fullName,
      type: person.passengerType,
      ticketCode: person.ticketCode,
      ticketQrPayload: person.ticketQrPayload,
      ticketStatus: person.ticketStatus,
    })),
  };
}
