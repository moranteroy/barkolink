# Codebase map

Paths are relative to the application root. Recheck paths and current dependencies when using this map.

## Shared design and navigation

| Concern | Files |
| --- | --- |
| Routes, redirects, role guards | `src/router/index.ts`, `src/data/sessionRole.ts` |
| CSS load order | `src/main.ts` |
| Light/dark tokens and base styles | `src/theme/variables.css`, `src/theme/ui.css`, `src/composables/useTheme.ts` |
| Workspaces, density, actions | `src/theme/workspace.css`, `workspace-density.css`, `actions.css`, `catalog.css`, `experience.css` |
| Components | `src/components/ui/`, `src/components/shared/` |
| Tables and pagination | `RecordsGrid.vue`, `TableControls.vue`, `WorkspacePagination.vue` under shared components; `src/composables/tableRecords.ts` |
| Feedback and validation | `src/composables/fieldErrors.ts`, `confirmation.ts`, `toast.ts`; shared `ToastHost.vue`, `QueueFreshness.vue` |
| Status/date/payment semantics | `src/data/statusPresentation.ts`, `statusOrder.ts`, `philippineTime.ts`, `travelDate.ts`, `paymentVerification.ts`, `ticketActions.ts` |
| Backend adapters | `src/services/database/`, `src/services/session.ts`, `src/composables/staffPortGate.ts` |

## Role surfaces

| Role | Entry points and UI responsibilities |
| --- | --- |
| Passenger | `src/views/passenger/`: Home, Search, BookingFlow, PassengerRecords, Travelers, Profile, Help, Assistant. BookingFlow serves multiple routes; PassengerRecords serves bookings/details/tickets/notifications. Components in `src/components/passenger/`; header and bottom nav own shared navigation. |
| Admin | `src/views/admin/AdminWorkspacePage.vue` serves many directory and form branches. `src/data/adminNavigation.ts` and `src/components/admin/AdminSidebar.vue` define navigation. Dedicated panels in `src/components/admin/` cover overview/reports, schedules, routes, accommodation, operations, vouchers, audit, broadcasts/inbox, no-shows, vessel tracking, staff port assignments. |
| Ticketing | `src/views/staff/ticketing/TicketingPage.vue` serves dashboard and bookings; `TicketingWalkInPage.vue` serves counter sales. `src/views/staff/StaffCatalogPage.vue` serves passenger/trip/fare reference screens. Payment review and refunds remain in the existing workflow. |
| Boarding | `src/views/staff/boarding/StaffBoardingPage.vue` serves dashboard/check-in/boarding/manifest; StaffCatalog serves active trips and no-shows. Ticket lookup has camera and manual entry paths. Preserve selected-sailing context and port gates. |
| Shared settings | `src/views/shared/SettingsPage.vue` for Passenger/Admin; `StaffSettingsPage.vue` for staff. Shared appearance and MFA components have their own state. |
| Public/auth | `src/views/auth/` for landing/sign-in/register/recovery/MFA/privacy; `src/views/public/PortDisplayPage.vue` for the terminal TV board. Port display has kiosk/fullscreen/paging and delayed-update states. |

## Existing checks

- `tests/unit/` includes table ordering, pagination, directory ordering, status ordering, role access, payment/booking/ticket actions, settings and panel behavior.
- `tests/support/recordsGridStub.ts` substitutes a table for parent component tests. It does not verify the actual AG Grid UI.
- `scripts/verify-experience-ui.mjs`, `verify-workspace-density.mjs`, `verify-ui-consistency.mjs` cover shared UI with browser fixtures. Many focused scripts exist for settings, payment, booking navigation, reports, notifications, maps and public screens.
- Existing visual scripts commonly use `playwright-core` with headless Edge and a local Vite URL. Some inspect `.env.local` for the project origin to intercept requests; never print tokens or environment values in reports.
- `.audit/` and generated screenshots are ignored. Keep maintainable audit conclusions in `docs/` and reusable skill source in `skills/`.

## Previously repaired findings

As of the October 24 source review, Home already prioritizes the upcoming booking and shared payment guidance; staff queues expose freshness; actual trips and daily schedules have separate views; booking passenger entry has compact context and sticky actions; statuses have a shared readable-label helper; staff settings no longer has the old three-style-block issue. Verify these before calling them defects. Global ordering and broadcast search currently collect all pages in the client, which creates a scalability concern rather than proving missing global search.
