New booking references use `BKGYYYY-MMDD` followed by 12 random digits, for example `BKG2026-1011123456789012`. The date uses Asia/Manila. Online bookings and guest walk-in bookings share this generator. Reservation retries retain the original reference and idempotency behavior.

New promo and loyalty voucher codes use `VCH-` followed by 16 random uppercase letters and digits. Both generators exclude ambiguous I, O, 0 and 1 and require at least one letter and digit. The voucher form generates a code automatically and retains it after failed saves.

Existing booking references and voucher codes remain valid. Trip codes retain their existing `TRPYYYY-MMDDNNN` format. Official port, vessel and route codes, internal UUIDs, payment-provider references and QR verification tokens keep their existing formats.

Migration 037 only adds a private voucher generator and replaces the loyalty generator for future rewards. Apply with `node scripts/apply-record-codes.mjs --apply`; installation checks that all existing booking, voucher and passenger/QR records remain unchanged.
