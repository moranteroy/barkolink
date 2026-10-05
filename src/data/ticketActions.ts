import { databaseRequestError } from "./databaseErrors";

export type TicketAction = "check-in" | "boarding";
type GateTicket = {
  ticketStatus: string;
  booking: {
    status: string;
    paymentStatus: string;
    sailing: { code: string; status: string; departureAt: string };
  };
};

export function ticketActionBlockReason(
  ticket: GateTicket,
  action: TicketAction,
  now = new Date(),
) {
  if (ticket.booking.status !== "CONFIRMED")
    return "The reservation must be confirmed.";
  if (ticket.booking.paymentStatus !== "PAID")
    return "Payment must be completed first.";
  if (action === "boarding") {
    if (ticket.ticketStatus === "BOARDED")
      return "This passenger has already boarded.";
    if (ticket.ticketStatus !== "CHECKED_IN")
      return "Check in this passenger before boarding.";
    if (ticket.booking.sailing.status !== "BOARDING")
      return `Set trip ${ticket.booking.sailing.code} to BOARDING in Trips & schedules first. Current status: ${ticket.booking.sailing.status}.`;
  } else {
    if (ticket.ticketStatus !== "ISSUED")
      return "Only issued tickets can be checked in.";
    if (!["SCHEDULED", "BOARDING"].includes(ticket.booking.sailing.status))
      return "Check-in is available for scheduled or boarding trips.";
    if (
      ticket.booking.sailing.status !== "BOARDING" &&
      !(new Date(ticket.booking.sailing.departureAt) > now)
    )
      return "This trip has departed. Check-in is closed.";
  }
  return "";
}

export function ticketRequestError(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message : "";
  const start = message.indexOf("["),
    end = message.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const errors: unknown = JSON.parse(message.slice(start, end + 1));
      if (Array.isArray(errors)) {
        for (const error of errors) {
          const clean =
            typeof error?.message === "string"
              ? error.message.replace(/\(aborted\)|\(rolled back\)/g, "").trim()
              : "";
          if (clean) return databaseRequestError({ message: clean }, clean);
        }
      }
    } catch {
      /* Fall back to a useful action message when the response is not JSON. */
    }
  }
  const clean = databaseRequestError(cause, fallback);
  return clean && !clean.startsWith("DataConnect error") ? clean : fallback;
}
