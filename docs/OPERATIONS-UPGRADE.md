# Operations upgrade

## Reservation deadlines

Default: **24 hours**, capped at the sailing departure. Admin → Operations & activity can change the deadline from 5 minutes to 7 days. Changes affect new reservations. Existing unpaid reservations received a 24-hour grace period from migration installation, capped at departure. Earlier rescheduling shortens the deadline if necessary; later rescheduling does not extend an existing deadline automatically.

Expired unpaid bookings become **EXPIRED**, release exactly their stored seat count, and notify the account holder. Supabase Cron checks every minute; secured API requests also process overdue reservations. Expired bookings cannot be paid or boarded. The job is `barkolink-expire-reservations`. See [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart).

## Vessel schedules

Database triggers reject overlapping active trips on the same vessel, including concurrent schedule submissions. Back-to-back trips are allowed by the current rule; operational turnaround time is not included. Historical schedules are preserved. Resolve existing overlapping schedules manually rather than deleting bookings.

## Cancelled sailings and refunds

Admin → Trips → status CANCELLED requires a reason. Active unpaid bookings are cancelled; paid bookings become **CANCELLED / REFUND_PENDING**. Seats are released and account holders receive notifications. Contact walk-in passengers directly. A trip with boarded passengers cannot be cancelled through this action.

Ticketing → filter Refund pending → Details: return the cash, enter a refund receipt/note and select **Confirm cash returned**. This records **REFUNDED** once; the application does not transfer money. Refunds pending remain in cash held; completed refunds are removed from net collected revenue. Reports separately show cash refunded and refunds pending. Ordinary passenger cancellation remains limited to unpaid reservations.

## Discount verification and pregnancy category

Ticketing must verify eligibility for each passenger whose stored fare is below the trip's regular fare before collecting payment. Check the supporting document, enter a short note such as `Student ID checked`, and select Verify discount. Do not copy full ID numbers or upload sensitive documents. The database records verifier and timestamp. Discounted walk-in tickets require the same confirmation before issuance.

**Pregnant** is an operator-configurable category, default **0%**. Configure it per vessel in Fares & discounts; only new trips use changed rates. Existing trips keep their saved fares. Pregnancy is not automatically treated as PWD, and discounts are not stacked. MARINA's published discount guidance names students, senior citizens and PWDs; no blanket pregnancy fare discount was verified. See [MARINA fare discount guidance](https://marina.gov.ph/2018/10/11/marina-reiterates-20-fare-discount-in-domestic-passenger-ships-2/).

## Records and updates

Ticketing has server-side status/search filters and 30-record pages. Admin lists also have pages; admin text/status/sailing filters currently apply to the selected page. Staff and passenger record screens refresh every 15 seconds while visible. Refresh pauses during relevant busy actions/scanning/editing. This uses the secured RPC rather than opening direct access to database tables.

Admin → Operations & activity shows changes to bookings, trip schedules/status, vessel/port activation, fares, discount verification and reservation settings. Expiry events have a dedicated system event. The audit table omits copied passenger/contact/Auth data.

## Manual tests

Continue with `docs/MANUAL-FLOW-TEST.md`, and verify Maria's student eligibility before recording her payment. Add these scenarios:

1. Admin configures a pregnancy discount of 10% for a test vessel. Create a new PHP 600 trip; a Pregnant passenger costs PHP 540. Verify eligibility before payment. At 0%, the fare is PHP 600 and no discounted-fare verification is required.
2. Create another overlapping trip with the same vessel: saving must fail. An adjacent trip should succeed.
3. For expiry testing, set the deadline to 5 minutes, create a new unpaid reservation, wait for its deadline and scheduler cycle, and refresh. Seats must return once. Restore the production deadline to 24 hours afterward. Do not shorten existing records through manual database updates.
4. Create a separate trip with one paid and one unpaid booking. Cancel it with a reason. Verify refund pending only for the paid booking, no valid manifest tickets, and restored seats. Record one cash refund; repeating the action must not refund twice.
5. Open passenger and ticketing in separate browser profiles. Create/cancel a reservation and confirm staff sees the new status within the refresh interval. Test more than 30 records on an isolated test dataset to check pagination.

## Deployment

Existing projects: apply migrations `005_operations_upgrade.sql` , `006_expiry_schedule.sql`, `007_reschedule_lock_order.sql` and `008_active_terminal_counts.sql` together inside a transaction, once. Do not re-run the initial setup. New projects can use regenerated `supabase/setup.sql`, which includes all eight migrations. The local PGlite database tests skip pg_cron installation when the extension is unavailable; hosted scheduling is verified separately.

Android preparation and remaining device checks are documented in `docs/ANDROID.md`.
