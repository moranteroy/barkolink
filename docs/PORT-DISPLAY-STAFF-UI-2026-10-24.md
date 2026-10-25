# Port Display and staff headers — October 24, 2026

Port Display now follows the supplied terminal-board reference: navy background, large port identity and Philippine clock, teal departures and blue arrivals panels with direction icons, port descriptions and count pills. Empty boards center a ferry symbol, heading and explanatory text. A blue-accent passenger reminder/priority advisory banner anchors the bottom. The admin's existing integrated ferry seascape replaces the reference's silhouette header and stays clear of the clock.

Both board headings now use the ferry icon. The public header scales and lowers its artwork at shorter laptop/TV heights so the ferry's mast remains visible without adding height to the board. The correction passed the five empty-board viewport checks, targeted Vue lint and production build; the 1366×636 screenshot was visually reviewed.

The current Port Display-only placement follows the approved admin dashboard header: a larger blended ferry sits on the right, immediately before the clock. The terminal header reserves 112px height to fit the mast and sea; short-screen rows use 84px to preserve three-arrival capacity at 1366×636. Admin and the shared artwork component were not changed for this correction. Empty/populated TV/mobile checks, status contrast, rotation, stale recovery and kiosk controls pass; the 1366×636 screenshot was reviewed.

Ticketing, Boarding and their shared catalog pages reuse the same decorative ferry header beside their actions. Desktop pages with multiple actions reserve space for the artwork. Light mode and narrow screens subdue the image so text remains readable. The shared artwork component accepts a night presentation for the permanently dark public board, independently of the account theme.

All schedule fetching, port selection, Philippine date handling, row capacity, page rotation, boarding announcements, advisories, live/stale labels and kiosk/fullscreen controls remain in the existing workflow. A failed empty board explicitly says schedules are unavailable rather than reporting zero sailings as a successful result. All checks use isolated fixtures; no hosted records were modified.

## Verification

- 29 unit tests passed across terminal data/day boundaries, ticketing bookings and staff port access.
- Production build, TypeScript and postbuild security-header verification passed.
- Public browser checks passed against the production build: populated and empty TV/mobile layouts, all five status labels with at least 4.5:1 text contrast, matched row sizes, pagination/rotation, port selection, refresh, stale preservation/recovery, clipboard TV link, kiosk controls, fullscreen and CSP.
- Populated boards fit 1920×1080, 1366×768 and 1240×580 without TV scrolling. Sparse operational boards also fit 1366×636. Empty boards were checked at 1834×858, 1366×636, 1240×580, 390×844 and 320×740; mobile boards stack vertically.
- Staff fixtures checked four routes per role at 1440, 768, 390 and 320px in light/dark themes: 64 screenshots, successful artwork decoding and no main-content horizontal overflow. Boarding fixtures include the trip timing panel.
- Representative empty/populated terminal and staff dark desktop/light mobile screenshots were visually reviewed. Screenshots are local under `.audit/port-display/` and `.audit/staff-maritime/`.
- Changed Vue files pass targeted ESLint. Full project lint still has the two pre-existing `no-control-regex` findings in `src/data/securityValidation.ts`.

The maintained browser verifier is `scripts/verify-port-display-ui.mjs`; it now includes the reference's empty-board layouts. It serves the built app with production security headers and intercepts the public feed. The existing ferry artwork and original generation prompt are documented in `docs/MARITIME-UI-2026-10-24.md`.
