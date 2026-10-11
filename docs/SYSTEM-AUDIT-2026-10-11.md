# Local system audit — 11 October 2026

Reviewed the project inventory, application configuration, authentication/session handling, routing, booking/payment helpers, staff access controls, database migrations and Edge Function tests, browser verification scripts, and Android configuration. Existing work in the folder was preserved. Generated assets and dependencies were checked through builds and tooling rather than edited.

## Corrections

- **Password verification revoked other sessions.** The isolated client used to check the current password called `signOut()` with its default global scope. It now uses `{ scope: 'local' }`, ending only the temporary verification session. Added regression coverage for successful verification, a different account, and invalid credentials. The installed Supabase Auth SDK documents the default global scope in `node_modules/@supabase/auth-js/src/GoTrueClient.ts`.
- **Route saving failed lint.** Replaced unused destructuring with an explicit save payload containing the route's editable fields and parsed duration. This also avoids forwarding display metadata from a loaded route.
- **Invalid Maps search URL.** Corrected the helper from `/maps/trips/` to `/maps/search/` and added a regression test for the endpoint and encoded query. The supported format is documented in [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started#search).
- **Duplicate admin navigation icons.** The personal notification inbox now uses a mail icon, distinguishing it from notification broadcasts. The existing browser navigation check caught this issue.
- **Browser checks lagged behind current features.** Added fixtures for daily schedules, sailing status policies, vessel positions/availability, loyalty quotes, unread notifications, and verified ticket QR payloads. Updated the cancellation assertion to use the current selected status button. Reservation and payment scripts now support `BARKOLINK_UI_URL`, with the same default local server as the workspace check.

## Validation

| Check | Result |
| --- | --- |
| Unit tests | 299 passed across 57 test files |
| Isolated database and Edge Function tests | 125 passed across 11 test files |
| Production build | Passed, including Vue/TypeScript checking |
| Production dependency audit | Zero known vulnerabilities reported by `npm audit --omit=dev` |
| Reservation browser checks | Passed duplicate notices, edit recovery, unpaid retry, and new reservation scenarios |
| ESLint | Passed |
| Workspace browser layouts | All four roles passed at 1440, 768, and 390 pixels in Light and Dark themes; no captured page errors or horizontal overflow |
| Payment browser checks | Passed at 390, 560, and 1440 pixels in both themes, including QR display, checkout closure, return status, and staff verification |
| Authentication browser checks | Passed login/registration validation, confirmation dialogs, cancellation, and accommodation selection at desktop, tablet, and mobile widths |

The database tests apply migrations to isolated PGlite databases and exercise authorization, ownership, seat inventory, duplicate reservations, payment verification, boarding, refunds, daily schedules, automation, vessel tracking, and demo-data integrity. Browser checks intercept Supabase and payment requests with fixtures; they do not charge accounts or modify hosted records.

## Remaining validation and maintenance

- Hosted Supabase deployment, provider credentials, actual payments, email delivery, and production redirects were not exercised. Local passing tests do not establish that the deployed backend has the same migrations/functions.
- Android configuration was inspected; APK compilation and physical-device camera/native behavior were not tested.
- The successful build still reports upstream Ionic `:host-context` CSS minification warnings and large shared JavaScript chunks. Bundle analysis and splitting shared grid/UI dependencies remain performance follow-up work; the warning threshold was not increased to hide them.
- Unit tests produce Ionic sourcemap and test-harness route/storage warnings. No unit tests failed.
- Existing uncommitted changes remain in place. No deployment, Git commit, or hosted database changes were made during this audit.
