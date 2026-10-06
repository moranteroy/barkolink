# Passenger accounts and realistic workflow data

Updated 6 October 2026. The earlier TEST-labeled dataset has been replaced in the live Supabase project with realistic demonstration records. The names, prices, journeys and transactions remain synthetic; no actual fare was collected or refunded. Displayed records use normal passenger names, booking references, ports, vessel names and messages. The previous data was backed up in `.backups/before-test-reset-1791260161669.json` before replacement.

## Passenger logins

| Name | Email |
| --- | --- |
| Ana Santos | `ana.santos@example.com` |
| Miguel Reyes | `miguel.reyes@example.com` |
| Camille Dela Cruz | `camille.delacruz@example.com` |

The three new accounts use the shared password supplied by the owner in chat. The password is not stored in source or this guide. Each account is confirmed and has the Passenger role. Real sign-in and access to their own bookings and three saved travelers were verified: Ana has 19 bookings, Camille has 19, and Miguel has 18. The other existing passenger has 18 bookings; the remaining booking belongs to the existing walk-in user. Existing account passwords and profiles were preserved during the operational reset.

## Dataset

- 4 ports, 4 vessels, 5 routes and 6 accommodation classes, including inactive examples.
- 15 sailings, 75 bookings and 160 passenger records.
- Six previous months of completed trips and reservations, including different party sizes and passenger categories.
- Economy and premium classes, standard categories and a Resident discount.
- Issued, checked-in and boarded passengers; full and empty trips; pending, cancelled and expired reservations; refunds and no-shows.
- 12 saved travelers, 9 inbox notices, one internal broadcast history record, four advisories and audit history.

Passenger and saved-traveler phone numbers now use varied Philippine mobile formatting instead of zero placeholders. Birthdates vary by person and category: children are 3–11 at the relevant trip date, seniors are over 60, and student/adult examples have appropriate age ranges. These values are generated sample details, not verified contact information for actual people.

The ports shown are Batangas, Calapan and Puerto Galera, with routes in both directions and a Calapan South terminal marked inactive. The demonstration fleet is MV Isla Verde, MV Mindoro Voyager, MV Galera Express and the inactive MV Bay Breeze. Prices are demonstration values, not an approved operator tariff.

## Core workflow records

| Task | Reference / sailing | Steps |
| --- | --- | --- |
| Reserve a new trip | `TRP2026-1006006` | Browse the sailing, select Economy or Premium, choose saved travelers or enter passengers, review totals, then reserve. |
| Pay an unpaid reservation | `BK-610001` | Find it in Ticketing, collect a simulated cash payment once, then view the issued ticket and receipt. |
| Verify discounts before payment | `BK-610002` | Verify the six discounted passengers, including Resident, then collect payment. Premium surcharges are included in the total. |
| Cancel an unpaid reservation | `BK-610003` | Log in as its owner, Miguel Reyes, and cancel from My Bookings. Confirm that seats return. |
| Check in and board | `BK-610004`, sailing `TRP2026-1006001` | Review an issued ticket, check in, then board; repeated scans must not add another event. |
| Board a checked-in passenger | `BK-610005` | Board from the existing checked-in state. `BK-610006` shows an already-boarded example. |
| View a walk-in sale | `BK-610007` | Inspect the paid counter booking and ticket. Create a new sale through the Walk-in form to exercise that workflow. |
| Reschedule a delayed trip | `TRP2026-1006003`, booking `BK-610008` | Use Admin Trip operations to set a valid future schedule and inspect the booking afterward. |
| Check sold-out behavior | `TRP2026-1006004`, booking `BK-610009` | Its eight seats are reserved; the app must reject another reservation. |
| Record a refund | `BK-610010` | Record a simulated cash refund in Ticketing. `BK-610011` is already refunded. |
| View cancellation/expiry | `BK-610012` / `BK-610013` | Confirm separate history states and unavailable payment actions. |
| View completed/no-show history | `BK-610014` / `BK-610015` | Compare completed boarded passengers with two recorded no-shows. |
| Search and export all passengers | `TRP2026-1006005`, `BK-62001` through `BK-62012` | Its 36 paid passengers span two pages. Search must find later-page matches. Admin manifest export includes all 36. |
| Review history and charts | `TRP2026-1006010` through `TRP2026-1006015` | Choose a report range covering the previous six months. Each historic sailing has eight bookings with varied party sizes. |

References stay the same while dates are scheduled relative to the reset time. Near-term board/payment trips depart in two/six hours; pending reservations age normally and can expire. Use the sailing's displayed date/time rather than interpreting its identifier as its departure date. Testing consumes normal workflow states, so processed bookings will no longer be pending examples.

## Dashboard changes

Monthly bars, month labels and count rows now have separate allocated space. The legend sits above the plot, with monthly values also available in an expandable table. Booking/category charts use a donut plus a vertical list with aligned counts and consistent status colors. Route labels and counts sit above their bars. Cards switch to one column on tablet widths and preserve readable spacing on mobile.

## Maintainer verification

```powershell
node scripts/test-data-database.mjs inspect
node scripts/test-data-database.mjs verify-demo
node scripts/verify-dashboard-ui.mjs
npm.cmd run test:database
```

Live rollback checks covered 34 module reads and seven core transactional workflows, plus inbox read actions, without consuming the demonstration cases. User and operational fingerprints matched before/after those checks. Dashboard checks use actual live aggregate data with intercepted browser requests, at 1440, 1240, 1024, 768, 390 and 320px in both themes. The new passenger logins were separately checked against live Auth and owner-scoped RPCs.

The full database/account-function suite passed 52 tests. The production build, TypeScript, lint and whitespace checks passed for the dashboard revision. Desktop chart screenshots were visually inspected, and mobile layout bounds were checked automatically; see local ignored artifacts in `docs/screenshots/dashboard/`.

`scripts/demo-dataset.mjs generate` builds the realistic seed and integrity/workflow verification SQL from the regression fixtures. A future authorized reset requires a fresh backup followed by the reset helper's `apply-demo` mode with exact project confirmation. Do not run seed SQL directly against an occupied database. Physical printer, camera and Android checks remain separate device acceptance tasks.
