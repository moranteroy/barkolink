# Vessel departure ports and Trips UI

Migration `050_enforce_schedule_vessel_ports.sql` closes the scheduling bypass where a vessel with a saved itinerary but no manual terminal observation could receive a disconnected departure. Both Create trip and Daily schedules → Prepare trip use the same sailing table trigger, including edits. The connected database has the replacement validation function installed; its prior definition was backed up locally and operational/user record fingerprints were unchanged.

- Later departures must match the vessel's expected port after preceding voyages, or its confirmed terminal observation. Underway and delayed preceding voyages block dependent departures.
- An initial voyage can establish an otherwise unknown itinerary. Inserting an earlier voyage must still connect to the following departure. Location estimates remain schedule based, not GPS or fabricated terminal confirmation.
- Valid return sailings remain allowed after the incoming voyage arrives. Booking availability guards remain in place.
- Removed “How automatic trip status works”, Port weather, and the duplicate Open port display header button from Trips & schedules. The sidebar shortcut remains.

Regression coverage: 14 vessel-tracking database tests, including schedule-only create/edit rejection, an earlier transfer connecting to a future voyage, and delayed-voyage rejection; 41 Admin/Daily schedule unit tests; successful production build and CSP checks. Browser fixture checks cover 1366, 768, 390 and 320px in both themes, Create/Prepare trip, automatic arrival, manual overrides and booked-trip edit restrictions. Desktop dark and mobile light screenshots were inspected. All preview writes were intercepted fixtures.

Full lint retains two existing `no-control-regex` errors in `src/data/securityValidation.ts`. Trusted fixture reset imports explicitly suspend and restore the sailing-chain trigger together with the existing booking guard; their synthetic disconnected test voyages are not normal scheduling operations. The database reset test verifies that the trigger is enabled after import.

The complete `npm run test:database` suite passed after updating the trusted fixture import.

`scripts/apply-vessel-port-validation.mjs` inspects metadata by default. Its explicit `--apply` mode backs up the old definition and transactionally installs the validation function, with an unchanged-record check. It does not rewrite existing trips or location observations.
