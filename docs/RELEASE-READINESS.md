# UX implementation and release readiness

Updated 6 October 2026. Changes are implemented in the local Vue/Ionic application and tested with isolated data. Migration 018 has now been applied to the configured hosted Supabase project. Updated web assets were synced into the Android project. The web frontend has not yet been published to Vercel, and an APK has not been compiled.

## Implemented changes

| Area | Result |
| --- | --- |
| Booking and search | Sailing dates and date headings; explicit Philippine time; delayed status preserved; saved totals and individual base fares; complete identity review; invalid passenger fields linked to their errors and focused for correction; valid Philippine-calendar birth dates. |
| Booking history and feedback | Past departures replaces the misleading Completed filter. Home, bookings, details and notifications distinguish loading, errors and successful empty results. Clipboard denial gives an actionable message. |
| Counter sales | Accessible payment dialog, visible printed receipts, inputs first on mobile, stable pending sale retained across reloads, recovery by reference, and no second cash collection on retry. |
| Boarding | Choosing or scanning a passenger reveals and focuses Ticket review on small screens. Manifest export remains unavailable to Boarding staff, as requested. |
| Admin directories | Migration 018 applies search/status/sailing/paid filters before pagination. Sailing choices include the complete authorized list. Table-specific sort/filter controls remain explicitly scoped to the loaded page. |
| Admin navigation | Fleet setup grouped separately from operational tasks. The former Analytics URL redirects to Reports. The bell opens a personal inbox; campaign management is labeled Broadcasts. Embedded operations/advisories no longer repeat headings and Refresh buttons. |
| Manifest | Direct Admin manifest CSV export uses the existing authorized export service and preserves its chosen sailing through refreshes. |
| Reports | Custom fare categories count under Other discounts rather than disappearing. Charts provide data tables; monthly values are visible; collection bars no longer behave like buttons without an action. |
| Editors and settings | Distinct route ports, class capacity bounds/hints, load/retry states, loaded-page search/sort tools, and protected reservation settings. A failed settings load cannot save the default as if it were the stored value. |
| Saved travelers | Sex requires a deliberate choice; Other retains its meaning in booking. Failed saved-list loading offers retry while manual entry remains available. Editing scrolls Ionic content and focuses the form. |
| Accessibility and consistency | Booking fields have linked errors, navigation sets meaningful titles and heading focus, ticking countdowns sit outside live announcements, shared tables keep mobile sorting/column controls, selected navigation/action colors have improved contrast, and errors use theme tokens. |
| Unsaved changes | Route/tab navigation and page unload protect profile, password, route, accommodation, advisory, broadcast and admin modal/fare edits. Admin editor dismissal is guarded; Refresh offers keep/discard choices for the embedded editors. |
| Public help and contact | Schedule browsing and Help are accessible before sign-in; reservations/private records retain authentication. Operator details are configurable, with terminal-desk guidance while contacts are blank. |

The original observations and before/after examples remain in [UI-UX-AUDIT.md](UI-UX-AUDIT.md). The first batch is recorded in [UX-IMPROVEMENTS.md](UX-IMPROVEMENTS.md).

## Validation

Latest update: the owner requested normal display names and passenger accounts. The current dataset now has 75 bookings and 160 passenger records with no TEST display labels, plus three new confirmed Passenger accounts using the owner-supplied password. Existing accounts were preserved during reseeding. Live login, own-booking and saved-traveler checks passed for the new accounts. Dashboard chart spacing and legends were revised and verified at six widths in both themes. [DEMO-WORKFLOWS.md](DEMO-WORKFLOWS.md) supersedes the earlier TEST-data guide for current workflow references.

The owner subsequently requested a pre-deployment operational reset. On 6 October 2026, all 16 operational/reference tables were backed up and replaced with fictional acceptance data; the four login accounts and five complete app profiles were preserved. The dataset contains 15 sailings, 33 bookings and 82 passenger records. Live checks covered 34 module operations and seven transactional workflows, with test actions rolled back. See [TEST-DATA.md](TEST-DATA.md) for records and role-specific testing instructions. Earlier statements about no hosted test bookings describe validation before this authorized reset.

- 115 unit tests passed; affected admin/report/profile tests were also rerun after later editor protection changes.
- 52 isolated database and account-function tests passed after the realistic dataset update, including filtering before pagination, role restrictions, ownership, atomic booking/payment behavior, safe repeated walk-in requests, user-preserving reset, realistic data generation and rollback verification.
- The full experience browser suite passed for Admin, Passenger, Ticketing and Boarding at 1440, 768 and 390 pixels, using a Los Angeles browser timezone.
- Additional mobile checks passed for service failure/Retry, stored walk-in recovery after simulated response loss, and the original receipt/dialog fixes.
- Anonymous Help/search/privacy checks and private-booking redirects passed at desktop and mobile widths.
- Lint, TypeScript and production build checks passed. Existing Ionic CSS minification and large-bundle warnings remain; these are not a full performance certification.
- Browser tests intercepted backend traffic. No real hosted cash transaction or notification was sent. The receipt print output and representative mobile pages were visually inspected.

## Required for the existing hosted system

Release progress on 6 October 2026:

- Migration 018 applied in one transaction to project `utobfkfmuepuoseszxks`; the frontend and management project identifiers matched before applying it. No booking, payment or account records were edited by the migration.
- Live authorized AdminSailings, AdminUsers, AdminPassengerRecords and AdminSailingOptions response shapes passed. Private-function and direct passenger-table permissions remain restricted. The first verification attempt used the management API's read-only role, which cannot execute private functions; verification succeeded using its privileged execution mode without modifying application records.
- Live public browsing, unauthenticated role restrictions, direct-table restrictions and account-function authentication checks passed. These public RPC calls can process normal overdue reservation expiry; no test accounts or bookings were created.
- `npx cap sync android` passed using the tested production build. APK build was attempted and stopped at the invalid JAVA_HOME check; the standard SDK location and configured SDK path are absent.
- Vercel SPA routing/build config and credential upload exclusions are prepared. No Vercel login/token/project connection was found, so publishing and production authentication URLs remain pending. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md).

1. Completed on the configured project: applied only [018_admin_directory_filters.sql](../supabase/migrations/018_admin_directory_filters.sql), after migrations 001–017, using the normal migration process or a transaction in the SQL editor. The updated admin filters and sailing-options operation depend on it.
2. Deploy the tested frontend build together with that backend change. Do not run the full setup SQL on an existing project. `supabase/setup.sql` was regenerated from all 18 migrations for a new project only.
3. When official contact details are available, set `VITE_OPERATOR_NAME`, `VITE_SUPPORT_EMAIL`, and `VITE_SUPPORT_PHONE` and rebuild. `.env.example` documents these settings. No operator identity/contact information was invented.
4. Verify one real operator-approved booking/payment/boarding/refund flow in staging, then the terminal printer/PDF output and the intended Android devices before operational use.

## Needs verification

- Physical terminal printers, actual paper sizes, Android WebView/keyboard/camera/share/print behavior, and real screen-reader announcements.
- Vercel frontend deployment, real email-reset delivery and real operator accounts/data. Migration 018 installation and live admin response shapes were verified.
- Operator-specific policies, official support/privacy contact details and final operating procedures.
- A complete WCAG conformance review, production-scale search/list performance and real-device load times. Shared validation and draft handling cover the changed common flows; legacy forms may still benefit from additional field-level feedback.

These remaining checks require the real deployment, hardware or operator information. They are not inferred from fixture screenshots.
