# Supabase deployment

## Base44 workspaces (2026-10-05)

Applied migrations 012 and 013 in one transaction, preserving existing records. Added accommodation inventory and snapshotted class fares, persistent ferry routes, notification campaigns, real admin overview analytics, role-specific staff catalog/search operations, and boarding no-show reconciliation. New tables use RLS with browser table access revoked. Hosted browsing and access-protection checks passed. No classes, campaigns, or test bookings were created in the hosted database. See [Base44 workspaces](BASE44-WORKSPACES.md) for UI changes, scope, and verification.

Installed on **2026-10-03 (Asia/Manila)** in project `utobfkfmuepuoseszxks`.

- Nine PostgreSQL application tables and indexes.
- Transactional PostgreSQL functions for reservations, cash collection, ticket issuance, cancellation, check-in, boarding, administration and reports.
- Supabase Auth profile synchronization trigger.
- Row-level security enabled on all nine tables; browser roles access data through the controlled application RPC.
- `manage-account` Edge Function deployed and active; it verifies user sessions and requires ADMIN for account creation.
- Local email confirmation and password recovery redirect URLs registered for localhost and 127.0.0.1 on ports 8100 and 5173. Existing redirect URLs and Site URL were preserved.

The setup was applied through the Supabase Management API using the locally supplied personal access token. The token remains in the Git-ignored `.env.supabase-management` file and is not included in application bundles.

No sample data or production bookings were created. Existing Firebase accounts and records have not been imported. The owner registered the first account and authorized manual confirmation for its dummy email; its ADMIN role is now assigned and verified in both Supabase Auth and the application profile. Ports, vessels, fares and future sailings can now be entered through the admin workspace.

Applied migration 014 on October 5, 2026 to fix the Accommodation RPC error `column reference "a.vessel_id" is ambiguous`. The dispatcher now uses a distinct selected-row variable instead of sharing the SQL table alias. Only the function was replaced; existing inventory and bookings were preserved. Verified the hosted public Accommodation RPC with an existing administrator identity, returning only a record count. Private function and direct table permissions remain denied to browser callers. Local database/backend regression tests and hosted access checks passed. Use `node scripts/supabase-management.mjs verify-accommodation` to repeat the aggregate RPC check.

Applied migration 015 on October 5, 2026 to centralize reservation settings history in Audit Logs and capture actor roles from trusted Auth metadata for future events. Existing history remains intact. Legacy records without a role snapshot display the current account role with an explicit label. Added exact record-type filtering before pagination. Verified the hosted settings-history RPC, enabled capture trigger, and unchanged private-function/direct-table restrictions. No hosted test events were inserted; the hosted settings-history query currently returns zero matching records. Local regression tests cover role changes, system events, legacy roles, and settings-history pagination. Repeat hosted aggregate verification with `node scripts/supabase-management.mjs verify-audit-roles`.

Do not run `supabase/setup.sql` again on this installed schema. Future changes should be added as new migrations. Use `node scripts/check-supabase.mjs` for the public database connection check and `node scripts/verify-supabase-live.mjs` for read-only API/access smoke checks.

## Operations upgrade (2026-10-03)

Applied migrations 005 and 006 in one transaction, preserving existing bookings and accounts. Added operation_settings and activity_log with RLS and no browser table grants. Reservation deadline is 1440 minutes (24 hours), capped at departure. The active pg_cron job barkolink-expire-reservations runs every minute. Installed vessel-overlap and operational audit triggers, discount verification, pregnancy fares defaulting to 0% discount, cancelled-trip refund tracking and paginated RPC records.

Android project created and web assets synchronized. Gradle compilation stopped at an invalid JAVA_HOME; the Android SDK is also missing from the checked locations. APK/device acceptance testing remains pending; see ANDROID.md.

Applied migration 007 to keep rescheduling booking/sailing locks in the same order as cash collection and expiry.

Applied migration 008 to exclude cancelled/refund-pending check-ins from terminal dashboard counts. Verified successful hosted cron runs. Final verification: 74 unit tests, 24 backend/database tests, production build and Android sync passed; APK compilation/device tests remain blocked by the missing toolchain.

## Experience upgrade (2026-10-04)

Applied migration 009 in one transaction through the owner's configured management connection. Added travel_advisory, saved_traveler and passenger_no_show with RLS enabled and browser table access revoked. Existing core operations remain behind the same public RPC and trusted role checks. Hosted browsing and access-protection smoke checks passed after installation. No test accounts or bookings were created on the hosted project. See [experience guide](EXPERIENCE-UPGRADE.md) for UI changes and local verification.

## All-role existing-feature improvements (2026-10-04)

Applied migration 010 through the configured management connection. Account profile changes now update Auth identity and application contact/name details in one transaction, with trusted caller identity and unchanged role/email permissions. Installation edited no existing profiles. Hosted read-only browsing and access-protection smoke checks passed.

Integrated the Base44 light palette into the shared theme and linked Ionic palette selection to the user's Light/Dark/System preference. Added actual Admin personal/security settings, improved Ticketing/Boarding contact/security workflows and account navigation, and connected Admin booking search/status to the existing paginated server operation. Passenger profile, booking filters and existing ticket/notification flows are covered in [the all-role comparison](EXISTING-FEATURE-REVIEW.md).

## Workspace design and audit search (2026-10-05)

Applied migration 011 in one transaction after local database tests passed. Added the ADMIN-only audit-search dispatcher and action/time index, preserving the existing experience and atomic profile operations. Verified hosted unsigned access rejection and direct-table/private-function restrictions. No existing accounts or bookings were deleted.

The local frontend now includes shared role workspace styling, responsive passenger pages, and a dedicated Audit logs screen. Production assets have been synchronized into the Android project. See [workspace design upgrade](WORKSPACE-DESIGN-UPGRADE.md) for scope, checks, and screenshots. This change does not publish the frontend to a hosting provider or build a new APK.
