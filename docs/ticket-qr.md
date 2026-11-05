# Verified ticket QR

QR images and ticket exports encode a server-generated JSON payload with passenger name, departure date/time in Philippine time, vessel, route, booking reference, ticket code and a random per-ticket verification token. The browser renders this payload without constructing or replacing its fields. No birth date, phone number or address is included.

Only confirmed, paid, issued tickets receive a QR payload. Online payments also require staff verification. The raw verification-token column is excluded from record responses; the complete payload is available through existing authorized owner/staff ticket queries. Browser roles cannot access the table or private functions directly.

Both staff scanners call `VerifyTicketQr` on the server before showing a review. Verification requires a staff role, a real issued ticket, confirmed payment, the selected sailing, an active trip, and an exact match of all QR fields against current database values. Edited or invented QR payloads fail validation. Rescheduled tickets need a refreshed QR. Staff-entered codes and older UUID-only tickets remain supported with the same live payment/status checks.

Scanning does not check in or board a passenger. Staff reviews the verified name, vessel, date and payment, matches the passenger ID, then confirms the action. Existing transactional checks reject duplicate check-in or boarding. Repeat scans show the current boarded status without another boarding action.

An exact copy of a valid QR is still a copy of a valid ticket; visible details or verification tokens cannot prove who is holding it. Passenger ID checks and the server's one-time boarding state remain necessary. General-purpose QR apps can read the printed details but cannot approve a ticket or change payment/boarding records.

Apply migration 029 after 028, or run `node scripts/ticket-qr-setup.mjs`. Existing records receive random verification tokens, and passengers can refresh their e-ticket to obtain the new QR. Fresh installs include the migration in `supabase/setup.sql`.

## Travel history and one-time attendance (November 5, 2026)

Bookings and reservation details now display travel progress separately from payment history. A completed sailing displays **Trip completed**; a scheduled arrival that has passed displays **Travel period ended**. Past unverified payments remain recorded as received with verification incomplete and ticketing assistance guidance. Time passing never verifies a payment or records boarding.

Each passenger ticket displays **Ready for check-in**, **Checked in**, or **Used · Boarded**. Checked-in passengers retain their QR for the separate boarding step. Used tickets and closed travel periods remain viewable and printable/downloadable as transaction records, with the QR replaced by a record notice. Group bookings preserve separate eligibility for each passenger. Existing saved copies still require live server verification.

Migration `065_ticket_travel_window.sql` also rejects QR verification, check-in and boarding at or after the sailing's arrival timestamp, even if the sailing remains in BOARDING. The attendance mutation additionally checks staff verification for online payments. Existing booking/sailing/passenger locks, staff port restrictions and one-way ticket transitions remain in place. For delays or rescheduling, operators must update departure and arrival timestamps before reopening admission.

Use `node scripts/ticket-travel-window-setup.mjs` for read-only installation status, or add `--apply` to install. The helper checks the configured project, backs up the two function definitions under ignored `.backups/`, applies both changes in one transaction, and verifies fingerprints of trips, bookings, passengers, payments, events, rewards and notifications. It does not create boarding events or modify existing transaction rows.

Verification: 22 focused unit tests cover lifecycle, payment guidance, gate actions and exported records. Five database tests exercise the real secured attendance/QR RPCs, duplicate actions, stale boarding trips, payment verification and role denial. The historical owner-filtered read is tested directly through the existing private core because the full legacy read dispatcher hits a PGlite WASM signature error on this Windows runtime. Browser fixtures cover past unverified bookings, issued history, used tickets, checked-in tickets, group attendance, long voucher codes, and light/dark layouts at 320, 390 and 1440 pixels. These fixtures do not substitute for testing the installed APK on an Android device.
