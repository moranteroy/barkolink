# Sailing status configuration

Admin → Operations → Sailing status configuration stores a separate policy for each catalog operator. Boarding automation is unset until an administrator supplies a confirmed boarding lead time and reference/terminal confirmation. No one-hour default is assigned. Check-in/reporting reminders and boarding cutoffs are not treated as boarding opening times.

Official guidance checked 11 October 2026:

- [Starlite passenger guidelines](https://starliteferries.com/passenger-guidelines/): arrive at the port three hours before departure; boarding cutoff thirty minutes before departure. Neither specifies boarding opening time.
- [OceanJet FAQ](https://oceanjet.net/faq): check in at least thirty minutes before departure; no published boarding opening time.
- [Montenegro passenger terms](https://montenegrolines.com.ph/booking.php): port arrival one hour before short-distance trips or four hours before long-haul trips; no boarding opening time specified.
- No verified public boarding opening time was found for FastCat, SuperCat, Besta, Orange Navigation or Atienza. Their configuration remains unset until confirmed.

The trip editor accepts a confirmed boarding timestamp and source as an override. A configured operator lead time applies when a trip has no override. Rescheduling clears the old override unless a new confirmed timestamp is supplied. New UI-created trips require either a confirmed trip time or a configured operator policy. Legacy trips with unknown timing remain Scheduled until a confirmed boarding rule becomes available or their scheduled arrival is reached.

A private database worker runs once per minute using [Supabase Cron](https://supabase.com/docs/guides/cron). It uses absolute timestamptz comparisons, including overnight sailings, and skips rows locked by an admin edit. It moves Scheduled to Boarding at the confirmed time and active trips to Completed at scheduled arrival, subject to the operator's automatic completion setting. This is schedule-based status, not a live position or proof of actual arrival. Admin must mark Delayed when actual operations differ.

Delayed and Cancelled are never overwritten. Admin can mark a Boarding trip Delayed, update its future schedule, then resume with Scheduled. Turning automatic completion off exposes manual completion for Boarding trips. Existing cancellation/refund protection remains in force.

Transitions use the existing audit trigger, notify paid confirmed account holders once, and issue eligible loyalty rewards on completion. Attendance, no-shows, bookings, seat counts, fares and payments are not changed by the worker. No-show reconciliation remains a separate reviewed action.

Apply migration 036 to an existing database with `node scripts/apply-sailing-automation.mjs --apply`. It backs up sailing records, installs the minute job, performs initial catch-up and verifies bookings, payments, attendance, fares and seats remain unchanged. New projects use regenerated `supabase/setup.sql`. Local PGlite tests invoke the private worker directly because pg_cron is unavailable there.
