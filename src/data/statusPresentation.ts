const labels: Record<string, string> = {
  ALL: 'All statuses', PAID: 'Paid', UNPAID: 'Awaiting payment', PENDING: 'Pending',
  CONFIRMED: 'Confirmed', SCHEDULED: 'Scheduled', BOARDING: 'Boarding', DELAYED: 'Delayed',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', REFUNDED: 'Refunded',
  REFUND_PENDING: 'Refund pending', ISSUED: 'Ticket issued', CHECKED_IN: 'Checked in',
  BOARDED: 'Boarded', NO_SHOW: 'No-show', ACTIVE: 'Active', INACTIVE: 'Archived',
  AWAITING_STAFF_VERIFICATION: 'Awaiting verification',
};
export function statusLabel(value: string | number): string {
  const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return labels[key] || key.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
