# Vessel and class capacity review — October 24, 2026

The normal admin workflow correctly rejects 50 Economy + 30 Tourist + 30 Business on a 100-seat vessel. There is no equal-split requirement: 50 + 30 + 20 is valid. Class allocations may temporarily total less than vessel capacity while the administrator configures the remaining classes.

The accommodation form subtracts other active classes, excluding the record being edited, from the selected vessel's capacity. It displays that remaining allocation and rejects an oversized active class before saving (`src/components/admin/AccommodationPanel.vue`). The database repeats this check while holding a per-vessel advisory lock in the original accommodation dispatcher, now named `execute_accommodation_v21` after migration 022. Inactive classes do not consume active allocation, but activating them rechecks the full limit. The database also blocks reducing a class below seats already reserved on an individual sailing.

The initial review found vessel capacity disabled in the admin edit form. The follow-up now enables that field and explains its existing backend rules. A valid edit is submitted through AdminUpdateVessel and the directory reloads after saving. Server rejections remain visible inside the dialog and preserve the entered capacity. Vessel codes remain read-only.

Migration 012's existing `accommodation_vessel_capacity` trigger rejects a vessel reduction below its active class allocations, including a direct AdminUpdateVessel API request. The original vessel operation also rejects capacity changes while active sailings exist. No database rule or live capacity was changed by enabling the form.

Read-only inspection of the connected project found no overallocated Starlite vessels:

| Vessel         | Capacity | Active allocation | Unallocated |
| -------------- | -------: | ----------------: | ----------: |
| Annapolis      |      712 |               534 |         178 |
| Jupiter        |      307 |               231 |          76 |
| Pacific        |      350 |               263 |          87 |
| Sprint 1       |      182 |               137 |          45 |
| Stella del Mar |      977 |               733 |         244 |

The unallocated seats reflect the prior removal of unused Premium Economy classes; they have not been automatically reassigned to Tourist or Business. Capacity allocations should follow the vessel's actual seating arrangements.

Initial allocation verification: 36 focused unit tests and four isolated database tests passed. Follow-up editor checks cover saving an edited capacity and retaining server rejections. Five isolated database tests now also prove that a safe capacity change succeeds without active sailings and is rejected while a sailing is active. Browser fixtures exercise desktop/mobile light/dark editor layouts, saving and the refreshed table, fixed vessel code, and readable server rejection without losing input. Targeted ESLint passes. Live inspection remains read-only; the capacity edits performed during verification use isolated fixtures.

The follow-up admin suite passes all 31 tests. Four browser combinations pass against the production preview (1440/390px, light/dark); screenshots are in `.audit/vessel-capacity/`. The production build and security headers pass. A concurrent development-cache collision encountered during testing is addressed in [Vite cache isolation](VITE-CACHE-ISOLATION.md).
