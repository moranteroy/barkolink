# Records tables

Shared shadcn-vue presentation, the column visibility menu, mobile loading cards, and coordinated light/dark/system appearance are documented in [UI-COMPONENTS.md](./UI-COMPONENTS.md).

BarkoLink uses AG Grid Community 36.2.0 and its Vue 3 adapter. Community packages have an MIT license; no Enterprise package or license key is installed. The implementation follows the [Vue quick start](https://www.ag-grid.com/vue-data-grid/getting-started/) and [Grid API](https://www.ag-grid.com/vue-data-grid/grid-api/) documentation.

`src/components/shared/RecordsGrid.vue` supplies resizable columns, text column filters, sortable displayed data, stable row IDs, automatic row heights, and safe Vue cell rendering. Date and amount columns carry underlying values for chronological/numeric sorting. The Action column is pinned on the right, and all existing confirmation, status, permission, and payment checks remain in the calling pages. Audit Details remains a display-only column with readable collapsible changes.

The Fit columns button calls `sizeColumnsToFit()`. Reset table clears column filters with `setFilterModel(null)`, resets sorting/order/width with `resetColumnState()`, and fits the columns. The component also emits `ready` and exposes `getApi()`, `fitColumns()`, and `resetView()` for future table integrations.

Admin tables include Bookings, Passengers, Users, Trips, Ports, Vessels, Check-in, Boarding, Manifest, and Audit Logs. Staff catalog grids cover trips for both staff roles and passengers/fares for Ticketing. Operational dashboard cards, ticket scanners, notifications, and dedicated accommodation/route forms retain their existing layouts.

Supabase remains the data API. The existing search, status/date filters, RPC authorization, and database pagination still select the records that are loaded. AG Grid column filters and sorting operate on that loaded page, as indicated beside the table. No schema migration or new API credentials are needed. Grids are read-only; authorized edits continue through the existing action buttons and backend functions.

Below 700 pixels, records render as stacked cards with their readable fields and the same row actions. This keeps mobile check-in, boarding, and audit review usable. Column controls are available in the desktop/tablet grid.

Verification uses isolated backend fixtures in `scripts/verify-experience-ui.mjs`. It covers name sorting, column filtering, Grid API reset/fit, the real trip Edit renderer, readable audit changes, legacy-role help, account dialogs, global booking search, and mobile cards at 1440, 768, and 390 pixels. Parent component tests use a small table stub to exercise existing business actions; browser checks render AG Grid itself. All 105 unit tests, lint, production build, and Admin/Ticketing/Boarding browser checks passed. Android assets were synced. Only required Community modules are included, and no hosted records were changed by the browser tests.

AG Grid 36.2 compatibility repair: column tooltips use the supported `tooltip` callback. Removed the manual row-height reset because `autoHeight` already tracks content changes. Browser checks now reject AG Grid warnings as well as errors and verify rendered tooltips and expanded audit content at desktop/tablet/mobile widths. Production build, lint, and Android asset sync passed.
