# Experience upgrade

Implemented 4 October 2026 using `base44/base44.txt` as a workflow and design reference. Main BarkoLink remains Vue/Ionic with Supabase; the new workflows use persistent records rather than Base44 sample services.

## Passenger changes

- Home links to Saved travelers and Help & travel guide.
- Active global advisories appear on home and search. The booking flow also shows advisories for its selected sailing.
- Saved travelers are account-owned and can be added, edited, deleted and selected in passenger entry. Up to 20 travelers may be saved. Passenger fare category is deliberately selected for each booking rather than saved as an entitlement.
- Unpaid booking cards and details show time remaining until their stored payment deadline. Refreshing does not reset the countdown. At expiry the screen re-fetches the database status; the countdown does not create an inventory hold or release seats itself.
- Notifications show category filters, unread counts and Mark all read, scoped to the signed-in account.
- Search results support Modify search and All/Morning/Afternoon/Evening departure filters in Philippine time.
- E-tickets generate real QR codes locally using `qrcode`, compatible with the existing `jsqr` boarding decoder. Tickets no longer request QR images from an external service.
- Download ticket saves a standalone HTML document containing embedded QR images; open it offline or print it to PDF. Print / Save PDF uses the browser print dialog. Share uses native file sharing where supported and downloads a copy when unavailable. Staff still verifies the current database status; a downloaded copy is not proof that a later cancellation has been reversed.
- A help page explains the actual reservation, cash payment, discount verification, expiry, cancellation, refund and boarding behavior.

## Admin changes

- Travel advisories: create/edit drafts or published advisories with type, priority, audience and a Philippine-time effective period. Clear the publication checkbox to withdraw an advisory. Published advisories appear only while effective. Sailing-specific notices appear in that sailing's booking flow.
- Trip operations: choose a sailing or open Operations from a trip row. See reserved seats, availability, check-in, boarding and no-shows; browse bookings, passengers, terminal queues, manifest and activity. Manifest export uses the existing secured paginated export.
- No-show reconciliation: open a departed COMPLETED sailing, then No-shows → Reconcile no-shows. Confirm the count. Only confirmed, paid, non-boarded passengers with issued or checked-in tickets are recorded. Repeating the action does not create duplicate records. Attendance records preserve original ticket status and seat/fare history and cannot reopen boarding on a completed voyage. There is no reversal UI in this release.
- Trip tabs link to the existing check-in/boarding screens with the selected sailing filter. Schedule/status changes remain in Trips & schedules.
- Admin tables become labeled record cards on narrow screens, including action controls. Desktop tables remain available.
- The shared logo uses the ferry-and-wave vector mark from the supplied Base44 reference, with a gradient badge and BarkoLink wordmark. Existing Ionicons provide consistent icons throughout the app.

Admin text/status filters still apply to the current records page. Round-trip inventory, accommodation classes, reservation transfers, vehicles, promotions and online payments remain separate booking-model extensions from the comparison document; they are not included in this experience upgrade.

## Database

Migration `009_experience_upgrade.sql` creates `travel_advisory`, `saved_traveler` and `passenger_no_show`, their constraints/indexes, and a private experience dispatcher behind the existing `barkolink_execute` RPC. The previous operations dispatcher is retained. Identity and role checks use trusted Supabase account metadata. All new tables have RLS enabled and no direct browser grants. Advisory writes and no-show reconciliation produce audit events without copying passenger contact details into the log.

The configured owner's Supabase project received migration 009 in one transaction after local database tests passed. The migration preserves existing accounts, reservations, payments and boarding history. Do not apply it again to that project.

For another existing project with migrations 001–008 installed, apply migration 009 once in a transaction. For a new project, `supabase/setup.sql` contains all nine migrations. The management script supports `inspect-experience` and `upgrade-experience`; the latter checks for prior/partial installation before applying changes.

## Verification

- Production build, TypeScript checks, lint and 86 unit tests passed. Lint now recognizes deliberately unused API compatibility parameters prefixed with an underscore.
- 28 backend/database tests passed, including advisory role/period/scope checks, saved traveler ownership, bulk mark-read isolation and idempotent no-show reconciliation. Earlier booking, payment, cancellation, refund and boarding checks still pass.
- Desktop (1440px) and mobile (390px) browser checks use intercepted fixture data, with no hosted account or booking creation. They cover new screens, horizontal overflow, notification mark-read, real QR rendering, offline download and print visibility.
- Hosted public browsing, unauthenticated access rejection (including the new operations) and direct-table restrictions were checked after migration installation.
- The production assets were synchronized into the existing Android project with Capacitor.
- Screenshots are in `docs/screenshots/experience/`. To repeat browser checks, start Vite on port 8110 and run `node scripts/verify-experience-ui.mjs`.

Physical Android device and native print/share acceptance remain separate device checks. Browser verification does not establish physical-device behavior.
