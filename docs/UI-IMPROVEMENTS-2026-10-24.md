# UI improvements — October 24, 2026

Implemented the shared-table improvements and focused role UI fixes from the [UI audit](UI-UX-AUDIT-2026-10-24.md).

## Changes

- Removed the table-help disclosure and its styles from the shared `RecordsGrid`. All nine consuming view/panel implementations inherit the removal. Source search found no remaining table-help UI.
- Replaced the bulky count badge/help area with a compact count and page scope. Active column filters have a direct clear action.
- Keep the same grid model mounted when switching to mobile cards. Filtering, sorting and column visibility now survive desktop/tablet/mobile changes; cards use the same filtered/sorted result set. Mobile sort, columns, reset and row actions remain usable. Preferences persist for the mounted table, not across a full reload or navigation that destroys it.
- Added explicit numeric/date column types for applicable Admin, staff, audit, accommodation, broadcast and report fields. Numeric filters use raw values; date filters use Philippine calendar days even when the browser timezone is elsewhere.
- Improved mobile card identity hierarchy, action grouping, sort control and narrow-screen sizing, including 320px. Archived/refunded fallback grid badges use a neutral tone.
- Show complete booking routes through wrapping rather than desktop ellipsis. Audit pagination now shows the loaded record range.
- Label report export scope explicitly: report dates/route/vessel/search apply; grid-local column filters and order do not change the report CSV.
- Missing payment-method metadata now displays `Not recorded` rather than inferring that a paid record has not been paid.
- Saved travelers now has linked field-specific validation, invalid-field focus recovery, retained input after a failed save, and list-load retry without a false empty-list message.
- Boarding operation instructions are collapsed by default, bringing the passenger queue closer to the top. The selected sailing, freshness, Find ticket action and detailed instructions remain available.
- Removed a nested main landmark in Ticketing and unused Admin view imports.

The larger audit backlog remains separate: backend ordering/search scalability, full saved views across navigation, a broad desktop passenger redesign and comprehensive shared status-tone migration are not implemented in this pass.

## Verification

- Full existing unit suite: **67 files / 357 tests passed** during implementation.
- After the final role changes, focused tests: **5 files / 26 tests passed**, including **3 new saved-traveler recovery tests**.
- Real-grid browser regression: `node scripts/verify-records-grid-ui.mjs` passed in light and dark themes. It covers numeric thresholds, Philippine-day date filters in an overseas timezone, state at 1440/768/700/699/390/320px, empty results, column controls, mobile sorting/reset, row actions and replacing the loaded page. The standalone fixture makes no backend requests.
- Production build and postbuild CSP/security-header check passed. Existing dependency CSS warnings and large-chunk warnings remain.
- Final role capture: **236 configurations** across Admin, Passenger, Ticketing and Boarding at 1440/390px in light/dark; **0 navigation/render failures, page/AG Grid errors, visible alerts or overflowing visible main elements**. Representative desktop/mobile screenshots were visually inspected. This smoke pass does not exercise every workflow interaction.
- ESLint passed for every changed application/test file and the new browser check. Full-project lint still reports two pre-existing `no-control-regex` findings in `src/data/securityValidation.ts` at lines 1 and 7; the file matches the original Git version.
- Role screenshots and observations are stored locally under `.audit/ui-polish-20261024/`; standalone grid evidence is under `.audit/records-grid-ui/`. Generated artifacts use isolated fixtures and are ignored by Git.

No hosted booking, payment, notification, schema, or account data was changed. These checks do not certify a physical Android camera, receipt printer, production network performance or full accessibility compliance.
