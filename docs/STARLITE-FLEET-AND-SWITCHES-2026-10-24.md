# Starlite fleet cleanup and activation switches

The owner explicitly approved permanently deleting non-Starlite vessels and their linked trips, bookings, passengers and payment records after reviewing the dependency counts. The connected database cleanup completed on October 24, 2026.

## Retained fleet

Exactly five active vessels remain:

- MV Starlite Annapolis — 712 passengers
- MV Starlite Jupiter — 307 passengers
- MV Starlite Pacific — 350 passengers
- MV Starlite Sprint 1 — 182 passengers
- MV SWM Stella del Mar — 977 passengers

Removed 21 non-Starlite vessels, 67 trips, 746 bookings, 2,233 booked passenger/ticket records and four online-payment database records. Linked attendance, no-shows, trip-specific notices/campaigns/advisories, vessel-route assignments, vessel accommodation/fare/location records and non-Starlite schedule/status configuration were cleaned up as applicable. Existing audit history remains, with a new fleet-cleanup audit entry. No payment-provider refund/cancellation calls were made.

The transaction verified complete row hashes for retained Starlite and unrelated records, including user accounts. The five vessels' 10 trips, 120 bookings and 300 booked passenger records remain unchanged. A separate live read confirmed the final five-vessel list.

Verified backup: `.backups/before-starlite-only-1792822309843.json`. SHA-256: `3adb083b000799a40633f9021fb071542727d35aa948f06af0b95e9c6954ebe7`. This backup contains private operational data and is intentionally ignored by Git. Completion receipt: `.audit/starlite-only-cleanup.json`.

The reviewed cleanup implementation is in `scripts/retain-starlite-fleet.mjs` and `scripts/starlite-cleanup-sql.mjs`. The default command previews counts; `--apply` is destructive and requires the owner's explicit approval of any affected linked history. It aborts if the reviewed five-vessel identity differs, the snapshot changed after backup, or a retained record changes. Do not use it as an automatic startup/seed task.

## Activation switches

Shared light/dark toggle styling now covers nine control definitions: passenger discount activation, active ports/vessels/routes, accommodation availability, daily-schedule activation, advisory publication, automatic boarding and automatic completion.

They use native checked inputs with switch semantics, preserving Vue models, label activation, keyboard interaction, fieldset disabling and existing save behavior. Focus, disabled states, reduced motion and forced colors are supported. Terms consent, verification acknowledgments and password-visibility checkboxes retain their distinct behavior. Existing MFA controls were already switches.

## Verification

Passenger discounts now follow the supplied card reference: editable name, active/inactive badge, inset percentage, native activation switch, pencil action that focuses/selects the name, delete icon and full-width dashed add button. Narrow screens place percentage above controls and retain 44px action targets. Existing validation, vessel drafts and explicit save behavior remain intact. The 28 fare tests pass; isolated browser fixtures verify edit focus, keyboard toggling, add/delete and overflow in light/dark desktop/mobile layouts. Screenshots are in `.audit/discount-cards/`. Full lint still reports two pre-existing `no-control-regex` errors in `src/data/securityValidation.ts`; changed files pass targeted lint.

- Three isolated database cleanup tests passed: deletion of the linked paid-record graph, protection of Starlite/accounts, rejection of an unexpected retained fleet and rollback on unrelated changes.
- Fifty-four relevant UI unit tests passed across fares, accommodations, routes, daily schedules, communication and settings.
- Production build and postbuild security-header check passed. Changed Vue files and cleanup helpers passed ESLint; existing unrelated project-wide findings were not changed.
- Source scan found nine switch definitions and no remaining unconverted activation checkboxes. Browser fixtures checked light/dark desktop/mobile switch dimensions, keyboard changes, disabled fieldsets and page overflow. Screenshots remain local in `.audit/switches/`.
