# Automatic daily trips

Daily schedules now create actual, editable trips without a Prepare trip action. In Edit schedule, choose the vessel once for the operator and route, enter the daily departure times in Philippine time, and save. Only active vessels assigned to that operator and route are offered. Existing schedules retain their identities and need this one-time vessel assignment; the migration does not invent fleet rotations.

## Generation

- `051_automatic_daily_trips.sql` installs a private generator and an active database cron job, `barkolink-generate-daily-trips`, running every minute even when no app is open. Saving/resuming a schedule also generates immediately. The existing Admin refresh poll reloads the actual trips and schedule diagnostics without interrupting open editors.
- The rolling horizon includes today and the next six Philippine calendar dates. Past departures are skipped. Candidates from all schedules are processed chronologically so an incoming voyage can make the vessel available for a return.
- The saved route duration takes priority over a schedule fallback. The vessel's fare settings, passenger discount snapshot, capacity and confirmed operator boarding policy supply the actual trip fields. Missing duration, fares, boarding policy or vessel assignment are reported rather than guessed.
- Vessel port continuity, route eligibility, active ports/vessels and overlap checks remain database triggers. Failed departures do not abort valid candidates. Cards show up to ten blocked departures with their reasons. Administrators can inspect and edit created sailings under Actual trips, using the existing booked-trip restrictions.
- Stable schedule/date/original-time occurrence keys prevent retries from duplicating generated sailings. Editing a trip retains its original occurrence key; the generator does not undo edits or recreate cancelled occurrences. A matching existing manual trip is linked without replacing its saved fields. Migration 053 supersedes the original DLY prefix: daily and manual trips now use a shared sequence-backed TRP allocator, with stable occurrence keys retained for recurring-trip retries.
- Pausing prevents additional generation. Editing a template affects occurrences not yet created; already generated trips keep their saved fields and must be edited/cancelled under Actual trips. The UI states this explicitly.

The generator is not executable by anonymous or authenticated clients. Schedule reads/writes still require Admin through the secured dispatcher, and the existing Boarding-specific authorization remains unchanged. Normal non-daily operations retain their previous dispatch depth.

## Deployment and verification

`scripts/apply-daily-trip-automation.mjs` inspects metadata by default. Its explicit `--apply` mode backs up the dispatcher, installs the migration transactionally, verifies that existing operational/user rows are preserved, then verifies the cron job and function permissions. The connected project has the migration installed. A real unattended cron execution was observed as `succeeded`; both existing active Starlite schedules correctly reported their missing vessel assignment and created no speculative trips.

Verification includes the complete local database suite; eight generator regression cases covering connected trips, route/fare/boarding snapshots, reruns, edits/cancellations, wrong ports, missing prerequisites, manual-trip adoption and permissions; forty focused Admin/Daily schedule unit tests; production build and CSP checks. Browser fixtures exercised schedule diagnostics, vessel assignment save and actual-trip editing at 1366, 768, 390 and 320px in both themes. Desktop dark and mobile light screenshots were inspected. Browser writes used intercepted fixtures only.

Full lint retains the two existing `no-control-regex` findings in `src/data/securityValidation.ts`.
