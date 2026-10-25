# Vessel tracking and refresh text

Vessel Tracking now uses a clear vessel/location/status layout on desktop and individual location cards on narrow screens. The toolbar contains search, with a vessel count in the heading. The duplicate panel Refresh button and routine update interval/timestamp have been removed. Admin's existing page Refresh still calls the exposed tracking refresh function. Scheduled polling, pagination, search and optional port corrections continue to work.

Routine last-updated text was also removed from Admin Overview, the passenger sailing board, trip weather and the public display's weather controls. Ticketing and Boarding's shared queue notice now appears for initial loading or failed updates, with no successful-update timestamp. Failed updates still explain when previously loaded records are being shown. Trip departure/arrival times, weather forecast times and recorded terminal observations retain their operational meaning.

Verification: 21 focused unit tests and a production build with security header checks pass. `scripts/verify-tracking-refresh-ui.mjs` uses intercepted, read-only fixtures to check Admin, Passenger, Ticketing and Boarding in both themes at 1366, 768 and 390px. It checks page-level tracking refresh, automatic polling, retained records after a failed tracking update, recovery, pagination, search, layout overflow and removed routine text. Desktop dark and mobile screenshots were inspected. Existing role-wide UI scripts now use the new heading and the absence of routine queue metadata.

Full lint still reports the two pre-existing `no-control-regex` errors in `src/data/securityValidation.ts`.
