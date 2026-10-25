# Create and prepare trip — October 24, 2026

The shared trip editor now presents route/vessel and departure/arrival as the primary sections. The repeated setup checklist was removed and the trip-code banner is compact. Saved routes are the first choice; manual port selection remains available through a disclosure. The footer displays regular fare and boarding timing beside the save actions. Boarding overrides and fare breakdown are expandable, and the form exposes boarding inputs when there is no applicable operator default. Existing setup links preserve the draft.

Create trip and Prepare trip have distinct titles. Preparing a daily departure fills the route, departure and calculated arrival; the operator chooses an eligible vessel. Existing booking, fare, vessel-location, status and confirmation rules remain in place. The scrolling form retains a fixed header/footer. Tablet layouts use one main column so datetime controls have enough room to show their complete values; mobile controls retain the existing single-column form.

## Arrival calculation

The saved route duration is authoritative when configured. A daily schedule's duration supplies the fallback when the route has no duration. This applies to selecting a saved route, choosing its ports manually and preparing a daily departure. Daily cards show an estimated arrival using the same duration precedence.

New trips default to automatic arrival. For example, a 20:00 departure and 120-minute route produce 22:00 on the same date; a 23:30 departure produces 01:30 the next day. Arrival updates when departure or route changes. Turning off Automatic arrival permits a confirmed manual arrival and preserves it when departure changes. Routes without a duration expose a manual arrival field. Clearing a selected route also clears its ports and automatic arrival.

Existing trips open with their saved arrival preserved and automatic mode off; operators can explicitly enable calculation. Drafts retain their automatic/manual choice and prepared-duration fallback. The new `routeArrivalInput` helper parses and formats Philippine wall times explicitly. Daily arrival labels convert that value back to a Philippine instant before display, avoiding a device-timezone shift. Saved payloads continue to use UTC timestamps and a duration in minutes.

## Verification

- 45 focused unit tests pass: admin trip/fare flows, daily schedules and Philippine time helpers. They cover 20:00 → 22:00, overnight/month/year rollover, manual overrides, route clearing, route-versus-daily duration precedence and fallback.
- Actual browser fixtures pass at 1366, 768, 390 and 320px in both themes, using an overseas browser timezone. They exercise Create and Prepare, route changes, midnight arrivals, manual overrides, saved UTC payloads and opening an existing booked trip without changing its stored arrival or unlocking protected fields.
- Desktop dark, tablet prepared-trip and narrow light mobile screenshots were visually reviewed. Screenshots are under `.audit/trip-modal/`.
- Changed Vue/TypeScript files pass ESLint. Full lint retains two existing `no-control-regex` errors in `src/data/securityValidation.ts`. The browser verification script's changed heading is validated with Node's syntax check.
- Type checking, production build and postbuild security-header checks pass.

Browser saves use isolated backend fixtures on the existing local development server. No hosted trips, routes, fare settings or operator policies were changed.
