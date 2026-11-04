# BarkoLink audit and fixes — November 4, 2026

The owner confirmed that PayMongo is intentionally sandbox-only. That is the intended system behavior, not a defect to convert into live payments. The sandbox key restriction, provider verification, ticket eligibility, and existing payment presentation are preserved.

The other actionable findings have local code fixes. Migrations 061 and 062 were applied to the configured hosted database on November 4 after the owner's deployment instruction. Other deployment and physical-device acceptance steps remain separate below.

## What changed

| Original finding | Resolution | Evidence |
| --- | --- | --- |
| Choosing cash on a fresh unpaid booking returned UNPAID, or failed without the optional PayMongo key | Returns a successful CLOSED outcome when no checkout exists. Provider credentials are checked only when actually calling PayMongo. Existing checkout closure/payment-race checks remain. Payment errors remain visible inline. | [Payment handler](../supabase/functions/paymongo/index.ts), [payment UI](../src/components/passenger/OnlinePayment.vue), [regression tests](../tests/database/paymongo-function.test.mjs) |
| Global admin sorting fetched every offset page and could duplicate/omit records during concurrent inserts | Filtering, sorting, row selection, and matching count run in one database query. The browser requests only its current page. Stable identity tie-breakers are included. The obsolete client collector and its tests were removed. | [Migration 061](../supabase/migrations/061_bounded_workspace_reads.sql), [admin workspace](../src/views/admin/AdminWorkspacePage.vue), [database tests](../tests/database/role-notifications.test.mjs) |
| Broadcast history also collected every page before searching/sorting | Search/sort/pagination run on the server. Stale responses cannot overwrite a newer search. | [Broadcast panel](../src/components/admin/NotificationsPanel.vue), [communication tests](../tests/unit/adminCommunication.spec.ts) |
| Background polling downloaded the whole inbox | Bell polling returns at most 50 recent notices and the global unread count. All four roles load inbox history in pages of 30, with server search/category/unread filters and global category counts. Mark-read races, account switches, and failed refresh behavior remain protected. | [Notification state](../src/composables/notificationUnread.ts), [staff/admin inbox](../src/components/admin/InboxPanel.vue), [passenger inbox](../src/views/passenger/PassengerRecordsPage.vue), [migration](../supabase/migrations/061_bounded_workspace_reads.sql) |
| Native email links lacked an app return path | Android declares the app scheme; native requests use app-owned callbacks and PKCE. Cold-start/running-app callbacks are consumed once. Unrelated destinations, bearer-token injection, failed exchanges, and replacement of an active account are rejected. Web redirects and manual email codes remain available. | [Auth links](../src/services/authLinks.ts), [manifest](../android/app/src/main/AndroidManifest.xml), [tests](../tests/unit/authLinks.spec.ts), [setup instructions](ANDROID.md#email-confirmation-and-password-recovery) |
| CI skipped business-rule suites and pull requests | A separate PR/main workflow runs lint, unit tests, isolated database/Edge Function tests, build/CSP checks, and browser fixtures. Browser CI uses synthetic project settings and intercepted requests. | [Checks workflow](../.github/workflows/checks.yml), [browser runner](../scripts/test-browser-fixtures.mjs) |
| Scheduled advisories depended on somebody opening the app | Migration 061 registers minute-based pg_cron delivery when available. Authenticated refresh remains a fallback; deduplication and recipient restrictions remain. This delivers in-app notifications, not external email/SMS/push. | [Migration](../supabase/migrations/061_bounded_workspace_reads.sql), [notification guide](NOTIFICATION-DELIVERY.md) |

One sorted page and its count now share a statement snapshot. Separate page visits still show current records; this is not a frozen export spanning future inserts/deletes. Ticketing's departure-port restrictions remain in its original dispatcher path. Admin-only helpers are private, and user-provided sort strings never become SQL fragments.

## Deployment steps

For an existing backend already at migrations 001–060:

1. **Completed on the configured project:** migrations [061](../supabase/migrations/061_bounded_workspace_reads.sql) and [062](../supabase/migrations/062_today_first_admin_trips.sql) were applied together in a transaction. Pre-change function definitions were backed up locally. Do not reapply these or run the combined setup on this existing project. [setup.sql](../supabase/setup.sql) is for new projects only.
2. Redeploy the `paymongo` Edge Function, keeping the existing **test** secrets. This fixes cash selection; it does not enable live payments.
3. Deploy the frontend with the migration. Server sorting and bounded notifications depend on migration 061; deploying only the frontend does not complete these fixes.
4. Add these exact destinations in Supabase Authentication > URL Configuration > Redirect URLs:

   ```text
   com.barkolink.app://auth/login
   com.barkolink.app://auth/reset-password
   ```

   Keep the actual web URLs too. Rebuild/sync the Android app and test real confirmation/reset emails on a device. PKCE links should be requested on the same installation; manual email-code verification is the fallback.
5. Where pg_cron is installed, verify that `barkolink-advisory-notifications` exists and runs successfully. Without it, advisory delivery still occurs on authenticated refresh.
6. After pushing the workflow, configure `Application checks / checks` as a required PR check if branch protection is desired. Local files cannot establish hosted branch-protection settings.

The hosted database migration is complete. No payment provider transaction, Edge Function deployment, frontend hosting deployment, account change, auth callback configuration, or branch-protection update was performed. Migration 061 also registers scheduled in-app advisory delivery where pg_cron is available.

## Verification

- Lint passed.
- Full unit suite: **449 passed across 79 files**, including PKCE callbacks, account protection, bounded unread totals, and notification synchronization.
- Full isolated database/Edge Function suite: **220 passed across 24 files**.
- Focused database tests cover sorting before paging, stable identities, numeric amount ordering, matching counts, payment-verification filters, invalid sort input, role restrictions, bounded summaries, history pages, search/category/unread filters, and owner isolation.
- Browser fixtures cover all four roles at 1440, 768, and 390 px in Light/Dark themes: 24 role/viewport/theme combinations. They exercise multi-page history, global unread counts, search, and marking all read. Representative screenshots were inspected.
- Production builds include Vue/TypeScript validation and post-build security-header/CSP checks.
- Final production-browser runner passed **21 route/auth checks** and **24 inbox role/viewport/theme checks**. The runner started and stopped its own preview server.
- `npx cap sync android` passed and synchronized the verified build and four native plugins, including the App plugin used by email links.

Local database logs and browser screenshots stay in ignored `.audit/`; they contain synthetic fixture records, not exported hosted data. GitHub's Linux workflow itself has not been run here.

An initial migration version added a dispatcher wrapper that caused the PGlite reservation suite to exhaust memory. It was replaced with insertion into the existing dispatcher, preserving the previous call depth. The 68-test core business-rule suite then passed. The superseded failed run was not counted as successful verification.

## Remaining limits and intentional scope

### Mobile layout follow-up

Phone spacing, search, landing, booking, sailing-board and weather cards have been compacted with viewport rules at or below 600 px. Android immersive mode, cutout spacing and keyboard navigation handling were added. Verification passed: 451 unit tests, lint, production build/CSP, 72 passenger browser combinations, 10 landing combinations, and 60 representative workspace combinations. Capacitor Android sync passed. A rebuilt APK and physical-phone acceptance remain pending because the local Android/JDK toolchain is unavailable. See [the mobile implementation and verification report](MOBILE-UI-2026-11-04.md).

### Admin trip ordering follow-up

The default Trips & schedules order is now **Today first (PH)**. It places today's Scheduled/Boarding/Delayed sailings first, in departure order; then today's Completed/Cancelled sailings; then future sailings from nearest to farthest; then past sailings from most recent backward. Without today's sailings, the nearest future sailing appears first. Explicit earliest/latest departure and vessel-name sorts remain available. The priority is applied before server pagination using Asia/Manila calendar dates, so today's trips cannot be hidden behind later generated dates. Migration 062 adds the order without modifying bookings, sailing times, or statuses.

Follow-up validation: 11 focused database tests passed, including multi-page ordering, no-today fallback, explicit latest-first override, cancelled filtering, and Philippine midnight boundaries with a Los Angeles database timezone. Lint and production build/CSP checks passed. Admin Trips browser fixtures passed at 1366/390 px in Light/Dark (four checks); representative screenshots were inspected.

Hosted verification after applying 061/062: the directory contained 421 trips and its first six results were November 4 departures at 7 PM, 9 PM, and 11 PM Philippine time (Boarding/Scheduled), ahead of future generated trips. The first read-only verification was denied permission to execute the private helper; a SELECT-only check using owner access then passed. The deployment helper is [apply-admin-trip-order.mjs](../scripts/apply-admin-trip-order.mjs); rerunning it skips installed migrations and verifies the order.

- PayMongo stays sandbox-only as requested. Debug APK output remains suitable for demonstration/device testing; store signing needs a separately supplied release key if distribution is later requested.
- Existing Ionic CSS-minification and large-bundle warnings remain. No slow-page defect was measured; changing shared grid/bundle behavior without profiling is a separate performance task.
- No physical Android camera/printer test, actual email-link delivery, Android compilation, hosted schema-parity check, real PostgreSQL concurrency load test, or backup/restore drill was performed. Isolated tests and browser fixtures do not replace these checks.
- GitHub Actions execution, required branch protections, Supabase callback allowlists, and cron operation require verification in their hosted environments after deployment.

Repeat local checks from the app directory:

```powershell
npm run lint
npm run test:unit -- --maxWorkers=4
npm run test:database
npm run build -- --configLoader native
npm run test:browser
```

The browser command starts its own preview on port 8127, so that port must be free. Local checks use Edge; set `BARKOLINK_BROWSER=chromium` after installing Playwright Chromium to use the CI browser. Builds and fixtures must use the same public Supabase URL; fixture backend calls are intercepted.
