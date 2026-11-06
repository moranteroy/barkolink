# System audit — October 25, 2026

Reviewed the application source, routes, role and port access, shared components, dependency/configuration files, database migrations, Edge Functions, and available test scripts. Existing work was preserved. Generated files, dependency internals, credentials, backups and Git history were not treated as application source to edit.

## Fixes

1. **Staff port setup queued a misleading error.** An unassigned staff account correctly received the port setup notice, but the queue's catch handler also displayed a generic error toast. Ticketing, walk-in, Boarding and staff catalog reads now leave `StaffPortRequiredError` to the existing port setup UI. Other errors still follow the normal error handling. Authorization and blocked requests are unchanged. Added a regression test and verified the complete blocked → admin assignment → operational workspace flow in a browser.
2. **Input validation failed lint.** Replaced control-character regexes with explicit character-code validation, preserving all existing rejected control characters, spaces/backslashes in redirects, and international names. Added checks for every ASCII control character and DEL.
3. **Browser tests referenced older UI.** Updated the background-token check, audit history dialog, tab names with counts, table controls, saved boarding-time wording, generic toast dismissal, test server URLs, staff port profiles, MFA sessions and daily-schedule fixtures. Persistent form/payment messages are selected separately from transient notifications. Tests still reject unhandled operations, unexpected alerts, forbidden calls and browser runtime errors.
4. **PDF integration test exceeded its default timeout under load.** The test embeds actual fonts/logo and generates 180 rows; it now has a specific 15-second limit. The final full suite ran with four workers and passed. No application PDF data or behavior was changed for this timeout adjustment.

## Verification

| Check                                   | Result                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Full unit suite                         | **393 passed**, 74 files                                                                                                               |
| Isolated PostgreSQL/Edge Function suite | **191 passed**, 20 files                                                                                                               |
| ESLint                                  | Passed after the input validation fix                                                                                                  |
| Vue/TypeScript and production build     | Passed, including the post-build CSP hash check                                                                                        |
| Production dependency audit             | Zero reported vulnerabilities                                                                                                          |
| Admin/staff page layouts                | **188 passed**, desktop/mobile, Light/Dark; zero missing fixtures, page errors or layout problems                                      |
| Workflow interactions by role           | **12 role/viewport combinations passed**: Admin, Passenger, Ticketing and Boarding at 1440, 768 and 390 px                             |
| Route/auth access matrix                | **21 passed** across anonymous, Passenger, Admin, Ticketing and Boarding                                                               |
| Staff port setup/recovery               | Both staff roles, desktop/mobile: no forbidden requests, dismissible notice, no duplicate error, reassignment resumes the workspace    |
| Browser sessions                        | Account persistence, stale/concurrent second-login blocking, cross-tab local logout, later passenger login passed                      |
| Reservation/payment browser checks      | Duplicate reservation recovery, unpaid retry, new reservation, online/cash choices, pending verification, payment-return states passed |
| Actual grid controls                    | Numeric/date filtering, Philippine dates, column state, mobile sorting/actions, responsive boundaries and reset passed in both themes  |
| QR tickets                              | Passenger export/decoding and Boarding verification/review passed at mobile/desktop widths                                             |
| Public port display                     | Port isolation, page rotation, date rollover, weather failure/recovery, weather scenes and reduced motion passed                       |
| Production MFA/CSP browser checks       | Admin, Ticketing and Boarding; setup/verification, Light/Dark, desktop/mobile passed                                                   |

The database tests apply the migrations to isolated PGlite databases and exercise role/owner/port restrictions, reservation inventory, fare/discount rules, payment verification, ticket issuance, check-in, boarding, refunds, no-shows, rolling daily schedules, fleet rotation, automation, vessel tracking and accommodation capacity. Edge Function tests exercise account management, payment/webhook, weather and chatbot behavior using test providers.

Workflow interaction evidence was collected through focused role/viewport reruns after correcting stale selectors. Earlier combined-run failures remain in `.audit` for transparency; they are superseded by the scoped results recorded in `.audit/system-ui/verify-experience-ui.json`. Admin desktop/tablet checks passed before the obsolete mobile selectors stopped that run; the complete Admin mobile rerun passed after their correction. Passenger, Ticketing and Boarding each passed their complete three-width run. Reviewed representative Admin, Passenger and staff screenshots in both themes.

## Live Supabase checks

Public port and sailing reads passed. Anonymous admin/staff/passenger-private requests and direct access to protected tables were rejected. Account management rejected unauthenticated requests.

Read-only aggregate checks found **zero issues** in seat bounds, reservation-to-seat totals, class allocation limits, booking passenger counts, active staff port assignments, effective account roles, and trip arrival/departure ordering. A missing Auth role is treated as Passenger, matching the deployed dispatcher. No live records, roles, passwords, assignments, policies or provider settings were changed during this audit.

## Limits

- Browser workflow checks use isolated fixture sessions and intercepted backend/provider responses. Live checks establish API protection and data consistency; they do not prove every authenticated production transaction end to end.
- No actual payment, refund, email/SMS delivery, or hardware camera scan was performed. Android compilation and physical-device behavior were not tested.
- The Cypress executable is absent. Its install download was impractically slow and was stopped. The existing Cypress heading assertion was updated, but that runner remains unexecuted; equivalent public/auth route checks ran through Playwright.
- Successful builds still emit upstream Ionic CSS minification warnings and shared-bundle size warnings. These are warnings, not build failures, and were not hidden by increasing the warning threshold.

## Repeating checks

```powershell
npm run lint
npm run test:unit -- --maxWorkers=4
npm run test:database
npm run build -- --configLoader native
npm audit --omit=dev
```

For fixture browser checks, start a separate local Vite server on port 8127, then run `node scripts/verify-system-ui.mjs`. An existing server can be selected with `BARKOLINK_UI_URL`. The runner permits only its reviewed fixture-only checks; it never runs operational data setup/reset scripts. `node scripts/audit-system-live.mjs` performs the aggregate read-only checks using existing management configuration. Logs, individual receipts and screenshots remain in ignored `.audit/` and `docs/screenshots/` directories; no credentials belong in this report.
