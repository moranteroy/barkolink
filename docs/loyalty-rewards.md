# Automatic loyalty vouchers

Passengers earn personal vouchers through three tiers: Silver gives PHP 100 at five completed trips, Gold gives PHP 200 at ten, and Platinum gives PHP 300 at fifteen and every five trips afterward. Qualifying sailings must be paid and have at least one boarded passenger in their confirmed booking. Multiple bookings or passengers on the same sailing count once. Cancelled, unpaid and no-show bookings do not count. Staff walk-in accounts do not earn passenger rewards.

Rewards issue automatically when an administrator marks a sailing completed. The Home wallet and booking review also check historical eligibility. Each five-trip milestone issues once, with one notification; reloading or retrying does not create another reward. Every reward expires 90 days after issuance and is tied to its owner.

Passengers copy a loyalty reward code from Home, enter it at booking review, and select **Apply**. Loyalty and promotional codes are never selected or applied automatically. One voucher is allowed per booking and it discounts regular fares only. Booking totals and payment amounts use the same server-validated discount. As with existing promo codes, a reward is consumed when its reservation is created, including a subsequently cancelled or expired reservation.

Deploy migrations 027 and 028 after 026, or run `node scripts/loyalty-setup.mjs` using existing local Supabase management credentials. Migration 028 upgrades unused, unexpired loyalty vouchers to their tier amounts and notifies owners; codes and expiry dates stay the same. Booked discounts stay unchanged. The script also issues rewards earned by existing passengers. It is safe to rerun. Fresh setup includes these migrations in `supabase/setup.sql`.

## Milestone usage labels — November 5, 2026

Silver, Gold, and Platinum now show **Claimed** after their reward is applied to a reservation. An earned, usable reward shows **Ready to use**; expired, paused, and future-valid rewards are distinguished instead of being inferred as consumed. Rewards are earned/issued automatically, but using a reward requires entering its code and selecting Apply. There is no extra claim button for loyalty rewards.

Migration `063_loyalty_milestone_usage.sql` adds owner-scoped usage counts to `MyLoyalty`, without changing bookings, voucher values, expiry, issuance, or consumption rules. Used vouchers remain consumed after their reservation is cancelled/expired, matching the existing booking rules. Rewards are identified by their issuance number, so identical amounts or changed milestone settings cannot confuse Silver/Gold/Platinum. Repeated Platinum rewards are grouped: an available reward keeps **Ready to use** visible alongside the previous claimed count.

`node scripts/apply-loyalty-milestone-usage.mjs` inspects metadata. Its explicit `--apply` mode backs up the existing response function, installs only migration 063 transactionally, and compares booking/voucher fingerprints before committing. Verification calls only the read-only helper, not `MyLoyalty`, so it does not issue real rewards during deployment checks.

Focused verification: six component tests and five isolated PostgreSQL regressions passed, covering real usage relationships, cancelled reservations, recurring Platinum, equal reward amounts, expired/paused/future rewards, ownership, and private helper access. Lint and production build/CSP passed. The broader local database suite encountered a PGlite WebAssembly signature/memory error; the same first reservation failure was reproduced with migration 063 excluded. That run is not counted as a passing full-suite check.

Responsive fixtures passed 72 passenger page/viewport/theme combinations; representative 320 px dark and 1440 px light loyalty cards were visually inspected. Migration 063 was applied to the connected project on November 5, 2026. Transactional booking/voucher fingerprint checks passed, and post-deployment verification confirmed the response extension, private helper access, and three milestone summaries per passenger. Deployment backups and receipts remain in ignored `.backups/`. No hosted test bookings, rewards, or notifications were created by verification.

## Manual application and concise screens — November 5, 2026

Booking summary no longer calls `QuoteLoyaltyVoucher`, fills a reward code automatically, or adds a discount without the passenger choosing Apply. Editing the code or changing the fare context clears the previous quote; confirming with an unapplied code still requires Apply or removal. Promo claims remain explicit on the voucher page. Repeated booking/footer instructions were removed from booking summary, loyalty cards, and the admin voucher form. Migration 064 updates future reward-notification wording without changing existing notifications, issuing rewards, or consuming vouchers.

Validation passed 12 manual-voucher browser scenarios (full-fare without a code, invalid code, manual promo/loyalty Apply, Remove, and reservation payload), 29 affected component tests, six isolated database tests, 36 passenger page/viewport/theme checks, and 28 representative Admin/Ticketing/Boarding checks. Migration 064 was applied to the connected project with a function backup and unchanged booking/voucher/notification fingerprints. No existing notifications were rewritten.
