# Admin and staff table improvements — October 24, 2026

The follow-up review applies the booking directory's readable column sizing and compact controls to the other Admin, Ticketing and Boarding directories. Existing actions, access gates, server pagination and eligibility checks are retained.

## Changes

- Admin passenger records, sailings, check-in, boarding and manifest tables have explicit column widths and proportional sizing. Passenger and ticket references wrap without hiding their complete values. Passenger status remains visible alongside the other columns at a 1366px desktop viewport; narrower desktop layouts scroll inside the grid.
- Global ordering for users, sailings and passenger directories is in the search/status filter panel. Reset filters also clears ordering. Column sorting remains limited to the loaded server page, as before.
- Accommodation, routes, audit activity, broadcast history and no-show tables give descriptive columns more space. Accommodation descriptions and broadcast messages initially show 90 characters with a keyboard-accessible Read more / Show less button; sorting and filtering still use the full text.
- The shared grid wraps column headings and measures their height. Cell content has an explicit available width so long text can wrap within its column.
- Ticketing passenger and sailing directories have column-specific minimum widths and proportions. Boarding's native sailing and manifest tables, plus Admin Trip Operations, use bounded column layouts and wrap long names/references. Their existing mobile cards remain available; horizontal scrolling stays within the table container.

Daily schedules and advisories use cards rather than AG Grid and did not need these column changes. Voucher and staff port assignment tables already retain usable layouts and actions.

## Verification

- 82 existing unit tests pass across admin fares/workspace, accommodations, routes, communication, audit logs, no-shows, reports, ticketing bookings, staff port access and trip operations.
- The standalone actual AG Grid check passes in both themes: typed filters, Philippine dates, sorting, column visibility, mobile actions, reset, changed data and state retention through 768, 700, 699, 390 and 320px.
- The booking directory regression check passes at 1366, 1440, 768, 699, 700, 390 and 320px in both themes, including full references, details/focus return, global ordering, reset and two server pages.
- All 150 directory views pass: 17 Admin, four Ticketing and four Boarding routes at 1366, 768 and 390px in both themes. Isolated, populated backend fixtures include long references, names, voucher codes and messages. No page horizontal overflow, clipped cell/header content or load alerts were detected. Desktop/tablet tables and mobile pages were visually reviewed. Screenshots and observations are kept locally in `.audit/directory-review/`.
- Targeted ESLint passes for the changed components. Full lint retains two pre-existing `no-control-regex` errors in `src/data/securityValidation.ts`.
- Type checking, the production build and postbuild security header verification pass.

Browser checks make no live data changes. They cover responsive browser layouts, not a physical tablet, scanner or terminal display. Daily schedules have an empty fixture; their populated layout was reviewed in source. Detailed report columns retain internal horizontal scrolling because the reports intentionally expose more fields than a desktop can fit at once.
