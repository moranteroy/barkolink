# UX improvements: first implementation batch

The later implementation batch is documented in [RELEASE-READINESS.md](RELEASE-READINESS.md), which supersedes the remaining-scope entries below.

Implemented locally on 6 October 2026 against the [original audit](UI-UX-AUDIT.md). The audit records the original observations; it is not a claim that every finding has been resolved.

| Audit finding | Implemented behavior | Remaining scope |
| --- | --- | --- |
| 1 | Walk-in receipt and descendants are visible in print mode; action buttons are omitted. | Actual terminal printer, paper size and Android printing need verification. |
| 2 | Reka payment dialog traps keyboard focus, supports Escape and restores trigger focus. | Screen-reader and physical touch-device checks. |
| 3 | Header search on the current Bookings page updates the local filter, resets pagination and reaches the debounced server query. | Other admin directories still need filters across the full dataset (finding 7). |
| 4 | Every populated sailing card displays its departure date and Philippine-time context. | Grouping multi-day search results. |
| 5 | Passenger information inherits light/dark surfaces and text; native controls and autofill follow the theme. | Broader visual review across all booking states. |
| 6 | Confirmation, booking cards and booking details display the saved booking total; details show the accommodation fee included in that amount. | Per-passenger fare breakdown and fuller payment/refund wording. |
| 8 | Search clocks/dates, reservation dates/times and walk-in schedules explicitly use Asia/Manila. Delayed sailing status is preserved. | Home and other date-input defaults need a full formatting consolidation. |
| 9 | Active admin navigation and manifest export use a darker blue with approximately 5:1 white-text contrast. | All interactive states and themes need a full contrast sweep. |
| 10 | Bookings, booking details and notifications distinguish initial loading, failed loading with Retry and successful empty states. Existing records stay visible during refresh. | Home, Routes and notification campaign loading states. |
| 11 | Booking and walk-in birth dates reject impossible dates and future birthdays using the Philippine calendar. Passenger date input has a maximum date. | Field-level name/contact validation and error associations. |
| 28 | Booking status filters use ordinary pressed buttons instead of incomplete tab semantics. | Route titles and entering-page focus. |
| 32 | Copy only reports success after a successful clipboard write and explains manual copying on failure. Ticket/notification progress labels use clear ellipses. | Refund cash-return wording and wider enum/microcopy review. |

The walk-in form also precedes its fare summary on mobile, so staff reach the sailing and passenger inputs sooner.

## Validation

- Existing unit suite: 20 files, 111 tests passed. New travel-date suite: 2 tests passed, including Philippine midnight, leap days and future birthdays.
- ESLint and TypeScript checks passed. Production build passed with existing Ionic CSS and large-bundle warnings.
- Isolated browser regression checks passed at 1440, 768 and 390 pixels, using a Los Angeles browser timezone. Covered same-page admin search, saved totals, Philippine departure time, theme changes, clipboard denial, payment-dialog focus/Tab/Escape/restoration and receipt print visibility.
- Additional mobile checks passed for loading, service failure and successful Retry. The generated print screenshot was visually inspected and contains the receipt.
- All browser backend traffic was intercepted with synthetic records. These checks did not validate real payments, hosted database mutations, email delivery, printer hardware or Android behavior.

Run the affected browser checks from the project root with the local Vite server on port 8110:

```powershell
$env:BARKOLINK_UI_PATHS='/admin/bookings,/staff/ticketing/walk-in,/bookings,/search,/passenger-info,/booking-confirmed'
node scripts/verify-experience-ui.mjs
```

The original audit roadmap remains the backlog for larger changes, particularly full-dataset admin filtering, walk-in retry/recovery, boarding task placement, report categories, navigation structure and shared form/draft handling. Operator contact details and operational policy must come from the operator; they have not been invented.
