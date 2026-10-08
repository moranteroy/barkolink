# Automatic loyalty vouchers

Passengers earn personal vouchers through three tiers: Silver gives PHP 100 at five completed trips, Gold gives PHP 200 at ten, and Platinum gives PHP 300 at fifteen and every five trips afterward. Qualifying sailings must be paid and have at least one boarded passenger in their confirmed booking. Multiple bookings or passengers on the same sailing count once. Cancelled, unpaid and no-show bookings do not count. Staff walk-in accounts do not earn passenger rewards.

Rewards issue automatically when an administrator marks a sailing completed. The Home wallet and booking review also check historical eligibility. Each five-trip milestone issues once, with one notification; reloading or retrying does not create another reward. Every reward expires 90 days after issuance and is tied to its owner.

Booking review applies the earliest-expiring eligible reward automatically. Passengers can remove it or use a manual promo code. One voucher is allowed per booking and it discounts regular fares only. Booking totals and payment amounts use the same server-validated discount. As with existing promo codes, a reward is consumed when its reservation is created, including a subsequently cancelled or expired reservation.

Deploy migrations 027 and 028 after 026, or run `node scripts/loyalty-setup.mjs` using existing local Supabase management credentials. Migration 028 upgrades unused, unexpired loyalty vouchers to their tier amounts and notifies owners; codes and expiry dates stay the same. Booked discounts stay unchanged. The script also issues rewards earned by existing passengers. It is safe to rerun. Fresh setup includes these migrations in `supabase/setup.sql`.
