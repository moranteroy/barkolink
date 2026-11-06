# BarkoLink presentation readiness audit

**Follow-up:** The findings below describe the initial audit. Repairs, all-green unit/database runs and a successful live cash/sandbox rehearsal are documented in [Presentation fixes](PRESENTATION-FIXES-2026-11-05.md). Use the [presentation guide](PRESENTATION-GUIDE-2026-11-05.md) for the prepared accounts/records, date limits and remaining Android/device scope.

Checked November 5, 2026, approximately 7:08 PM Philippine time.

**Verdict: the tested core workflows are working, but the complete live presentation is not yet signed off.** There are confirmed historical demo-data inconsistencies, stale automated checks, and no current paid ticket in the presentation passenger account. No confirmed defect was found in the normal reservation/payment/attendance rules exercised by this audit. This is a bounded assessment, not a guarantee that the entire system has no errors.

No application behavior, existing tests, hosted bookings, payments, attendance records, or operational settings were intentionally changed. Audit helpers and this report were added. Normal sign-in and application reads were exercised; the backend's normal scheduled operations remained active.

## Verification results

| Check                                           | Result                                    | Evidence and practical scope                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                          | PASS                                      | `npm run lint`                                                                                                                                                              |
| Production build and security header validation | PASS                                      | `npm run build`; TypeScript/Vite completed and built inline scripts matched CSP                                                                                             |
| Unit tests                                      | 462/464 passed                            | Two old forecast-heading assertions fail; all other 80 test files pass                                                                                                      |
| Isolated database/Edge Function tests           | 231/232 passed across 26 files            | One assertion expects the earlier boarding rejection message; remaining files were explicitly run after the standard runner stopped at that failure                         |
| Original browser suites                         | 8/10 passed                               | Reservation/payment, payment UI, staff-port gates, shared browser sessions, role navigation, actual grid, terminal display, production MFA/CSP                              |
| Current-UI browser rechecks                     | 2/2 passed                                | Complete QR and broad four-role experience suites rerun with only their obsolete error-message selectors changed in temporary audit copies                                  |
| Additional browser suites                       | 3/3 passed                                | Manual voucher application; historical/used/checked-in/group ticket states; notification pagination                                                                         |
| Actual demo accounts + production assets        | 32 checks passed, zero remaining failures | Actual sign-in through the login form for all four accounts, live backend reads, desktop pages, mobile Passenger pages, and booking dry runs to summary at 1440px and 390px |

The four-role experience recheck passed desktop and mobile cases at **1440px and 390px**. Its success message mentions tablet, but this invocation did not include its 768px case. Separate notification tests covered 1440px, 768px and 390px in both themes; actual grid tests covered 768px, 700px, 699px, 390px and 320px as well as desktop. Physical Android behavior was not covered.

### Roles and flows covered

| Role                     | Verified coverage                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passenger — Carlo Biado  | Actual login, live home/search/bookings/travelers/vouchers/assistant entry/profile; real trip selection, accommodation selection, passenger form and summary without submission; isolated reservation retries, duplicate rejection, fares, seat limits, expiry/cancellation, payment return, ticket ownership/history, manual vouchers and notification pagination |
| Ticketing — Maria Santos | Actual login, live payment queue, bookings, walk-in form and account page; isolated cash payment, discount verification, online-payment approval, ticket issuance, walk-in idempotency/refunds, role and departure-port restrictions                                                                                                                               |
| Boarding — John Doe      | Actual login, live dashboard/check-in/boarding/manifest/account; isolated QR generation/decoding, altered QR rejection, repeat verification without attendance, check-in before boarding, duplicate rejection, arrival cutoff, no-shows, trip-specific boarding-time reason/concurrency and departure-port restrictions                                            |
| Admin — Roy Morante      | Actual login and live dashboard/bookings/trips/reports/staff ports/operations/audit; isolated account dialogs, port assignments, trip creation/edit restrictions, recurring schedules/fleet rotation, fares/accommodations, reporting/PDF routines, audit filters, notifications, settings and permissions                                                         |

The actual accounts have the expected roles. Maria and John both have an active **Calapan Port** assignment. The backend contains future sailings. The configured reservation payment window was **1,440 minutes / 24 hours** at inspection.

## Findings requiring action

### 1. P1 — A fresh payment-to-boarding presentation transaction is missing

**Classification:** confirmed presentation-data gap; not evidence of a broken application workflow.

Carlo has 12 saved bookings but **zero current paid bookings and zero current issued/checked-in tickets**. At inspection, the backend also had **zero current unpaid reservations** and **zero current online payments awaiting staff verification**. Existing historical records cannot demonstrate admission on a current sailing. Late travel windows are correctly rejected by the deployed database guards.

**Impact:** opening the existing demo accounts and immediately attempting payment verification, check-in or boarding will encounter an empty queue or a historical-ticket restriction.

**Evidence:** `scripts/audit-presentation-readiness.mjs`; `.audit/presentation-readiness/live-readiness.json` and `live-browser.json`. The production login/page checks and booking dry runs passed, but no new reservation or attendance transition was submitted.

**Proposed resolution:** rehearse one fresh Calapan-origin booking with these four accounts, on a sailing whose times allow the whole demonstration. Complete payment/required staff approval, retrieve the issued ticket, then record check-in and boarding separately. Use a separate sandbox transaction if demonstrating online payments.

**Acceptance:** a fresh booking progresses from unpaid reservation to paid/verified ticket to checked-in to boarded; the manifest, dashboard and audit agree; repeated attendance and a tampered ticket are rejected. Complete the rehearsal using the exact device/build intended for presentation.

### 2. P2 — Ten completed trips have inconsistent historical seat inventory

**Classification:** confirmed hosted demo-data inconsistency with a source-confirmed preparation-script cause.

Each of ten completed trips has **19 reserved passengers while its saved seat inventory reflects only 18**. All ten have exactly one booking tagged `PRESENTATION_LOYALTY_HISTORY_PREPARED`. The preparation script inserts a confirmed paid booking and boarded passenger but deliberately preserves every existing sailing row, including seat inventory.

**Source:** `scripts/prepare-presentation-loyalty.mjs:57` inserts the booking; the later `original_sailings_guard` rejects changes to sailing rows. The read-only aggregate check `scripts/audit-system-live.mjs:9` detects the resulting mismatch.

**Impact:** historical trip/report inventory cannot be described as fully reconciled. The affected sailings are completed; this does not establish an overselling defect in normal reservation APIs. All other inspected integrity categories had zero issues: seat bounds, accommodation capacity, passenger counts, active staff ports, account-role synchronization and trip time order.

**Proposed resolution:** make the history-preparation process preserve inventory consistency and reconcile the ten affected historical sailings with an auditable, bounded correction. Do not apply the correction to unrelated active sailings.

**Acceptance:** the seat-reservation integrity query returns zero issues; historical booking totals and prepared loyalty history remain intact; normal capacity/cancellation/expiry tests continue to pass.

### 3. P2 — Stock automated checks still fail on obsolete expectations

**Classification:** confirmed test-maintenance defects; the observed mismatches are not confirmed user-facing transaction failures.

| Location                                       | Failure and current behavior                                                                                                                                                                                  | Required acceptance                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/portForecast.spec.ts:16` and `:28` | Expects `7-day forecast` / `3-day forecast`; current component shows `Weather outlook`, `7 days` / `3 days`, and `Daily forecast`. Forecast day-count assertions passed before the heading assertions failed. | Assert the current accessible heading/day count and retain forecast interaction/data checks. Unit suite must pass.                     |
| `tests/database/postgres.test.mjs:2268`        | Expects `Check in first` after moving the sailing to 2020; the stronger arrival cutoff now rejects it with `This ticket travel period has ended...`.                                                          | Expect the travel-window rejection and retain no-show/attendance assertions. Database suite must finish all files without failures.    |
| `scripts/verify-ticket-qr-ui.mjs:48`           | Searches inside `.scanner-modal` for an error that now appears in the global `.app-toast.error`.                                                                                                              | Update the error target while keeping altered-QR rejection, valid decoding, repeat scan, review and zero-unintended-attendance checks. |
| `scripts/verify-experience-ui.mjs:479`         | Searches inside `main` for clipboard failure; the message now appears in the global error toast.                                                                                                              | Update the error target while preserving recovery and all role/interaction checks.                                                     |

Temporary audit copies changed only the two browser error targets. **Both complete browser suites then passed.** The repository's original tests were left unchanged, so the standard unit/database/browser checks must not be reported as entirely green yet.

### 4. P2 — Live provider and physical-device rehearsal remains unverified

**Classification:** verification limitation, not a confirmed defect.

The audit exercised a real production bundle against the live demo accounts, and isolated tests exercised booking/payment/attendance writes against local PostgreSQL and mocked provider responses. It did **not** create a hosted booking, charge a payment, approve a hosted payment, confirm attendance, send a broadcast, change schedules, or reset the database. The assistant entry page loaded, but a fresh live AI response was not requested. A physical QR-camera scan, native Android APK installation and device-specific behavior were not tested.

**Acceptance:** perform one controlled rehearsal on the intended presentation laptop and phone, including camera permission and the complete reservation/payment/ticket/check-in/boarding chain. If online payment or AI is demonstrated, verify the configured sandbox provider round-trip and one live assistant response immediately before presentation.

## Background operations and build observations

All four observed automation jobs were active with latest status `succeeded`: reservation expiry, sailing-status advancement, recurring-trip generation and advisory notifications. Each had one failed run somewhere in the preceding 24 hours; this audit did not establish a recurring current failure or investigate those older run messages. Backend travel-window guards were present in both the QR and attendance implementations.

The build emitted third-party CSS `:host-context` minification warnings and large-chunk advisories. These did not fail the build or the production CSP/browser checks. Startup performance on the presentation phone/network remains a device-rehearsal item.

## Presentation sign-off criteria

1. Reconcile the ten historical inventory discrepancies and repair the preparation script.
2. Update the obsolete test expectations and obtain clean standard test runs.
3. Prepare/rehearse a fresh Calapan-origin transaction through the actual Passenger → Ticketing → Boarding → Admin records workflow, with the configured payment deadline and departure time allowing the full demonstration.
4. Rehearse the actual presentation device, camera, network, sandbox checkout and AI features that will be shown.

After these checks, the presentation can be assessed on a completed live rehearsal rather than screenshots or isolated tests alone.

## Audit artifacts

- `.audit/presentation-readiness/summary.json` — consolidated counts, browser results, demo-data findings and limits.
- `.audit/presentation-readiness/live-readiness.json` — read-only live account/inventory/automation diagnostics.
- `.audit/presentation-readiness/live-browser.json` — 32 actual production/demo-account checks, zero remaining failures.
- `.audit/presentation-readiness/unit.log`, `database.log`, and individual remaining `*.test.mjs.log` — original automated evidence.
- `.audit/presentation-readiness/current-qr-ui.log` and `current-experience-ui.log` — passing current-selector browser rechecks.
- `.audit/presentation-readiness/extra-browser-results.json` — manual voucher, ticket-history and 24 inbox combinations.
- `.audit/presentation-readiness/live-passenger-summary-1440.png` and `live-passenger-summary-390.png` — actual unsubmitted booking summaries.

Audit-only helper scripts are named `audit-current-*.mjs`, `audit-database-suites.mjs`, `audit-extra-browser.mjs`, `audit-demo-browser.mjs`, `audit-presentation-readiness.mjs`, and `summarize-readiness.mjs`. Demo login passwords and authentication tokens were not written to report files.
