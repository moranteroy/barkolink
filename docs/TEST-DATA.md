# BarkoLink acceptance test data

**Historical dataset:** the live TEST-labeled records described below were subsequently replaced at the owner's request. Use [DEMO-WORKFLOWS.md](DEMO-WORKFLOWS.md) for the current passenger accounts and realistic records. This document and the TEST fixture source remain as regression references.

The configured Supabase database was reset and reseeded on 6 October 2026 at the owner's request, before Vercel deployment. All 16 operational/reference tables were replaced. The four Auth accounts and all five application profiles, including the non-login walk-in user, were preserved byte-for-byte at the JSON record level. Passwords, names, email addresses, roles and profile metadata were not changed. Other Auth tables were not targeted.

The former data is backed up locally in `.backups/before-test-reset-1791259357632.json`, with a SHA-256 checksum and reset receipt. This directory is excluded from Git and Vercel uploads. It contains private former operational records; keep it local. Reset used one transaction, explicit table locks, a comparison against the backup, and user-preservation checks. No schema, migration, RLS policy, account or Edge Function was removed.

## Loaded inventory

| Data | Count |
| --- | ---: |
| Ports / vessels | 4 / 4, including one inactive of each |
| Routes | 5, including an inactive route |
| Accommodation classes | 6, including an inactive class |
| Vessel fare configurations | 4 |
| Sailings | 15 |
| Bookings / passenger records | 33 / 82 |
| Boarding events / no-shows | 36 / 2 |
| Advisories / saved travelers | 4 / 3 |
| Notifications / broadcast history | 6 / 1 |
| Operation settings / audit records | 1 / 144 |

All journey, price, passenger, payment, refund, advisory and broadcast records are fictional and use `TEST` labels. Dummy passenger phone numbers are `00000000000`; no real identification numbers were added. The PHP 600 base fare, sample discounts and surcharges are testing examples, not approved operator prices. The stored broadcast/notifications are internal test records; no email, SMS or actual cash movement occurred.

## Test cases by role

Use the existing login credentials for each role. Existing Passenger users see their test bookings; the current database has one Passenger account. Refresh the app after the reset so it does not retain links to deleted records.

| Role / task | Record to use | What to verify |
| --- | --- | --- |
| Passenger: browse and reserve | `TEST-EMPTY` | Choose economy or premium, add passengers or a saved traveler, review Philippine departure time and totals, then reserve. This trip initially has no bookings. |
| Passenger: pending reservation | `TEST-PAY-REGULAR` | Payment deadline and unpaid instructions; cancelled/expired records have separate states. |
| Passenger: cancellation | `TEST-CANCEL-READY` | Cancel the unpaid reservation and confirm seats return. |
| Passenger: saved travelers | `TEST Saved Adult`, `TEST Saved Child`, `TEST Saved Other` | Select, edit or remove a traveler; Other sex stays Other in booking. |
| Passenger: sold-out trip | `TEST-FULL` / `TEST-SOLD-OUT` | No seats are available; another reservation must be rejected. |
| Passenger: notifications/help | Read/unread TEST notices and active TEST advisories | Read status, mark-all-read, published versus draft/expired notices, and blank operator-contact fallback. |
| Ticketing: cash collection | `TEST-PAY-REGULAR` | Collect one simulated cash payment, view the receipt and ticket; do not collect it twice. |
| Ticketing: discount verification | `TEST-DISCOUNT-PENDING` | Verify Student, Senior, Child, PWD, Pregnant and Test Promo before collecting payment. This booking uses premium accommodation. |
| Ticketing: walk-in history | `TEST-WALK-IN` | Inspect a paid walk-in sale and its ticket; create a new fictional counter sale through the UI to test the actual walk-in form. |
| Ticketing: refund | `TEST-REFUND-PENDING` | Record a simulated cash refund and verify the new status; `TEST-REFUNDED` shows the completed state. |
| Boarding: check-in | `TEST-ISSUED` on `TEST-BOARDING` | Review/scan the issued ticket, check in, then board. |
| Boarding: board | `TEST-CHECKED-IN` on `TEST-BOARDING` | Board a checked-in passenger. `TEST-BOARDED` gives an already-boarded example. Repeated scans must not increase counts. |
| Boarding: completed/no-show | `TEST-NOSHOW` / `TEST-NO-SHOW` | Two paid passengers are marked no-show; compare with boarded history on `TEST-HISTORY`. |
| Admin: search/pagination/manifest | `TEST-SCHEDULED`, references `TEST-LIST-01` through `TEST-LIST-12` | 36 paid passenger rows span two pages of 30. Search must find matches on the second page; the manifest includes all 36. Manifest download remains Admin-only. |
| Admin: reschedule/status/advisory | `TEST-DELAYED`, `TEST-EMPTY`, `[TEST] Draft advisory` | Use the normal editors for schedule/status changes and advisory publishing. `TEST-CANCELLED` already shows the cancelled state. |
| Admin: fleet setup | TEST ports, routes, vessels and classes | Test edits, inactive choices, distinct route ports and capacity limits. The small ferry's eight-seat class is full. |
| Admin: fares | Test vessel fare configurations | Change discounts for future sailings; existing bookings/sailings retain their saved prices. Test Promo exercises Other discounts in Reports. |
| Admin: reports | `TEST-MONTH-1` through `TEST-MONTH-6` | Choose a range covering the previous six calendar months; examine revenue, categories, refunds, no-shows and tables. |
| Admin: inbox/broadcast/settings/audit | TEST broadcast, unread admin notice, settings and seeded audit | Read the inbox, preview recipients, send an internal fictional broadcast, change reservation minutes and verify audit filters. |

Future operational sailings are scheduled relative to the actual database reset time: boarding in two hours, payment in six hours, delayed in ten hours, then future dates. Payment deadlines and statuses follow normal backend rules, so the fixtures will age and pending reservations can expire. To test later, create new future trips/reservations through the app or perform another explicitly authorized backup/reset. Tests consume the fixtures normally; a processed payment/refund is not reusable as an unprocessed case.

## Verification completed

- Seven new isolated tests cover user preservation, data integrity, capacity, totals, pagination, manifests, reporting, booking/payment/boarding/refund/cancellation, stale-backup rejection and rollback on seed failure.
- The complete database/account-function suite passed: 51 tests. Script syntax, lint and whitespace checks also passed.
- Live verification read 34 role-authorized module operations and exercised seven transactional workflows: discount verification, cash collection, refund, check-in, boarding, new reservation and cancellation, plus inbox read actions. All these verification changes were rolled back; before/after operational and user fingerprints matched.
- User preservation was checked inside the reset transaction and again after commit. The Auth count remains four and app profile count five.

These are backend checks. Real sign-in/email delivery, camera scanning, terminal printing and physical Android operation still need the existing user accounts and actual devices. Account creation/password changes are intentionally absent from the seed so the existing users remain untouched.

## Maintainer commands

```powershell
node scripts/test-data-database.mjs inspect
node scripts/test-data-database.mjs verify
npm.cmd run test:database
```

The fixture source is `supabase/test-data.sql`; it is separate from migrations and `supabase/setup.sql`. Do not run it directly against an occupied database. The reset helper's `backup` and `apply` commands require a complete reviewed table inventory, a verified backup and exact project confirmation. `verify` expects the original unconsumed fixtures and always rolls its changes back.
