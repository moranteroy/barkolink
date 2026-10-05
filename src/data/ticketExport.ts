import QRCode from "qrcode";

type TicketBooking = {
  accommodationName?: string | null;
  reference: string;
  status: string;
  paymentStatus: string;
  from: string;
  to: string;
  date: string;
  departure?: string;
  vessel: string;
  passengers: Array<{
    name: string;
    type: string;
    ticketCode?: string;
    ticketStatus?: string;
  }>;
};
export const escapeTicketText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export async function ticketDocument(booking: TicketBooking) {
  if (booking.status !== "CONFIRMED" || booking.paymentStatus !== "PAID")
    throw new Error("Only paid, active tickets can be exported.");
  const passengers = booking.passengers.filter(
    (person) =>
      person.ticketCode &&
      ["ISSUED", "CHECKED_IN", "BOARDED"].includes(person.ticketStatus || ""),
  );
  if (!passengers.length)
    throw new Error("No issued tickets are available for this booking.");
  const e = escapeTicketText;
  const tickets = await Promise.all(
    passengers.map(async (person) => {
      const qr = await QRCode.toDataURL(person.ticketCode!, {
        width: 220,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      return `<article><header><strong>BarkoLink</strong><span>PAID · ${e(person.ticketStatus || "")}</span></header><h1>${e(booking.from)} → ${e(booking.to)}</h1><p>${e(booking.date)} · ${e(booking.departure || "")}</p><p>Vessel: ${e(booking.vessel)}</p>${booking.accommodationName ? `<p>Accommodation: ${e(booking.accommodationName)}</p>` : ""}<hr><h2>${e(person.name)}</h2><p>${e(person.type)} passenger · Booking ${e(booking.reference)}</p><img src="${qr}" width="220" height="220" alt="Passenger ticket QR code"><code>${e(person.ticketCode!)}</code><footer>Show this QR code or ticket code at the terminal. Staff will verify the current ticket status. This saved copy does not override later cancellations or trip changes.</footer></article>`;
    }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>BarkoLink ticket ${e(booking.reference)}</title><style>body{margin:0;background:#eef4f8;color:#103658;font:15px system-ui,sans-serif}main{max-width:650px;margin:25px auto;padding:15px}article{padding:30px;margin-bottom:24px;background:white;border:1px solid #ccdce7;border-radius:16px;break-inside:avoid}header{display:flex;justify-content:space-between;gap:16px;color:#1565c0}header span{font-size:12px}h1{font-size:25px}h2{font-size:19px}img{display:block;margin:20px auto}code{display:block;text-align:center;overflow-wrap:anywhere}footer{font-size:12px;line-height:1.7;margin-top:25px;color:#516578}hr{border:0;border-top:1px dashed #ccdce7}@media print{body{background:white}main{margin:0;padding:0}article{border-color:#bbb;box-shadow:none}}</style></head><body><main>${tickets.join("")}</main></body></html>`;
}
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const filename = (reference: string) =>
  `BarkoLink-${reference.replace(/[^a-zA-Z0-9_-]/g, "-")}.html`;
export async function downloadTicket(booking: TicketBooking) {
  saveFile(
    new Blob([await ticketDocument(booking)], {
      type: "text/html;charset=utf-8",
    }),
    filename(booking.reference),
  );
}
export async function shareTicket(booking: TicketBooking) {
  const file = new File(
    [await ticketDocument(booking)],
    filename(booking.reference),
    { type: "text/html" },
  );
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ title: "BarkoLink e-ticket", files: [file] });
  else {
    saveFile(file, file.name);
    throw new Error(
      "File sharing is unavailable in this browser. Your ticket was downloaded instead.",
    );
  }
}
