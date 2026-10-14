# UI/UX upgrade — 14 October 2026

Implemented the recommendations from `UI-UX-REVIEW-2026-10-14.md` in the local application.

## Changes

- Shared Philippine-time display, input parsing and input conversion now keep admin departures, arrivals, boarding times and overnight trips independent of the device timezone. The trip editor and trip directory explicitly label Philippine time.
- Home places the active booking above secondary sailing/weather content, shows the amount paid/due and payment deadline, and distinguishes unpaid reservations from received payments awaiting verification. A paid passenger is never told to pay again merely because an e-ticket is not ready.
- Admin opens Actual trips by default. Daily schedules have their own view; the templates no longer push the actual trip list down the page.
- Passenger information has a compact route/date/amount summary, collapsible reminders and a sticky review action. Boarding explanations are shorter and Find ticket remains near the top.
- Shared typography tokens raise supporting text to 13px and labels to 14px. Grid text is 14px. All roles retain their existing Light/Dark palettes, shared buttons and minimum action heights. Small-screen admin actions wrap instead of overflowing.
- Admin port, vessel and trip forms have field-level errors, error associations and focus recovery. A preflight checklist explains missing route/vessel/fares/location/boarding setup. Setup links preserve the trip draft in per-account session storage and provide a return link; drafts expire after an hour.
- Full-directory search remains backed by the existing secured RPCs. Explicit global sort controls read all matching pages before sorting and paginating. Broadcasts load the complete existing history so searches and sorting include records beyond the original first page. Search/sort state is retained in the URL. Grid column controls explicitly identify their page-local scope.
- Shared readable status labels replace raw ticket/status codes. Operational port/vessel directories default to Active. Archived entries have a historical explanation and remain unavailable for new trips.
- Ticketing and Boarding show the last successful queue update, refreshing state and stale-record warning. Failed refreshes retain the last records for the same context. Processing actions are guarded while records are loading or stale.
- Port Display uses a monitor icon; the shared back arrow remains visible in the mobile staff header.
- Passenger web and mobile use the same centered compact layout, up to 560px wide. The desktop expansion was removed following the user's preference to retain the mobile-style web interface. Booking layout rules now respond to the passenger canvas width rather than the full browser viewport. Shared spacing, errors, tabs and typography live in `src/theme/experience.css`; the repeated staff-settings style blocks were consolidated.
- Admin fetches only the datasets required by the current module. Port/vessel lookups have a short per-account/client cache that invalidates after edits and explicit refresh. Operational panels, grids, weather picker and manifest export load on demand.

## Shared toast feedback

- A single `ToastHost` now provides consistent success, error and information notifications across passenger, staff, admin and account screens. Save/create/update/delete, reservation cancellation, payment verification, refund, walk-in issuance, discount verification and check-in/boarding handlers use the shared notifier.
- Notifications appear one at a time near the top, fit inside the compact passenger canvas, support Light/Dark themes and safe areas, and have a 44px dismiss button. Success expires after 4.5 seconds; errors after 8 seconds. Hover/focus pauses expiry, pending duplicates are suppressed, account changes clear the queue, and reduced-motion settings are respected.
- Local input validation remains inline. Persistent page errors and payment instructions remain available after a toast expires. Delete confirmation still happens before the mutation. The staff port notice uses the same shared toast; the unattended public port board retains its persistent connection warning.
- Added timer/queue/dismissal/text-safety tests and opt-in browser checks (`BARKOLINK_TOAST_CHECK=1`). Browser mutations use fixtures and never write to the hosted database.
- Toast browser checks passed for all four roles at 320, 390 and 1440px in Light/Dark (24 configurations). Passenger checks also verified required-field validation, successful save, failed-save input retention, dismissal and confirmed deletion.
- Final toast validation: all 316 unit tests passed across 63 files; production build/TypeScript and ESLint passed.

## Open-Meteo and weather card

- Replaced the deployed weather provider with Open-Meteo (Edge Function `weather`, Active version 6). Live read-only checks returned seven daily forecasts and 168 hourly readings for both Batangas and Calapan on 14 October 2026. The original WeatherAPI credentials were neither uploaded nor removed.
- Requests use verified port coordinates, Philippine dates and absolute hourly timestamps. WMO condition codes, daytime clear-sky icons, meters-to-km visibility, precipitation probability and missing measurements are normalized. Old-provider cache payloads are ignored; the existing 30-minute cache and six-hour stale fallback continue for Open-Meteo data.
- Added a shared weather card inspired by the supplied reference: sky gradient/glow, large temperature, condition and timestamp, rain/wind tiles, and secondary cloud cover/visibility. Passenger Home retains the seven-day strip; passenger trip details and admin's chosen trip use the same card. No fabricated air quality or sun-position measurements were added.
- Weather-card checks passed at 320, 390 and 1440px in Light/Dark for passenger Home/trip details and the admin trip picker. The provider's live data was checked separately from mocked UI flows. Documentation and setup/diagnostic scripts now point to Open-Meteo.
- Final validation: 320 tests passed across 63 files, production build/TypeScript and lint passed. The weather function was deployed; the web/mobile frontend was built locally and was not published to a hosting service.

## Earlier upgrade validation

- Weather-label review: passenger Home now shows the actual returned forecast length only after usable data arrives. Removed the misleading default `7-day outlook` and repeated short-forecast notice. Passenger trip details and admin trip weather use departure forecasts; staff screens have no multi-day forecast label.

- 313 unit tests passed across 62 files, including new overnight/timezone, received-payment guidance, reference-cache isolation/expiry, full-directory ordering, and broadcast-search coverage.
- All four workspaces passed the existing layout/theme/action checks at 390, 768 and 1440px in Light/Dark, covering 318 rendered configurations from the original route inventory.
- Additional focused checks passed at 320, 390 and 1440px in both themes: active archives, actual/template tabs, overseas-device Philippine departure time, awaiting-verification Home action and staff freshness indicators.
- After restoring the requested mobile-style passenger web layout, 102 passenger screen configurations passed at 320, 390 and 1440px in Light/Dark. Checks cover all 17 passenger routes, the 560px centered frame, bottom-navigation alignment, booking flow, no horizontal overflow and no captured page errors. The corrected source passed TypeScript checking and production build.
- The draft-return browser check passed: navigating from the trip editor to status setup and returning preserved the selected vessel and unsaved Philippine departure without creating a trip.
- Public search/help/privacy and protected-booking redirects passed at desktop and mobile widths. The old `/search` smoke-test expectation now recognizes the `/trips` redirect; logo checks await image decoding rather than relying on a fixed delay.
- Production build, TypeScript checking, ESLint and `git diff --check` passed against the final source after resuming from the brownout. `dist/index.html` was regenerated successfully.

Browser checks intercept all backend traffic with fixtures. This task makes no hosted database writes, sends no real notifications, collects no payments and does not deploy the application. Global ordering is opt-in and may need multiple read requests for a large matching dataset; ordinary searches keep server pagination. Shared dependency bundles still warrant measurement on production networks, and physical-device camera/printer behavior was not exercised here.
