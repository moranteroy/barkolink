const labels: Record<string, string> = {
  passengerdiscounts: "Passenger discounts",
  customdiscounts: "Custom discounts",
  percentage: "Discount percentage",
  paymentstatus: "Payment status",
  departureat: "Departure",
  arrivalat: "Arrival",
  vesselid: "Vessel reference",
  regularfare: "Regular fare",
  studentdiscount: "Student discount",
  seniordiscount: "Senior discount",
  childdiscount: "Child discount",
  pwddiscount: "PWD discount",
  pregnantdiscount: "Pregnancy discount",
  reservationminutes: "Time allowed for payment",
  discountverifiedat: "Discount verified",
  isactive: "Active",
  refundnote: "Refund reason",
  cancellationreason: "Cancellation reason",
  releasedseats: "Seats released",
  marked: "Passengers marked as no-shows",
  reference: "Booking reference",
  amount: "Amount",
  sailing: "Trip",
  faresettings: "Fare settings",
  operationsettings: "Reservation settings",
  bookingpassenger: "Passenger ticket",
};
const keyOf = (key: string) => key.replaceAll("_", "").toLowerCase();
export function auditLabel(key: string): string {
  return (
    labels[keyOf(key)] ||
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^./, (v) => v.toUpperCase())
  );
}
export function auditAction(action: string): string {
  return (
    (
      {
        INSERT: "Created",
        UPDATE: "Updated",
        DELETE: "Deleted",
        RESERVATION_EXPIRED: "Reservation expired",
        NO_SHOW_RECONCILED: "No-shows recorded",
        ADVISORY_SAVED: "Travel advisory saved",
      } as Record<string, string>
    )[action] || auditLabel(action)
  );
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const statuses = new Set([
  "SCHEDULED",
  "BOARDING",
  "COMPLETED",
  "CANCELLED",
  "PENDING",
  "CONFIRMED",
  "PAID",
  "UNPAID",
  "REFUND_PENDING",
  "REFUNDED",
  "EXPIRED",
  "ISSUED",
  "CHECKED_IN",
  "BOARDED",
  "NO_SHOW",
  "PASSENGER",
  "ADMIN",
  "TICKETING",
  "BOARDING",
  "ONLINE",
  "WALK_IN",
  "CASH",
]);
function displayValue(value: unknown, key: string): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => displayValue(item, key)).join("; ")
      : "None";
  if (isObject(value))
    return (
      Object.entries(value)
        .filter(
          ([name]) =>
            !["customdiscounts", "passengerdiscounts"].includes(keyOf(key)) ||
            name !== "id",
        )
        .map(
          ([name, item]) => `${auditLabel(name)}: ${displayValue(item, name)}`,
        )
        .join("; ") || "None"
    );
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const field = keyOf(key);
  if (typeof value === "number") {
    if (field === "reservationminutes")
      return value % 60 === 0
        ? `${value / 60} ${value === 60 ? "hour" : "hours"}`
        : `${value} ${value === 1 ? "minute" : "minutes"}`;
    if (field.endsWith("discount") || field === "percentage")
      return `${value}%`;
    if (
      ["amount", "total", "regularfare", "refundamount", "fare"].includes(field)
    )
      return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value.toLocaleString("en-PH");
  }
  const text = String(value);
  if (
    /(?:at|date)$/.test(field) &&
    /^\d{4}-\d{2}-\d{2}T/.test(text) &&
    !Number.isNaN(Date.parse(text))
  ) {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(text));
  }
  return statuses.has(text) ? auditLabel(text) : text;
}
export type AuditChange = { label: string; text: string };
export function auditChanges(
  details: Record<string, unknown> | null | undefined,
): AuditChange[] {
  const rows: AuditChange[] = [];
  function visit(key: string, value: unknown, prefix = "") {
    const label = prefix ? `${prefix} · ${auditLabel(key)}` : auditLabel(key);
    if (
      isObject(value) &&
      Object.prototype.hasOwnProperty.call(value, "before") &&
      Object.prototype.hasOwnProperty.call(value, "after")
    ) {
      const before = displayValue(value.before, key),
        after = displayValue(value.after, key);
      const text =
        value.before === null || value.before === undefined
          ? `Set to ${after}`
          : value.after === null || value.after === undefined
            ? `Cleared (previously ${before})`
            : `Changed from ${before} to ${after}`;
      rows.push({ label, text });
    } else if (isObject(value) && Object.keys(value).length) {
      for (const [child, item] of Object.entries(value))
        visit(child, item, label);
    } else rows.push({ label, text: displayValue(value, key) });
  }
  for (const [key, value] of Object.entries(details || {})) visit(key, value);
  return rows;
}
