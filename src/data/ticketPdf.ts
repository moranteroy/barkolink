import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { TicketBooking } from './ticketExport';
import { bookingTicketReady } from './paymentVerification';
import { passengerTicketState } from './bookingLifecycle';
import { installPdfFonts } from './reportPdf';

/** A portable PDF for Android's document picker, with one ticket per passenger. */
export async function createTicketPdf(booking: TicketBooking) {
  if (!bookingTicketReady(booking)) throw new Error('Only paid, active tickets can be exported.');
  const passengers = booking.passengers.filter(
    (person) =>
      person.ticketCode && ['ISSUED', 'CHECKED_IN', 'BOARDED'].includes(person.ticketStatus || ''),
  );
  if (!passengers.length) throw new Error('No issued tickets are available for this booking.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  await installPdfFonts(doc);
  doc.setProperties({ title: `BarkoLink ticket ${booking.reference}`, author: 'BarkoLink' });
  let y = 20;
  const write = (text: string, size = 11, bold = false) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 174) as string[];
    const height = lines.length * size * 0.45;
    if (y + height > 276) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 18, y, { lineHeightFactor: 1.25 });
    y += height + 4;
  };
  for (const [index, person] of passengers.entries()) {
    if (index) doc.addPage();
    y = 20;
    const state = passengerTicketState(booking, person);
    if (state.showQr && !person.ticketQrPayload)
      throw new Error('Refresh your ticket to load its verified QR code before exporting.');
    doc.setTextColor(9, 35, 59);
    write('BarkoLink | DIGITAL BOARDING PASS', 15, true);
    write(`PAID | ${state.label}`, 10, true);
    write(`${booking.from} to ${booking.to}`, 16, true);
    write(`Departure: ${booking.date} ${booking.departure || ''}`);
    write(`Vessel: ${booking.vessel}`);
    if (booking.accommodationName) write(`Accommodation: ${booking.accommodationName}`);
    write(person.name, 15, true);
    write(`${person.type} passenger`);
    write(`Booking: ${booking.reference}`, 10);
    write(`Ticket: ${person.ticketCode}`, 9);
    if (state.showQr) {
      if (y + 72 > 262) {
        doc.addPage();
        y = 20;
        write(person.name, 14, true);
        write(`Booking: ${booking.reference}`, 10);
      }
      const qr = await QRCode.toDataURL(person.ticketQrPayload!, {
        width: 480,
        margin: 4,
        errorCorrectionLevel: 'M',
      });
      doc.addImage(qr, 'PNG', 73, y, 64, 64);
      y += 72;
    }
    write(state.message, 9);
    write(
      'Staff verifies current ticket eligibility. A saved copy cannot override later payment, ticket, or trip changes.',
      8,
    );
  }
  return doc;
}
