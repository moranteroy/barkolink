# Verified ticket QR

QR images and ticket exports encode a server-generated JSON payload with passenger name, departure date/time in Philippine time, vessel, route, booking reference, ticket code and a random per-ticket verification token. The browser renders this payload without constructing or replacing its fields. No birth date, phone number or address is included.

Only confirmed, paid, issued tickets receive a QR payload. Online payments also require staff verification. The raw verification-token column is excluded from record responses; the complete payload is available through existing authorized owner/staff ticket queries. Browser roles cannot access the table or private functions directly.

Both staff scanners call `VerifyTicketQr` on the server before showing a review. Verification requires a staff role, a real issued ticket, confirmed payment, the selected sailing, an active trip, and an exact match of all QR fields against current database values. Edited or invented QR payloads fail validation. Rescheduled tickets need a refreshed QR. Staff-entered codes and older UUID-only tickets remain supported with the same live payment/status checks.

Scanning does not check in or board a passenger. Staff reviews the verified name, vessel, date and payment, matches the passenger ID, then confirms the action. Existing transactional checks reject duplicate check-in or boarding. Repeat scans show the current boarded status without another boarding action.

An exact copy of a valid QR is still a copy of a valid ticket; visible details or verification tokens cannot prove who is holding it. Passenger ID checks and the server's one-time boarding state remain necessary. General-purpose QR apps can read the printed details but cannot approve a ticket or change payment/boarding records.

Apply migration 029 after 028, or run `node scripts/ticket-qr-setup.mjs`. Existing records receive random verification tokens, and passengers can refresh their e-ticket to obtain the new QR. Fresh installs include the migration in `supabase/setup.sql`.
