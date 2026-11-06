import QRCode from 'qrcode';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { passengerTicketState } from './bookingLifecycle';
import { bookingTicketReady } from './paymentVerification';

export type TicketBooking = {
  paymentMethod?: string | null;
  accommodationName?: string | null;
  reference: string;
  status: string;
  paymentStatus: string;
  paymentVerificationRequired?: boolean | null;
  departureAt?: string;
  arrivalAt?: string;
  sailingStatus?: string;
  from: string;
  to: string;
  date: string;
  departure?: string;
  vessel: string;
  passengers: Array<{
    name: string;
    type: string;
    ticketCode?: string;
    ticketQrPayload?: string | null;
    ticketStatus?: string;
  }>;
};
export const escapeTicketText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export async function ticketDocument(booking: TicketBooking) {
  if (!bookingTicketReady(booking)) throw new Error('Only paid, active tickets can be exported.');
  const passengers = booking.passengers.filter(
    (person) =>
      person.ticketCode && ['ISSUED', 'CHECKED_IN', 'BOARDED'].includes(person.ticketStatus || ''),
  );
  if (!passengers.length) throw new Error('No issued tickets are available for this booking.');
  const e = escapeTicketText;
  const paymentLabel = 'PAID';
  const tickets = await Promise.all(
    passengers.map(async (person) => {
      const state = passengerTicketState(booking, person);
      if (state.showQr && !person.ticketQrPayload)
        throw new Error('Refresh your ticket to load its verified QR code before exporting.');
      const qr = state.showQr
        ? await QRCode.toDataURL(person.ticketQrPayload!, {
            width: 360,
            margin: 4,
            errorCorrectionLevel: 'M',
          })
        : '';
      return `<article><header><strong>BarkoLink</strong><span>${paymentLabel} · ${e(state.label)}</span></header><h1>${e(booking.from)} → ${e(booking.to)}</h1><p>${e(booking.date)} · ${e(booking.departure || '')}</p><p>Vessel: ${e(booking.vessel)}</p>${booking.accommodationName ? `<p>Accommodation: ${e(booking.accommodationName)}</p>` : ''}<hr><h2>${e(person.name)}</h2><p>${e(person.type)} passenger · Booking ${e(booking.reference)}</p>${qr ? `<img src="${qr}" width="220" height="220" alt="Passenger ticket QR code">` : `<h2>${e(state.label)}</h2><p>${e(state.message)}</p>`}<code>${e(person.ticketCode!)}</code><footer>${state.showQr ? e(state.message) : 'Transaction record only. This ticket is no longer valid for travel.'} Staff verifies current ticket eligibility; a saved copy cannot override later status or trip changes.</footer></article>`;
    }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>BarkoLink ticket ${e(booking.reference)}</title><style>body{margin:0;background:#eef4f8;color:#103658;font:15px system-ui,sans-serif}main{max-width:650px;margin:25px auto;padding:15px}article{padding:30px;margin-bottom:24px;background:white;border:1px solid #ccdce7;border-radius:16px;break-inside:avoid}header{display:flex;justify-content:space-between;gap:16px;color:#1565c0}header span{font-size:12px}h1{font-size:25px}h2{font-size:19px}img{display:block;margin:20px auto}code{display:block;text-align:center;overflow-wrap:anywhere}footer{font-size:12px;line-height:1.7;margin-top:25px;color:#516578}hr{border:0;border-top:1px dashed #ccdce7}@media print{body{background:white}main{margin:0;padding:0}article{border-color:#bbb;box-shadow:none}}</style></head><body><main>${tickets.join('')}</main></body></html>`;
}
const NativeTicketPrint = registerPlugin<{
  print(options: { html: string; jobName: string }): Promise<void>;
}>('TicketPrint');
/** Print the isolated ticket document, never the scrollable application screen. */
export async function printTicketDocument(booking: TicketBooking) {
  if (Capacitor.getPlatform() === 'android') {
    await NativeTicketPrint.print({
      html: await ticketDocument(booking),
      jobName: `BarkoLink ${booking.reference}`,
    });
    return;
  }
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow the ticket print window, then try Print/PDF again.');
  try {
    popup.opener = null;
    popup.document.open();
    popup.document.write(await ticketDocument(booking));
    popup.document.close();
    await Promise.all(Array.from(popup.document.images).map((img) => img.decode()));
    popup.addEventListener('afterprint', () => popup.close(), { once: true });
    popup.focus();
    popup.print();
  } catch (cause) {
    popup.close();
    throw cause;
  }
}
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const filename = (reference: string) =>
  `BarkoLink-${reference.replace(/[^a-zA-Z0-9_-]/g, '-')}.html`;
export async function downloadTicket(booking: TicketBooking) {
  saveFile(
    new Blob([await ticketDocument(booking)], {
      type: 'text/html;charset=utf-8',
    }),
    filename(booking.reference),
  );
}
export async function shareTicket(booking: TicketBooking) {
  const file = new File([await ticketDocument(booking)], filename(booking.reference), {
    type: 'text/html',
  });
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ title: 'BarkoLink e-ticket', files: [file] });
  else {
    saveFile(file, file.name);
    throw new Error(
      'File sharing is unavailable in this browser. Your ticket was downloaded instead.',
    );
  }
}
