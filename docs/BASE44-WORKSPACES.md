# Base44 workspace and account UI update

The reference is `../base44/base44.txt` and the published admin dashboard screenshots supplied by the owner. The React reference uses mock data and several placeholder actions. BarkoLink keeps its Vue/Ionic implementation and connects the adapted screens to the existing Supabase rules.

## Screens and workflows

- Admin dashboard: eight metrics, six-month booking/passenger bars, booking-status donut, popular routes, passenger categories, and today's trips. Dates use Asia/Manila. Chart descriptions identify their scope; empty databases show empty states and zero counts.
- Accommodation: create/edit vessel classes, capacity, additional per-passenger fare, and availability. Class capacities must fit the vessel; capacity cannot fall below reservations. Booking and walk-in forms select a class when offered, and the database validates remaining class and general seats. Additional fares apply after base passenger discounts. Existing bookings retain their class name and fare snapshot when class settings change. No classes were seeded into the hosted project.
- Routes: create/edit active port pairs and estimated duration. Saved routes can fill the trip editor's ports and arrival time when departure is supplied; manual port selection remains available.
- No-shows: admin and boarding staff review paid non-boarded passengers and record attendance only on departed completed trips. Repeating reconciliation does not create duplicate records.
- Notifications: admin previews recipient count and confirms sending to passenger, staff, all eligible accounts, or booked travelers on a trip. Notices appear in the account inbox. Campaign history is persistent; safe retries use a unique request ID. This sends in-app notices, not SMS or email.
- Ticketing navigation: dashboard, bookings, walk-in tickets, passenger search, trips, fares, notifications, and settings. Dashboard counts include the entire database, independently of the current queue page.
- Boarding navigation: dashboard, trips, check-in, boarding, manifest, no-shows, notifications, and settings. Ticket actions retain payment, sailing status, and boarding-order checks.
- Login/register: ocean brand panel, clean form panel, account access tabs, responsive mobile layout, password visibility controls, existing sign-in/recovery/email confirmation, and registration validation.
- Users / Create Account: responsive account dialog with role descriptions, temporary password visibility and generation, clear footer actions, and an account-created screen with password copy feedback. Account creation continues through the existing protected account service.
- Reservation Settings: deadline configuration only, with a “View settings history” link opening Audit Logs filtered to reservation settings. The duplicated Operations activity log has been removed. Audit Logs show name and role under Who, with readable “View changes” details and Philippine time formatting. New events snapshot trusted roles; legacy events keep a clean role label, with a tooltip and collapsed explanation clarifying that their role comes from the present account.
- Action messages: shared BarkoLink dialogs replace native browser confirms and the trip-cancellation prompt. Actions use clear labels and consequences. Dynamic message content is escaped. Invalid cancellation reasons keep the dialog open.
- Audit changes retain the earlier readable descriptions, including status transitions and formatted amounts.

## Database deployment

Applied migrations 012 and 013 together on 2026-10-05 to the configured Supabase project. New tables are `accommodation`, `ferry_route`, and `notification_campaign`; booking/notification records gain related metadata. RLS is enabled and direct browser table access revoked. The public RPC retains trusted roles, profile synchronization, reservation expiry, existing operations, and the audit dispatcher.

Run `node scripts/supabase-management.mjs inspect-parity` to inspect an existing project; `upgrade-parity` checks prerequisites and skips a complete installation. Do not rerun `setup.sql` on the installed project. It contains thirteen migrations for new installations.

No hosted test bookings, seating classes, routes, or notification campaigns were created. Hosted RPC smoke checks can process normal overdue reservation expiry.

## Verification

- TypeScript, lint, 103 unit tests, 37 backend/database tests, and production build passed.
- `scripts/verify-experience-ui.mjs`: role routes, responsive layouts, search/filter behavior, account settings, audit readability, and ticket downloads at 1440, 768, and 390 pixels.
- `scripts/verify-auth-dialog-ui.mjs`: login/register layout, password controls, registration mismatch validation, app cancellation dialog, back-button behavior, exactly one confirmed cancellation, and accommodation selection with correct extra-fare totals and sold-out classes disabled. All backend calls use isolated fixtures.
- `scripts/verify-supabase-live.mjs`: hosted public browsing and denial of unsigned/private table access for the new operations.

Review images in `docs/screenshots/experience/` and `docs/screenshots/auth/` contain synthetic records. Android web assets are synchronized after building; this does not produce an APK or verify a physical device.

The Users refinement passed related unit tests and browser checks at 1440, 768, and 390 pixels, covering generated credentials, role selection, password visibility, exactly one account creation request, and copy feedback. Screenshots use `admin-*-create-account.png` and `admin-*-account-created.png`. The consolidated history refinement passed 39 backend/database tests, 5 focused component tests, production build, lint, and browser checks at those widths. It verifies settings-only navigation, resetting to all records, role labels, readable changes, role snapshots after account role changes, trusted metadata, and filtering before pagination. Screenshots use `admin-*-settings-history.png`. Repeat the relevant UI checks with `BARKOLINK_UI_ROLE=ADMIN` and `BARKOLINK_UI_PATHS=/admin/users,/admin/operations,/admin/audit-logs` when running `scripts/verify-experience-ui.mjs`.

Navigation and audit-label refinement: Admin destinations now use distinct icons (calendar for schedules, bed for accommodation, boat for vessels, compass for routes, price tags for fares, entry for boarding, clipboard for manifest, receipt for audit logs). Ticketing uses a person-add icon for walk-in bookings; Boarding uses an entry icon for boarding. Passenger navigation and settings menus were inspected and already use distinct destination icons. Verified all four roles at 1440, 768, and 390 pixels for unique navigation icons and one brand in each sidebar. Audit rows show only name and role; the legacy explanation is collapsed and works on touch devices. Twenty related unit tests, lint, and production build passed. Android assets were synced.

Records tables now use AG Grid Community in the main Admin tables and staff catalogs. See [AG Grid integration](AG-GRID-INTEGRATION.md) for scope, Grid API controls, backend pagination boundaries, and verification.
