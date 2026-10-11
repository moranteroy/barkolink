# Batangas-Calapan demonstration dataset

The active service area is Batangas Port and Calapan Port in both directions.
Other reference ports, routes and unsupported vessels remain stored but inactive.
Ships with unknown capacities or maintenance exclusions stay inactive.

Migration 039 reclassifies legacy accommodation charges from service fees into
passenger fare totals while preserving the total amount and payment state.
Existing accounts, bookings, passengers, QR credentials and trip history are
preserved. The additive loader saves a checksum-protected backup and verifies
existing rows inside the transaction before committing.

The batch adds 60 departures, realistic Filipino passenger names, normal
`TRPYYYY-MMDDNNN` trip codes, longer numeric `BKG` references and six random
alphanumeric vouchers. It covers both directions, six months of history,
upcoming reservations, sold-out seats, payment deadlines, discount verification,
issued/check-in/boarded tickets, no-shows, cancellations and refund states.

These are synthetic demonstration bookings and simulated cash payments. The
loader does not call a payment provider or send email. The illustrative PHP 600
base fare, PHP 100 premium surcharge, cabin allocations, travel durations and
boarding plans are not verified operator prices or dispatch instructions.
Existing saved fares and cabin allocations take priority. Confirm operational
values before using this database for actual transport or financial reporting.

Provenance and inserted record IDs are stored in the private
`barkolink_private.demonstration_batch` manifest. No TEST prefix is displayed.
Auth login accounts are preserved; walk-in guest records are generated separately.
Online examples belong only to existing demonstration passengers with reserved
example email domains. If none exist, the loader generates walk-in examples.

Run `node scripts/apply-demonstration-data.mjs --apply` once. Repeating it skips
the existing batch. Run `node scripts/verify-demonstration-data.mjs` after the
scheduler has had time to perform the two automatic transitions.

The live verification on 11 October 2026 observed:

- `TRP2026-1011001`: Scheduled to Boarding at 16:29 Philippine time.
- `TRP2026-1011002`: Boarding to Completed at 16:30 Philippine time.
- Delayed and Cancelled examples retained their manual statuses.

Both automatic changes were performed by the database's minute scheduler and
recorded with SYSTEM as the audit actor. No manual status update was used to
produce these results. All four examples can be inspected in Trip operations.

The local database suite separately exercises reservation, capacity limits,
discount checks, payment collection, verified QR scans, refunds, rescheduling,
operator policy overrides, manual exceptions and role permissions in disposable
Postgres databases. The demonstration batch never invokes an operational reset.
