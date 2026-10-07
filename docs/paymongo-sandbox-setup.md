# Activate PayMongo sandbox payments

The code supports cash and PayMongo **test payments** through GCash, Maya and cards. No live payments are enabled. A secret starting with `sk_live_` is rejected. The website never receives the PayMongo secret key.

## 1. Get test credentials

Create an account at https://dashboard.paymongo.com and follow the dashboard's verification requirements. Open Settings / Developers / API Keys and copy the **Secret Test Key** (`sk_test_...`). Payment method availability depends on your account; enable GCash, Maya and cards as supported. Do not put this key in chat, Git, or any `VITE_*` setting.

Official guides: [Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start), [Test payments](https://docs.paymongo.com/docs/payment-acceptance-testing), [Webhook signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).

## 2. Apply the database migration

For an existing BarkoLink Supabase database without the payment integration, run `supabase/migrations/019_paymongo_test_payments.sql`, followed by `020_booking_payment_details.sql`, in the Supabase SQL Editor. If migration 019 is already installed, apply only 020 to show the verified GCash, Maya or card method in staff and admin bookings. Do not rerun the full setup script on an existing database. Then apply `021_staff_online_payment_verification.sql` to require ticketing staff approval before online e-tickets are issued. Previously issued tickets remain valid. The consolidated `supabase/setup.sql` includes all three migrations for a fresh install.

## 3. Configure and deploy the Edge Function

If Codex is helping with setup, place your Secret Test Key in the Git-ignored `.env.paymongo.local` file as `PAYMONGO_SECRET_KEY=sk_test_...` and set `PAYMONGO_RETURN_ORIGIN` to your website origin. Leave the webhook secret empty until registration. This file is local setup input only; creating it does not automatically configure Supabase. Its values still need to be uploaded to Edge Function secrets. The Public Test Key is not needed for this backend-hosted checkout integration.

From the `barkolink` folder, with the Supabase CLI installed:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy paymongo
```

In Supabase Dashboard → Edge Functions → Secrets, set:

| Secret | Value |
| --- | --- |
| `PAYMONGO_SECRET_KEY` | Your `sk_test_...` key |
| `PAYMONGO_RETURN_ORIGIN` | Your website origin, e.g. `https://your-barkolink.vercel.app` |
| `PAYMONGO_WEBHOOK_SECRET` | The signing secret from step 4 |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase to the hosted function. Do not copy them into frontend environment variables. For a local browser demo, the return origin can be `http://localhost:5173` if that is where Vite is running. Use the exact port from your dev server.

## 4. Register the webhook

In PayMongo's test-mode webhook settings, add:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paymongo
```

Subscribe to `checkout_session.payment.paid`. Copy that webhook's signing secret into `PAYMONGO_WEBHOOK_SECRET` in Supabase. The function verifies the timestamped test-mode HMAC signature and independently retrieves the checkout from PayMongo before recording a payment. It rejects live payments, wrong amounts and wrong currencies. The authenticated **Check payment** button also retrieves the provider status if webhook delivery is delayed.

## 5. Demo the flow

1. Sign in as a passenger and reserve a future sailing using a regular passenger fare.
2. On the reservation confirmation, My Bookings or booking details, choose **Continue to payment**.
3. Choose GCash, Maya or card on PayMongo's checkout and use the provider's official test flow. Use only sandbox card details from the test documentation.
4. Return to My Bookings. The app checks the payment with the backend; the webhook also confirms it independently. Payment receipt is recorded as `PAID`, but passenger tickets remain `PENDING`. The passenger sees **Awaiting staff verification**.
5. Sign in as ticketing staff, open **Bookings**, review the booking's amount, payment method and transaction ID, then choose **Verify online payment and issue tickets**. Tickets become `ISSUED`, and the passenger can open the e-ticket with the normal **PAID** label. The backend is still in sandbox mode and no real money has moved.

Also test failed payments, cancelled checkout, repeat button clicks and an expired reservation. A return URL alone never marks a booking paid. Failed payments leave it unpaid. **Close checkout / pay cash** expires the provider checkout before cash collection is allowed. Closing the browser or returning through the cancellation URL alone does not close the provider checkout.

Discounted passengers must be verified by ticketing staff before online payment. An open checkout must be closed before changing the fare or sailing. A late test payment for a cancelled/expired reservation is recorded for review without restoring seats or issuing tickets. Sandbox refunds must never result in a cash payout; the database blocks recording a cash refund for these test payments.

## Limits and troubleshooting

- Until credentials, migration and function deployment are complete, the online button cannot complete a payment; it displays an error and keeps the booking unpaid. Cash bookings remain available.
- PayMongo checkouts do not automatically expire at BarkoLink's deadline. The backend prevents issuing tickets for late payments. For this sandbox version, close unused checkout sessions using the payment panel or PayMongo dashboard. Automated provider-side cleanup and live refund processing are not enabled.
- `PayMongo sandbox is not configured`: set the Secret Test Key in Supabase Edge Function secrets.
- `PayMongo could not process...`: check test credentials and enabled methods in the provider dashboard.
- `Checkout setup is incomplete`: retry **Pay online** for the same booking to recover the session using its stable idempotency key, then close it if switching to cash.
- A checkout that has been closed cannot be reopened for the same booking; pay cash or create a new reservation.
- Webhook 401: check the endpoint signing secret and test mode. Webhook errors require retry delivery from the dashboard.
- On Android, hosted checkout returns to the configured website origin. Returning directly into the native app requires a separate deep-link setup.

This is a sandbox integration. Validate actual end-to-end checkout and webhook delivery with your PayMongo account before presenting it. Use separate demo data: test payments use the existing booking/report status fields and therefore appear in operational totals, distinguished by `PAYMONGO_TEST`.

## Setup and test commands in this workspace

With the Git-ignored `.env.paymongo.local`, `.env.local` and `.env.supabase-management` files configured:

```powershell
node scripts/paymongo-sandbox.mjs inspect
node scripts/paymongo-sandbox.mjs install
npm run dev -- --host 127.0.0.1 --port 8100 --strictPort
```

In another terminal, run `node scripts/paymongo-sandbox.mjs test`. The test creates temporary passenger and staff accounts, a separate future sailing and synthetic reservations, completes simulated GCash authorization, checks signed webhook delivery, confirms tickets are withheld before staff verification, approves with the staff account, verifies the local e-ticket, and checks failed payment/checkout closure. It removes its own database records and Auth accounts afterward. Screenshots are stored under the Git-ignored `.audit/paymongo/` directory. The browser test requires Microsoft Edge and uses `http://localhost:8100`.

The install command validates the test key, applies missing payment migrations 019–021, creates/reuses the test webhook, saves its signing secret locally, uploads the three payment secrets and deploys only the PayMongo Edge Function. It does not reset existing data or publish the frontend website.

## Staff verification flow

Online checkout records payment receipt first. The passenger sees **Awaiting staff verification** and cannot open or export an e-ticket yet. In **Staff ? Ticketing ? Bookings**, open the booking details, review the amount, method and transaction ID, then select **Verify online payment and issue tickets**. The server restricts approval to ticketing staff and administrators, records the verifier and timestamp, and issues tickets once. Do not collect cash for an online payment awaiting verification. Cash collection still issues tickets immediately.

For an existing payment integration, run `node scripts/paymongo-sandbox.mjs upgrade-verification` once to install migration 021.

## Duplicate reservations

Migration `022_prevent_duplicate_reservations.sql` prevents another active booking for the same account, sailing and complete passenger details, including already paid bookings. Passenger order, name capitalization and extra spaces do not create a new reservation. Cancelled or expired reservations do not block a replacement. Retrying the same booking reference remains safe. Duplicate submissions display the existing reference and a link to booking details.

Run `node scripts/paymongo-sandbox.mjs upgrade-duplicates` to install this protection in an existing database. `node scripts/test-duplicate-reservations.mjs` checks concurrent requests against an isolated temporary account and sailing, verifies that only one seat is consumed, and removes its test records afterward.

## Ticketing payment queue

The ticketing dashboard shows **Payments requiring action**, including unpaid reservations and online payments awaiting staff verification. Online approvals appear first. The **Awaiting verification** count tracks pending online approvals. In Bookings, select **Awaiting staff verification** to show payments requiring approval. For an existing database, install migration 023 with `node scripts/paymongo-sandbox.mjs upgrade-queue`.
