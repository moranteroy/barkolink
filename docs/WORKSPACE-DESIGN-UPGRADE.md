# Workspace design upgrade

Implemented 5 October 2026. Design reference: `../base44/base44.txt` in the shared workspace. The reference remains intact; its layouts were adapted into the existing Vue/Ionic application.

## Interface

- Passenger home, administrator dashboard, ticketing desk, and boarding desk share an ocean-themed welcome panel with working shortcuts. The boarding shortcut scrolls to the current manifest.
- Workspace sidebars use consistent navy surfaces, active navigation indicators, card corners, and table headers. Admin dashboard metrics have distinct icons, and each departure links to its sailing operations workspace.
- Passenger pages now use the browser's available width instead of the previous fixed 430px phone preview. Container queries retain compact mobile layouts. The desktop header provides Home, Find a ferry, and My bookings; bottom navigation becomes a centered floating dock on large screens.
- Saved travelers and Help use the same passenger layout container as the other passenger pages.
- Admin navigation includes a dedicated Audit logs page at `/admin/audit-logs`. Reservation settings and the existing operations activity view remain available.

## Audit search and database

Migration `011_workspace_audit.sql` adds an indexed `AdminAuditLog` operation behind the existing public RPC. Search matches actor name, action, entity type, or record identifier. Action and inclusive date filters apply before pagination, and the total uses the same filters as the records. Dates use Asia/Manila midnight boundaries. Searches treat `%` and `_` as literal characters.

Only a signed-in ADMIN derived from trusted Supabase Auth metadata can read these logs. The private dispatcher and direct activity table remain inaccessible to browser roles. The existing experience dispatcher, account profile updates, booking transactions, and operational permissions are retained. No new business tables or replacement accounts are needed for this visual upgrade.

Audit logs and the Operations activity view display changes in plain language, for example “Status: Changed from Boarding to Completed.” Fare amounts use PHP, discounts use percentages, payment windows use hours/minutes, and timestamps use Philippine time. Added and cleared fields are explained explicitly. Nested details are rendered as labeled text rather than raw JSON; the stored audit history is unchanged.

Applied migration 011 to the configured owner's Supabase project in one transaction after local database checks and installed-prerequisite inspection passed. Existing records were preserved. Do not re-run `supabase/setup.sql` against that installed project.

For another project with migrations 001–010 installed, apply migration 011 once. For a new project, the regenerated `supabase/setup.sql` includes all eleven migrations. `node scripts/supabase-management.mjs inspect-workspace` reports upgrade state; `upgrade-workspace` checks prerequisites and skips an already installed upgrade.

## Verification

- TypeScript and production build passed. Existing Ionic CSS minification and large dependency chunk warnings remain nonfatal.
- 96 unit tests and 31 backend/database tests passed. New database checks cover search across pages, consistent totals, literal wildcard searches, Manila date boundaries, paging validation, and role/access rejection. Existing profile synchronization and booking/payment/boarding tests pass with the new dispatcher.
- Lint passed.
- Browser checks passed at 1440px, 768px, and 390px for all four roles, including audit filtering/reset, passenger width, booking filters, account settings, ticket downloads, notification actions, and horizontal overflow. Backend calls use isolated fixtures.
- Hosted public browsing and access-protection checks passed, including unsigned audit rejection and direct activity table denial. No test accounts or bookings were created.
- Production assets were synchronized into the existing Android project. This does not build a new APK or establish physical-device behavior.

Run the local server on port 8110 and `node scripts/verify-experience-ui.mjs` to repeat the role checks. Review images in `docs/screenshots/experience/` contain synthetic records.
