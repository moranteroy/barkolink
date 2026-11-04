# Notification delivery

Notifications are private to their owner. Operational notices also require the recipient role and departure-port assignment to match on every read and mark-read request. Staff alerts never target passenger inboxes. Normal broadcasts use their selected audience; only the welcome campaign follows future registrations.

| Event | Passenger | Ticketing | Boarding | Admin |
| --- | --- | --- | --- | --- |
| New booking | Existing reservation confirmation, owner only | Departure port | Departure port | All ports |
| Online payment awaiting verification | Existing provider receipt, owner only | Departure port | No verification alert | All ports |
| Payment verified / tickets ready | Existing ticket-ready notice, owner only | No duplicate boarding alert | Departure port | All ports |
| Cancellation / expiry | Owner only | Departure port | Departure port | All ports |
| Refund attention / recorded | Existing owner update | Departure port | No refund-action alert | All ports |
| Sailing status / schedule | Existing affected-booking updates | Departure port | Departure port | All ports |
| Check-in / boarding | Booking owner only | Existing operational views | Existing operational views | Existing operational views |
| Loyalty reward | Reward owner, including voucher code | No | No | No |
| Published active advisory | All passengers or active reservations on its sailing | No inbox copy | No inbox copy | No inbox copy |
| Broadcast | Selected PASSENGERS, ALL or TRIP audience only | STAFF or ALL | STAFF or ALL | STAFF or ALL |

- Operational writes and their alerts commit or roll back together. Event keys prevent duplicate delivery on retries.
- Draft and expired advisories generate no new inbox notifications. After migration 061, pg_cron delivers due notices every minute where available; authenticated inbox refresh remains a fallback. Existing active advisories are not replayed during deployment.
- The bell and open inbox refresh every 15 seconds while visible, and on focus or route changes. Old history is loaded silently; genuinely new unread notices show a toast.
- Unread state is isolated by account. Failed background requests retain the last count; authorization failures clear private cached notices. Mark-read races cannot resurrect unread items.
- Bell refreshes return at most 50 recent notices plus the global unread count. Inbox history loads 30 records per page, with search/category/unread filters applied by the server and global category counts. Old history is accessible through Previous/Next.
- Staff booking alerts link to the matching booking queue or boarding manifest. Existing authorization still governs the destination.

Validation: isolated PostgreSQL delivery and security tests, the main business-rule suite, unit coverage for synchronization and account changes, and production browser fixtures for all four roles. Native deployment probes use a transaction that is rolled back.
