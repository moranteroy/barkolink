# Starlite fleet rotation

The earlier daily generator assigned every departure on a route to one vessel. With twelve departures in each direction and different vessels fixed to opposing routes, each vessel reached the other port and then could not serve its next departure. Migration `052_daily_fleet_rotation.sql` adds automatic fleet assignment alongside the existing fixed-vessel option.

## Scheduling and UI

- Fleet mode considers active vessels serving the same operator and route, tries the least-loaded vessels first, and retains the database's port-continuity, overlap, next-trip and capacity protections. A failed candidate does not block another eligible vessel from being tried. The existing seven-day horizon, one-minute cron, occurrence keys and editable trip restrictions remain in place.
- Matching existing manual departures are considered before new allocations. Existing generated/manual trip fields are preserved. Edited/cancelled recurring occurrences are not recreated.
- Daily schedule cards show `Automatic rotation (6 vessels)` instead of presenting one ship as responsible for every departure. The editor defaults new schedules to Automatic fleet rotation and retains Fixed vessel for dedicated services. A blocked departure can disclose each candidate vessel's reason.
- An initial voyage still establishes an unknown itinerary's starting port, following the existing schedule-based tracking rule. No terminal observation or GPS confirmation is fabricated for a new reference vessel.

## Sixth vessel and rollout

Added MV Starlite Saga, code `SL-SAGA`, capacity 300. The [MARINA release dated April 2, 2026](https://marina.gov.ph/2026/04/02/good-news-marina-issues-special-permit-to-m-v-starlite-saga-for-batangas-calapan-route/) documents a special permit issued April 1 for Batangas–Calapan and its reverse, with that capacity. Metadata explicitly preserves the dated special-permit scope and does not assert a current regular-service permit.

At the user's request the vessel is active in the application's fleet, linked to the two active routes. Its application fare settings were copied from the saved Starlite Pacific settings, and its initial application accommodation allocation is Economy, 300 seats. These settings are editable application configuration, not claims about published Saga fares or actual cabin layouts.

`scripts/apply-starlite-fleet-rotation.mjs` defaults to metadata inspection. `--preview` runs the migration and operational rollout in a transaction that is rolled back; `--apply` commits only if there are six active vessels, no blocked Starlite departures, and existing operational rows are preserved. Definitions and operational snapshots are backed up locally. The script does not rerun the nationwide reference seed.

The connected project now uses fleet mode for both existing Starlite schedules. The rollout created 144 new trips; 73 future trips per direction were present after accounting for matching existing trips. Live verification found all six vessels used, zero blocked departures, zero overlaps, zero wrong departure ports and 24 generated trips on the next Philippine calendar date. The unattended cron run succeeded afterward.

## Verification

The complete database suite passed, including eleven daily-generation tests: six-vessel rotation with 24 daily departures, valid port chains, no overlaps, manual-trip preservation, fixed-vessel behavior, missing prerequisites, cancellations, retries and permissions. Forty-one focused Admin/Daily schedule unit tests and the production build/CSP checks passed. Browser fixtures covered desktop, tablet and mobile (1366, 768, 390, 320px), both themes, fleet assignment, diagnostics, save and actual-trip editing. Successful fleet cards and editor screenshots were inspected.

The historical demonstration status test isolates its deliberately disconnected imported itineraries inside a rolled-back transaction; vessel-chain validation remains enabled in production and independently covered by the rotation/tracking tests. Full lint retains two existing `no-control-regex` findings in `src/data/securityValidation.ts`.
