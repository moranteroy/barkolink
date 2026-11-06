# BarkoLink system readiness review — November 6, 2026

Assessment: the tested core web workflows pass, but the complete web-and-Android release is not yet fully cleared for presentation. Dependency remediation, release synchronization, development optimizer cleanup, and physical-device acceptance remain open.

Scope: current working tree, full automated application/database checks, focused review of authentication, payment/ticket eligibility, staff port gates, the new TV feed, Android printing/configuration, and aggregate live database checks. This review did not change application code, operational records, or dependency versions. Earlier feature changes remain uncommitted in the working tree. Browser transaction fixtures intercept backend requests; database transaction tests use isolated PGlite instances.

## Findings

### 1. P1 — Dependency advisories remain

`package.json:70` and `package.json:71` allow the currently installed Vite 8.3.1 and Vitest 4.0.18. The complete npm audit reports **22 affected package entries: 1 critical, 9 high, 12 moderate**. Entries include transitive packages; this is not a count of independent application exploits. The production-dependency audit reports one affected package entry, Vite, with high severity. Vite also enters the production dependency graph through the build plugin configuration.

The critical Vitest issue concerns its UI/API/browser server, with specific exposure conditions; normal `vitest run` is the project test command. The Vite advisory includes Windows editor-launch middleware. These findings do not establish compromise of passenger data or an exploit in the static APK bundle. They do require dependency remediation before treating the release as security-cleared.

The upstream [Vitest advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp) documents the affected UI/API conditions and patch. The [Vite/launch-editor advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm) lists Vite 8.3.3 as patched on the installed release line. The complete npm audit proposes Vitest 4.1.12 for its current advisory set; Cypress remediation includes a major-version change and needs separate review.

Proposed change: update affected packages deliberately, review Cypress compatibility, regenerate the lockfile, and rerun affected checks. Acceptance: fresh complete/production audit reports reviewed, with no unresolved critical/high entries relevant to the chosen deployment. Do not use an unchecked force upgrade as an acceptance shortcut.

Evidence: `.audit/system-scan/dependencies.log`, `.audit/system-scan/full-dependency-audit.json`.

### 2. P1 for Android presentation — Latest UI changes are absent from the downloaded APK

The downloaded APK receipt identifies commit `ddbac81716e0c78dd485ac1d5172f10142f2edac`, version 1.0.2. The subsequent Ticketing TV shortcut, staff trip/weather UI changes, and their tests are still local changes. Database migrations 066 and 067 were applied previously, so backend and installed application versions must be distinguished.

Affected roles: Ticketing and Boarding, and anyone presenting the latest app behavior on Android. Proposed change: publish the verified source, build a new APK through the existing workflow, and install that exact artifact. Acceptance: artifact commit matches the intended source and the device shows the TV shortcut, assigned-port restriction, today's trips first, and staff weather removal. Admin access and Passenger weather must remain intact.

Evidence: `android/app/build.gradle:11`, `.audit/github-main-apk.json`, current Git working-tree diff, and the local APK artifact.

### 3. P2 — Development dependency scan includes generated Android HTML

Starting the normal development server caused Vite to scan both the application `index.html` and `android/app/src/main/assets/public/index.html`. The copied Android document references `/security/modern-browser-check.js?entry=index.html`, which fails dependency scanning in that context. Vite then skips pre-bundling. The production build succeeds.

Location: `vite.config.ts`, development configuration and missing explicit dependency-scan entries. Proposed change: scope dependency scanning to the actual web entry and exclude generated native output. Acceptance: a fresh development start completes dependency optimization without scanning the copied Android document, and browser navigation remains stable.

## Completed verification

| Check                                            | Result                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Full unit suite                                  | 474 tests passed, 83 files                                                                           |
| Full isolated database and Edge Function tests   | 236 passed                                                                                           |
| ESLint and Prettier                              | Passed                                                                                               |
| Deno lint and type checking                      | Passed                                                                                               |
| Production TypeScript/Vite build                 | Passed; existing CSS/chunk-size warnings remain                                                      |
| Built CSP/security headers                       | Passed; four inline script hashes verified                                                           |
| SQL setup bundle                                 | Matches 67 migrations                                                                                |
| Publish-safety working-tree scan                 | Zero findings                                                                                        |
| Public mobile build configuration                | Passed with local public variables loaded; initial CI-oriented invocation had no process environment |
| Principal browser suites                         | 8/8 passed                                                                                           |
| Additional reservation/payment retry checks      | Passed                                                                                               |
| Additional payment/ticket state checks           | Passed                                                                                               |
| Staff port access/reassignment browser checks    | Passed                                                                                               |
| Public/locked TV display and responsive controls | Passed                                                                                               |
| Browser CSP/security check                       | Passed                                                                                               |
| Cross-tab session check                          | Passed with warmed development dependency cache                                                      |
| Live aggregate integrity                         | Zero issues in all seven checked categories                                                          |
| Live unsigned access and direct-table protection | Passed                                                                                               |

The principal browser suites cover walk-in cash issuance and QR reprint, role navigation, notifications, responsive passenger pages, manual vouchers, historical/used tickets, QR verification, and mobile ticket print/download controls. Additional payment checks include duplicate/retried reservations. Database tests cover capacity, deadlines/expiry, discounts, payment receipt and staff verification, ticket issuance, separate check-in/boarding, duplicate/tampered scans, refunds, reports, schedules, and ownership/role/departure-port restrictions.

All six additional browser checks passed on their final appropriate test setup, bringing this scan to 14 completed browser suites. Initial attempts used a stopped preview server and were repeated once it was started. The session fixture imports `/src/services/auth.ts` and therefore requires a development server; it cannot complete against a static production preview. Early development runs were interrupted by dependency-optimizer reloads, including `net::ERR_ABORTED` during refresh. Server output confirmed newly optimized dependencies followed by full reloads. The final warmed-cache run passed all assertions: stale and simultaneous second logins were blocked, only one concurrent provider sign-in succeeded, tabs reused the current account, refresh preserved identity, shared logout cleared other tabs, and Passenger could sign in afterward. No authentication code or assertions were changed to obtain that result. The development optimizer warning remains finding 3.

Live aggregate checks found zero issues for seat bounds, reserved-seat reconciliation, accommodation capacity, booking passenger counts, active staff-port assignment, account-role synchronization, and invalid trip times. Smoke checks confirmed that unsigned callers cannot read private/admin records or protected tables, and that account-management requests require authentication. No new bookings, accounts, payments, or broadcasts were created by the review scripts; the existing smoke script notes that normal API calls can process overdue reservation expiry.

## Limits and presentation acceptance

The review used local browsers and a production web bundle. It did not exercise the new build on a physical Android phone, the real camera, or Android's print/Save as PDF sheet. Those device checks remain necessary for the Android presentation. No new live payment-provider transaction or AI-provider generation was performed in this scan. PayMongo sandbox mode remains intentional.

Evidence is retained locally under `.audit/system-scan/`, `.audit/system-ui/`, and `.audit/system-live-integrity.json`. Synthetic screenshots remain ignored. Environment files and private configuration are not included in this report or staged for publishing.
