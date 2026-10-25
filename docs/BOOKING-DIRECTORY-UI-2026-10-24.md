# Admin booking directory UI — October 24, 2026

The booking directory now brings search, status and global ordering into one filter panel. The redundant standalone sorting explanation and Records eyebrow were removed on this page. Its heading is slightly shorter and the records header displays the matching total while the grid toolbar identifies the loaded page count. Reset filters also clears the global ordering selection.

The five booking columns have explicit minimum widths and proportional sizing. References wrap instead of truncating, routes retain room for port names and Philippine departure times, and passenger/amount columns avoid taking equal space from descriptive columns. Savings appear as a short amount below Total. Long voucher codes are available in the read-only details dialog instead of expanding table rows. The action column offers View for every row; Cancel retains the existing unpaid pending/confirmed eligibility and confirmation behavior.

View shows the complete reference, account, route, departure, vessel, passenger count, total, booking/payment states, payment method and voucher. Modal focus returns to the row's View button, including when AG Grid recreates its cell renderer. The dialog scrolls on small screens and its footer remains reachable. Mobile filters put search above status/order fields and preserve the grid's existing mobile records.

All changes are scoped to Admin Bookings and its details dialog. Shared grid behavior and other directories are unchanged. At tablet widths, table columns can scroll inside the grid to retain readable minimum widths; the View action remains pinned and the page itself does not overflow.

## Verification

- 29 admin unit tests pass, including a new behavior test for full references, voucher disclosure and cancellation eligibility.
- Actual AG Grid fixture checks pass at 1366, 1440, 768, 699, 700, 390 and 320px in both themes: long references, 38 matching bookings across two server pages, global amount ordering, empty search/reset, modal details, focus return and no page/dialog horizontal overflow.
- Final mobile checks cover the compact filters and reachable dialog footer after scrolling.
- Desktop dark table, mobile dark page and narrow light details screenshots were visually reviewed. Local screenshots: `.audit/booking-directory/`.
- Changed Vue/test files pass targeted ESLint. Full lint retains the two existing `no-control-regex` errors in `src/data/securityValidation.ts`.
- Type checking, production build and postbuild security header verification pass. Browser previews use isolated fixtures and perform no live booking changes.
