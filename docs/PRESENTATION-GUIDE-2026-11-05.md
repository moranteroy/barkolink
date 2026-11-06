# BarkoLink presentation guide

Prepared November 5, 2026, Philippine time. The records below are actual demo-account records, created through authorized application RPCs. All online payments were PayMongo **sandbox/test** payments.

## Open the correct local app

Use **http://localhost:8100** for the laptop demo. The configured PayMongo return origin is `http://localhost:8100`; its hosted checkout and authenticated merchant return were tested successfully on that origin.

From `C:\Users\Dell\Desktop\Barkolink\barkolink`:

```powershell
npm run dev -- --host 127.0.0.1 --port 8100 --strictPort
```

The server was left running at the end of the rehearsal. Start the command again if this computer/session has restarted. Internet is required for the configured Supabase backend, weather, AI and sandbox checkout.

Each browser profile uses one signed-in account. For a simultaneous four-role demonstration, use separate browser profiles. Otherwise sign out before changing roles. Do not attempt to sign four accounts into four ordinary tabs of the same profile; account/session isolation intentionally prevents that.

| Role      | Account                   | Name         | Port                    |
| --------- | ------------------------- | ------------ | ----------------------- |
| Admin     | roymorante@barkolink.com  | Roy Morante  | All authorized ports    |
| Ticketing | mariasantos@barkolink.com | Maria Santos | Calapan Port departures |
| Boarding  | johndoe@barkolink.com     | John Doe     | Calapan Port departures |
| Passenger | carlobiado@barkolink.com  | Carlo Biado  | Personal bookings       |

Use the shared demo password supplied in the conversation; it is not stored in this guide or audit receipts.

## Prepared records

All departure dates/times below are **Philippine time**. These records are time-bound; use fresh future sailings if presenting on a later date. Do not try to check in or board historical tickets.

| Purpose                                 | Booking reference         | Sailing         | Departure             | State after rehearsal                               |
| --------------------------------------- | ------------------------- | --------------- | --------------------- | --------------------------------------------------- |
| Completed cash and attendance rehearsal | BKG20261105-1793877527369 | TRP2026-1030396 | Nov 5, 2026, 11:00 PM | Cash paid, checked in, boarded                      |
| Ready ticket for presentation           | BKG20261105-1793877533051 | TRP2026-1031414 | Nov 6, 2026, 9:00 AM  | Paid by cash, issued ticket; not checked in/boarded |
| Unpaid payment-deadline example         | BKG20261105-1793877534033 | TRP2026-1031417 | Nov 6, 2026, 11:00 AM | Unpaid active reservation                           |
| Completed online sandbox rehearsal      | BKG20261105-1793877558280 | TRP2026-1031420 | Nov 6, 2026, 1:00 PM  | GCash test paid, staff verified, ticket issued      |

The configured reservation window is **24 hours**, capped at departure time. The unpaid example's deadline is therefore no later than **November 6, 2026, 11:00 AM**. These prepared examples do not extend ticket validity or bypass server rules.

## Suggested demonstration sequence

1. **Passenger:** sign in as Carlo. Show trip search, route/date/passenger count, fares and accommodations. Create a new reservation on a **Scheduled Calapan-origin departure** with enough time remaining. Enter complete passenger identity details. Review and confirm once. Show booking reference and payment deadline.
2. **Ticketing:** sign in as Maria. Find that reference under Bookings. Verify any discount eligibility if used. For the simplest demo, record cash payment and issue the ticket. For online payment, Carlo first completes the hosted PayMongo **test** checkout; Maria then verifies the received transaction before ticket issuance. The prepared online example already demonstrates the resulting paid/verified record; it cannot be charged again.
3. **Passenger:** return to Carlo's bookings and open the eligible ticket. Show the passenger name, departure and QR. A QR alone does not record attendance.
4. **Boarding:** sign in as John. Choose the **same sailing**, scan/enter the ticket and review the current record. Confirm **check-in** first. Confirm **boarding** only when that sailing is Boarding. If demonstrating a permitted boarding-time adjustment, record the reason; status automation follows the saved time. Do not change the departure just to make a ticket appear valid.
5. **Admin:** sign in as Roy. Open the same trip in Trip operations, then show Bookings, Passengers, attendance/Manifest, reports and Audit Logs. The completed rehearsal booking above can be used to demonstrate the already-boarded state and corresponding records.
6. Optionally repeat the completed rehearsal ticket's attendance action to explain duplicate rejection; do not promise a second successful check-in or boarding. Altered QR details are rejected against server records.

Reservations are accepted on **Scheduled** departures. Select and reserve before opening boarding; a trip already Boarding is not a valid new Passenger reservation target. For immediate demo boarding, adjust the selected trip's boarding time with a reason after reservation/payment, without moving departure or arrival.

## What was exercised successfully

- Actual Passenger reservation → Maria cash collection → issued QR → John verification/check-in/boarding → Roy's booking/passenger/manifest records.
- Altered QR rejection, boarding-before-check-in rejection and duplicate attendance rejection against the actual backend.
- Hosted PayMongo GCash test checkout → provider authorization → server-confirmed payment → Maria's online verification → issued ticket → authenticated Return to Merchant.
- Live passenger AI response with verified sources.
- Actual fresh ticket QR rendered in desktop/mobile browser UI and decoded back to Carlo's ticket details.
- All original unit and database suites, plus desktop/mobile four-role interaction and QR browser suites.

## Android/device scope

The web/responsive-browser presentation was exercised. Native Android APK/device behavior and a physical phone-camera scan have not been signed off: this machine's configured JDK path is missing and no Android SDK was configured. See `docs/ANDROID.md` for the existing APK workflow.

The current PayMongo callback is **laptop-local**. `localhost:8100` on a separate phone refers to the phone itself, so it is not a verified mobile payment-return configuration. For this presentation, demonstrate online sandbox checkout on the tested laptop origin; use the Android/mobile view for the independently verified features, and test the intended phone before claiming native payment-return support. Changing to a hosted callback requires an actual reachable deployment/origin and another return-flow rehearsal.

The prepared records support the dates above. For a presentation later than November 6, create fresh scheduled trips/bookings through the normal flow; expired dates are correctly retained as history.
