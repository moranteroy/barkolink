# BarkoLink AG Grid guide

## Current contract

`src/components/shared/RecordsGrid.vue` is the shared boundary. The project declares AG Grid Community and its Vue adapter `^36.2.0`; inspect locally installed package versions/types before changing an API. There is no Enterprise dependency.

Callers pass `title`, `columns`, and `RecordGridRow[]` plus optional density, action width, column widths/flex, maximum height, and display-only column indices. Each row has a stable `key`, display `cells`, optional raw `sortValues`, its original `source`, and optional `statusIndex`. Preserve `#cell` and `#actions` slots, the `ready` event, and exposed APIs unless the task explicitly changes this interface and all callers are migrated.

Current consumers include AdminWorkspace, StaffCatalog, Accommodation, Routes, Reports, AuditLogs, NoShows, Notifications, and StaffPortAssignments. Check each affected consumer rather than assuming every role uses AG Grid: Boarding manifest and active trips also have purpose-built native tables, and Ticketing bookings uses a review queue.

## Filtering and ordering

- Most backend directories are paginated separately from AG Grid. Distinguish global server search/order, filters over loaded records, and filters over the loaded page. Keep scope visible near the controls; do not add AG Grid pagination over an already paginated server page.
- Current default filtering is text filtering on display cells. `sortValues` fixes comparison but does not itself make number/date filtering correct. A typed column design needs raw filter values, formatting, filter type, and appropriate Community modules together. For dates, choose explicit Philippine calendar-day semantics. Use text/custom Community controls for statuses; do not introduce Enterprise Set Filter as a free feature.
- `src/data/directoryOrdering.ts` currently gathers every matching page before ordering/slicing. Broadcast history similarly gathers pages in `NotificationsPanel.vue`. Prefer backend ordering/search for large directories when that behavior is within scope. Do not silently make global discovery page-local to avoid the fetch cost.
- Keep `activeFirst`/post-sort inactive ordering and `displayOnlyColumns` behavior. Never sort formatted currency or display date strings as a substitute for raw values.

## State and responsive behavior

- Current desktop and card renderers are exchanged using viewport width below 700px. Desktop column/filter/sort state and mobile sort/hidden columns are not fully shared. Test resizing while the user has an active filter or hidden columns.
- Prefer stable semantic column IDs over positional IDs for persisted state. If adding persistence, key it by account, role, directory, and schema version; save presentation preferences, not row records or payment data. Handle invalid storage and obsolete columns. Define whether transient query/filter values belong in the URL or session.
- Capture state before destroying the desktop grid and apply it after re-creation; translate supported filtering/order/visibility into cards or explicitly expose any reset. AG Grid state is not a Vue controlled-state loop. Verify the installed version's supported lifecycle/API.
- Size against the available content area, including sidebar and pinned actions. Do not assume a 768px viewport gives the grid 768px. Choose responsive unpinning, tighter action grouping, or cards based on actual usability.
- Current columns use global `wrapText`/`autoHeight`. Prefer wrapping descriptive fields; preserve legible identity/status/action rows, and use accessible disclosure for long messages. Measure before replacing auto-height; essential content must remain available.
- Keep Fit columns as an explicit action. Minimum widths can prevent fitting; do not repeatedly force sizing in resize/render loops or compress values below readable widths.

## Actions, counts and visual states

- Preserve stable row IDs and safe Vue renderers. Do not render backend text with `innerHTML` or put payment/attendance writes directly into the grid wrapper.
- Keep one readable primary row action; secondary actions can use the existing accessible dropdown primitives. Preserve confirmations, permissions, disabled reasons and keyboard focus. Do not turn existing port assignment/status editors into unrelated generic inline editing.
- Present matching total, loaded range, and locally visible count with clear scope. A local filter hiding a loaded page should offer a local clear action without implying the entire database has no matches.
- When resetting, distinguish table presentation from global query/status/sailing filters. Give users a way to understand what is still active.
- Use `themeQuartz.withParams` and existing design tokens. Inspect actual headers, filters, menus, focus and badges in both themes. A section label does not automatically label an inner grid for assistive technology.
- Agree on export semantics: report scope versus visible filtered rows, column visibility and ordering. `AdminReportsPanel.vue` currently exports its `tableRows`, independent of AG Grid column filter/sort state. Label the scope or implement the requested relationship explicitly; never silently drop manifest fields from an official export.

## Acceptance examples

1. Hide a column and sort/filter on desktop; move across 699/700px and back. Verify the chosen state contract and valid row actions.
2. Filter numeric amounts above a threshold and dates across midnight using raw values, including a browser timezone outside the Philippines.
3. On server page 2, use a column filter that matches zero rows; verify counts, clear action and navigation without claiming no global matches.
4. At 768px, inspect long names, route codes, action widths, menu placement and horizontal scrolling inside the table container.
5. Test empty, initial loading, retained rows during refresh, failure, and a changed dataset. Reset restores a usable view.
6. Check actual AG Grid warnings/errors, keyboard navigation into Vue action renderers and focus after a modal closes. Parent component stubs are insufficient for these checks.

## Official references

Check the installed package types and then current official documentation when deciding API details:

- [Grid state](https://www.ag-grid.com/vue-data-grid/grid-state/)
- [Column sizing](https://www.ag-grid.com/vue-data-grid/column-sizing/)
- [Number filters](https://www.ag-grid.com/vue-data-grid/filter-number/)
- [Date filters](https://www.ag-grid.com/vue-data-grid/filter-date/)
- [Keyboard navigation](https://www.ag-grid.com/vue-data-grid/keyboard-navigation/)

These are capability references, not evidence that a feature has already been implemented in BarkoLink.
