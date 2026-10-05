# BarkoLink and Base44 comparison

Reviewed: 4 October 2026. Main application: `barkolink/`. Reference: `base44/base44.txt`.

This document records the comparison before implementation. The subsequent completed changes and deployment are documented in [Experience upgrade](EXPERIENCE-UPGRADE.md).

## Findings

The main BarkoLink application should remain the implementation base. It uses Vue 3, TypeScript, Ionic, Capacitor and Supabase. Its SQL migrations implement persistent bookings, server-calculated fares, transactional seat changes, trusted account roles, payments, check-in, boarding, cancellation, refund records and reservation expiry.

The Base44 folder contains one concatenated source export, rather than an independently runnable project. Its React pages offer useful interface and workflow ideas. However, the inspected booking and operations pages use `mockServices.js` and `mockData.js`. Updates generally live in browser memory; dashboard and analytics values come from sample data. A Base44 SDK client and authentication code exist, but that does not make these operational workflows persistent.

This review inspected source files and migrations. It did not run either application in a browser or verify the currently deployed database. Recommendations below describe proposed changes, not completed features. No application code or hosted data was changed.

## Feature comparison

| Area | Main BarkoLink | Base44 reference | Recommended improvement |
| --- | --- | --- | --- |
| Accounts and roles | Supabase accounts, router access checks and trusted server roles | Auth scaffolding plus a development role context stored in localStorage | Keep main account architecture; translate UI ideas into Vue |
| Booking flow | Sailing, passengers, review and reservation; account-scoped draft and retry handling | Separate accommodation, passenger, payment and review pages | Improve guidance and summaries without adding unnecessary checkout steps |
| Reservation expiry | Database payment deadline, expiry processing and seat release; deadline text in passenger records | Simulated countdown starting from 600 seconds | Display time remaining from the stored `paymentDeadline`; re-fetch authoritative status at expiry |
| Trip management | Admin sailing tables, editing, rescheduling, status changes and sailing-booking lookup | Trip Operations page with header, six metrics, tabs, activity and disruption dialogs | Add a dedicated sailing operations view backed by real per-sailing records |
| Travel advisories | Booking and trip notifications; no dedicated advisory publishing workflow found | Advisory cards with type, priority, route and effective dates; incomplete create flow | Add persistent admin publishing and route-aware passenger advisory display |
| Notifications | Owner-scoped records and individual mark-read actions | Category filters and Mark all read | Add category filters, unread counts and a secured bulk mark-read operation |
| Check-in and boarding | Persistent ticket states, QR scanning and server validation | Mock check-in and boarding mutations | Keep main validation; borrow summary layout and action feedback |
| No-shows | No explicit no-show state/workflow found in active source and migrations | Individual and bulk mock no-show marking | Add a post-departure reconciliation workflow with audit history |
| E-tickets | Paid booking tickets with encoded QR images and manual ticket codes | Passenger ticket layout with visual QR placeholders; inactive Share/Download buttons | Add print/download/share behavior using actual issued tickets |
| Saved passengers | Booking-session drafts; no reusable saved passenger directory found | Sample saved passengers can prefill booking forms | Add account-owned saved travelers with explicit save/delete controls |
| Accommodation | Vessel capacity and passenger-category fares; no accommodation inventory found | Class selection cards and admin accommodation list; mock inventory | Add only when the operator actually sells different classes; implement class-specific capacity and fare snapshots |
| Round trip | Single-sailing booking model | Outbound/return selection in booking context and search | Build linked legs with transactional capacity checks; selection UI alone is insufficient |
| Rebooking | Admin can reschedule a sailing; passenger reservation transfer is a separate missing workflow | Mock rebooking only changes status and activity text | Define eligibility and fare differences, then implement transactional transfer and ticket replacement |
| Reports and analytics | Live RPC reports, date/route/vessel filters, collection trends, utilization, categories, refunds and CSV export | Separate Reports and Analytics pages using sample statistics | Improve presentation of existing main reports instead of duplicating dashboards |
| Audit logs | Paginated Operations & activity panel | Dedicated sample Audit Logs page | Add human-readable actions and server-side actor/action/date filters |
| Search | Route/date/passenger inputs, departure ordering and empty state | Inline Modify Search and morning/afternoon filters | Add quick search changes and Manila-time departure filters |
| Mobile records | Admin tables use horizontal scrolling | Shared AdminTable renders stacked cards on mobile | Adapt mobile cards with visible row labels and primary actions |
| Help and policies | Privacy notice and contextual ticketing guidance | FAQ accordion, help categories and policy page; support contact is demo-only | Add guidance matching actual BarkoLink behavior and verified operator contacts |
| Payments and promos | Cash collection and server-calculated passenger fares | Cash selection; GCash/Maya/card disabled; hard-coded BARKO100 and fees | Treat online payment and promo support as separate backend projects, not features ready to copy |

## Recommended order

### First: improvements using existing records

1. Make admin records easier to use on mobile through labeled cards. Keep desktop tables.
2. Add passenger notification categories, unread counts and Mark all read. Use owner checks for every update; report partial failures accurately.
3. Show a payment countdown for existing unpaid reservations, driven by the stored deadline. Searching and completing a draft must not claim that seats are held before a reservation exists. Refreshing a page must not reset the deadline.
4. Add search modification in the results screen and morning/afternoon filters using Asia/Manila.
5. Add print and share actions for paid e-tickets. Preserve ticket codes and existing server validation. Generating QR images locally would also reduce dependence on the current external image endpoint.
6. Add help content for reservation payment, expiry, discount verification, check-in, boarding and cash refunds. Do not copy sample fees, support hours or operator rules from Base44.

### Next: ferry operations

1. Build a sailing operations page showing capacity, reserved seats, paid passengers, checked-in passengers and boarded passengers. Keep these distinct: reserved seats include unpaid bookings, while valid boarding tickets require payment. Link bookings, passengers, check-in, boarding, manifest and activity to the selected sailing.
2. Add advisories with persisted type, priority, message, audience, optional route/sailing scope, publication state and effective period. Passenger search, trip details and home should display applicable active advisories. Publishing requires ADMIN server checks and an audit entry.
3. Add no-show reconciliation after the relevant boarding cutoff or departure. Count only eligible paid passengers who were not boarded. A bulk action must scope to one sailing, recheck eligibility in the transaction, exclude boarded/cancelled tickets and be safe to repeat. Decide reversal rules and reporting treatment before implementing the state transition.
4. Improve disruption dialogs with actual affected booking/passenger totals, reasons and instructions. Main BarkoLink already handles cancellation/refund consequences and notifications; build on those operations.
5. Move admin text/status/sailing filtering to server queries before pagination. Current main admin filters apply to the loaded page, so a matching record on another page can be missed. Keep totals consistent with the same filters.

### Later: booking-model extensions

- Saved travelers: account ownership, minimal retained fields, edit/delete support and booking-time fare eligibility checks. Do not retain full identity-document numbers just because the prototype requests them.
- Accommodation classes: vessel-specific class capacity, server-calculated prices, saved booking fare/class snapshots, and class-aware cancellation/expiry seat restoration. Total class capacity must respect vessel capacity.
- Round trips: linked outbound and return reservations, atomic capacity checks across both legs, deterministic locking and defined expiry/cancellation/refund rules.
- Rebooking: available destination sailing, eligibility checks, old/new seat changes in one transaction, fare difference handling, invalidation of superseded ticket codes and audit events.
- Vehicle booking: separate vehicle/deck inventory and pricing; passenger seat inventory alone is insufficient.
- Online payments and promotions: provider integration and server-verified payment events; promo validation and limits enforced server-side. Imported package dependencies do not establish a working payment integration.

## Reference implementation pitfalls

- `RoleContext.jsx` explicitly describes a development-only role context. A browser-selected role must never grant permissions in BarkoLink.
- `mockServices.js` creates bookings with a client-supplied total and mutates an in-memory store. Preserve main server fare calculations and database transactions.
- `MockQRCode.jsx` explicitly draws a visual placeholder with no actual encoding. Use the main issued ticket code and an actual QR encoder.
- `ReservationTimer.jsx` simulates a frontend-only hold. It is a layout reference, not evidence of reserved inventory.
- `TripOperations.jsx` includes placeholder tabs; cancellation impact numbers are hard-coded, and the delay dialog inputs are not passed into the status mutation.
- `NoShows.jsx` initially filters out rows whose status is BOARDED, but its bulk handler checks only whether loaded rows are already NO-SHOW. The service mutation does not recheck current boarding eligibility, so a stale list can overwrite a later boarding update. Use transactional server checks.
- `ETicket.jsx` displays share/download buttons without handlers. `Accommodation.jsx` and `NotificationsAdmin.jsx` also contain controls without a working mutation.
- `bookingService.rebook` does not transfer capacity or change the actual sailing; it changes a status and adds text.
- `advisoryService.create` returns a new object without adding it to the list used by `advisoryService.list`.
- `Payment.jsx` disables online payment methods and hard-codes a promo and a per-passenger fee. These do not represent an operator-approved pricing policy.

## Source map

Main application:

- `src/router/index.ts`: routes and role access checks.
- `src/views/admin/AdminWorkspacePage.vue`: navigation, management tables, trip editing and page-local filtering.
- `src/components/admin/AdminReportsPanel.vue`, `src/data/reportAnalytics.ts`: reports, trends and exports.
- `src/components/admin/OperationsPanel.vue`, `src/services/database/operations.ts`: activity, deadlines, discount verification and refunds.
- `src/views/passenger/BookingFlowPage.vue`: passenger details, draft state and reservation confirmation.
- `src/views/passenger/PassengerRecordsPage.vue`: booking status, payment deadlines, e-tickets and notifications.
- `src/views/passenger/SearchPage.vue`, `src/components/passenger/TripSearchCard.vue`: sailing search.
- `src/views/staff/boarding/StaffBoardingPage.vue`: terminal scanning and boarding.
- `supabase/migrations/001_schema.sql`, `002_operations.sql`, `005_operations_upgrade.sql` through `008_active_terminal_counts.sql`: persistence and operational rules.
- `docs/OPERATIONS-UPGRADE.md`: intended deployed operations and known pagination limits.

Base44 concatenated export, using its embedded file headings:

- Line 211: `src > components > admin > AdminTable.jsx`.
- Line 604: `src > components > passenger > ReservationTimer.jsx`.
- Line 3246: `src > components > ui > MockQRCode.jsx`.
- Line 6068: `src > lib > BookingContext.jsx`.
- Line 6397: `src > lib > mockServices.js`.
- Line 6689: `src > lib > RoleContext.jsx`.
- Line 6787: `src > pages > admin > Advisories.jsx`.
- Line 7554: `src > pages > admin > NoShows.jsx`.
- Line 7929: `src > pages > admin > TripOperations.jsx`.
- Line 8540: `src > pages > passenger > BookingDetails.jsx`.
- Line 8841: `src > pages > passenger > ETicket.jsx`.
- Line 8938: `src > pages > passenger > Help.jsx`.
- Line 9239: `src > pages > passenger > Notifications.jsx`.
- Line 9318: `src > pages > passenger > Passengers.jsx`.
- Line 9471: `src > pages > passenger > Payment.jsx`.
- Line 9817: `src > pages > passenger > SearchResults.jsx`.

## Validation for implementation

UI changes should pass the production build and focused unit checks where behavior changes. Database additions should extend the existing local PGlite integration tests to cover account/role isolation, transaction rollback, concurrent capacity changes and repeat submissions. Check passenger and staff flows on narrow screens and the Android wrapper. Apply database migrations to the hosted project only as a separate deployment task; this review did not apply migrations.
