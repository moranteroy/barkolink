# Presentation fixes and verification

November 5, 2026. This supersedes the open findings in `PRESENTATION-READINESS-2026-11-05.md` for the tested laptop web workflow.

**Result: the core laptop web presentation flow is ready for the rehearsed configuration and travel dates.** Native Android camera/device and mobile payment return remain outside this sign-off.

## Repairs completed

- Reconciled the ten completed demo trips: historical seat counts now match their confirmed reservations. The correction was limited to Carlo's tagged presentation-history discrepancies, saved a before snapshot, ran atomically and recorded `PRESENTATION_INVENTORY_RECONCILED` audit events. It did not alter passenger fares or payment totals.
- Fixed `scripts/prepare-presentation-loyalty.mjs`: a prepared historical booking now consumes one seat under a row lock. Original booking records and trip details remain guarded; only the intended inventory/timestamp fields may change. Temporary tables are dropped at commit. A real local-PostgreSQL regression runs that script's history SQL and confirms both inventory consistency and retry idempotence.
- Updated the two forecast tests to assert the current heading and actual day-count badge.
- Updated the historical no-show test to expect the stronger expired-travel rejection, retaining its attendance and no-show assertions.
- Updated the original QR and broad UI browser suites to find current global error toasts. Their tamper rejection, recovery and interaction assertions remain intact.

## Final verification

| Check                                                                | Result                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                                               | PASS                                                                                                                                   |
| Production build                                                     | PASS in preceding audit; application source unchanged by these repairs                                                                 |
| Original unit suite                                                  | **464/464 passed**, 81 files                                                                                                           |
| Original full database/Edge Function suite after regression addition | **233/233 passed**, 26 files                                                                                                           |
| Corrected original QR browser suite                                  | PASS, Passenger/Boarding, 390px and 1440px                                                                                             |
| Corrected original four-role experience suite                        | PASS, Admin/Passenger/Ticketing/Boarding, 390px and 1440px, both themes                                                                |
| Actual-account production login/page/dry-run checks                  | 32 passed in preceding audit                                                                                                           |
| Live integrity recheck after all rehearsal transactions              | **Zero issues** for inventory, reservation seats, class allocation, passenger counts, staff ports, role synchronization and trip times |

Other previously passing browser suites—payments, reservation retries, role access, staff-port restrictions, sessions, real grid controls, public terminal display, production MFA/CSP, manual voucher entry, ticket history and inbox pagination—remain recorded in the original audit artifacts. They were not unnecessarily rerun after test-only changes.

## Live rehearsal and prepared demo records

Using the four supplied accounts, a new reservation was created as Carlo, paid in cash by Maria, verified and checked in/boarded by John, and confirmed in Roy's trip-operation data. Tampered QR, premature boarding and duplicate check-in/boarding were rejected. A trip-specific boarding time was adjusted with a reason and audit record, without changing departure/arrival or operator policy. An unused initial trip selection was restored to its original scheduled timing with a separate audit event.

A second fresh booking was paid through the **actual hosted PayMongo GCash sandbox checkout**. The provider's Test Payment authorization succeeded; server payment confirmation, Maria's verification and issued-ticket status were checked. Return to Merchant opened the authenticated bookings page at the configured `http://localhost:8100` origin. No live-money payment was used.

The live passenger AI assistant returned an answer with verified sources. Ready and unpaid demo bookings were deliberately retained, rather than resetting or deleting transaction history.

See [the presentation guide](PRESENTATION-GUIDE-2026-11-05.md) for account roles, exact booking references, dates, the correct local URL and the recommended demonstration order.

## Boundaries of readiness

- These examples are scheduled for November 5–6, 2026. New presentation dates require fresh future reservations and eligibility checks.
- Physical camera scanning and native Android APK/device behavior still need the actual presentation phone. The configured JDK directory is missing on this machine, and no Android SDK was configured; no native build/device pass is claimed.
- PayMongo currently returns to `localhost:8100`, verified on this laptop. That origin is not a verified callback for a separate phone. A native/mobile-hosted payment-return sign-off requires the intended reachable deployment and device rehearsal. The tested online-payment demo should use the laptop.
- Existing third-party CSS minification warnings and bundle-size advisories did not fail the build; the device/network performance of a particular phone was not measured.

## Evidence

`.audit/presentation-readiness/` contains `unit-fixed.log`, `database-final.log`, `history-regression.log`, `lint-final.log`, `presentation-rehearsal.json`, `inventory-before-*.json`, `summary.json`, live ticket/manifest/payment/admin screenshots and sandbox authorization/merchant-return screenshots. The original corrected browser logs are in `.audit/system-ui/`.

Passwords and authentication sessions were not persisted. Rehearsal receipts contain demo booking IDs/references; they are local audit artifacts, not release assets.
