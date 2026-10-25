# Editable accommodation allocations by vessel

The current six active Starlite vessels have Economy, Tourist Class and Business Class records. Initial application allocations use approximately 70/20/10: Tourist and Business are rounded down to whole seats and Economy receives the remainder. These are editable application defaults, not sourced physical class capacities. New classes start with zero extra fare; saved descriptions, prices, class IDs and booking references remain intact.

Migration 054 completes vessels missing one or more of these classes. It skips complete catalogs so reruns preserve later admin edits. It refuses allocations below existing reservations or alongside other active classes. `node scripts/prepare-vessel-accommodations.mjs` inspects the live catalog; `--apply` creates a backup, locks and checks the source snapshot, applies the migration transactionally, and verifies that bookings, passengers, payments, trips and vessels remain unchanged inside the transaction. The receipt is `.audit/vessel-accommodation-allocation.json`.

Admin Accommodation now groups classes under each vessel with class capacity, extra fare and Edit actions. The header shows the total allocated active capacity. Search, vessel/status filters and sorting apply to these cards. The full RecordsGrid remains available under “View detailed class directory.” Existing capacity limits and reserved-seat protection still apply to edits.

Checks: focused accommodation component tests and isolated migration tests; browser fixtures cover both themes at 1440, 768, 700, 699, 390 and 320px, vessel filtering, correct-record edits, rejected over-allocation and the detailed grid. Browser writes are intercepted fixtures only.
