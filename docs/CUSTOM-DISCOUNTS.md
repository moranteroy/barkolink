# Custom vessel discounts

In **Admin → Fares & discounts**, select a vessel, choose **Add discount**, enter a name and a whole-number percentage from 0 to 99, then save. Existing Student, Senior, Child, PWD and Pregnant discounts are editable rows in the same collection as additional discounts. Administrators can rename, change the percentage, activate, deactivate or delete any row. Each vessel supports up to 20 passenger discounts. Names must be unique; Regular remains the base fare.

The preview shows the resulting whole-peso passenger fare, with a minimum of PHP 1. An inactive discount stays in the configuration but is excluded from new trips. Deleting a row takes effect when the administrator saves.

New trips offer Regular plus only the active saved passenger discounts. An empty collection means regular fare only. New trips snapshot active discount names, percentages and prices. Updating, renaming, removing or deactivating a vessel discount does not change existing trips or reservations. Editing an unbooked trip's base fare recalculates its saved custom percentages; changing its vessel takes the replacement vessel's current discounts.

Passenger booking and ticketing walk-ins offer the discounts saved on the selected trip. The database calculates fares and accommodation surcharges, rejects unavailable discount names and requires staff eligibility verification before collecting a discounted payment. Custom names remain readable in passenger records, tickets, reports and audit changes.

Migration `016_custom_discounts.sql` introduced additional discounts. Migration `017_editable_passenger_discounts.sql` combines existing categories and additional discounts into an authoritative editable collection, adds complete trip fare snapshots, and rejects removed categories on new trips. Existing trip and booking records retain their saved categories and fares; the former percentage columns support older clients. `setup.sql` includes the migration for new installations. The hosted schema was upgraded without creating test discounts or bookings. Existing vessel rates were migrated into editable rows.

Validation: unit tests for editor behavior, vessel drafts, validation and fare lookup; isolated PostgreSQL tests for permissions, atomic saves, trip snapshots, booking/payment verification, walk-ins, accommodation totals, idempotency and identically named vessels. Browser checks use intercepted Supabase requests at 1440, 768 and 390 pixels:

```powershell
$env:BARKOLINK_UI_ROLE='ADMIN'
$env:BARKOLINK_UI_PATHS='/admin/fares'
node scripts/verify-experience-ui.mjs
node scripts/verify-custom-discounts-ui.mjs
```

The scripts use a running development server at port 8110 by default; override `BARKOLINK_UI_URL` when necessary.
