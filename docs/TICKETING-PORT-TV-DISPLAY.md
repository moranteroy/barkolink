# Ticketing terminal display

Ticketing staff can open **Port TV Display** from the workspace navigation. It opens in a separate tab for the account's active assigned port. Unassigned staff have no shortcut. The existing Admin shortcut and port selector remain available.

Migration `066_ticketing_port_display.sql` enforces the assignment on every authenticated Ticketing feed request. Changing a UUID or readable port name in the URL cannot select another terminal. The response contains only the assigned port in its directory, and display controls disable port selection. Changes to the assignment apply at the next refresh; missing or inactive assignments are rejected. The unscoped implementation lives in the private schema with direct execution revoked.

Signed-out TV browsers continue to show public schedules and published advisories through the copied TV link. They do not receive passenger records. Ticketing can use **Display controls → Copy TV link**, **Fullscreen**, or **TV mode** without gaining schedule or advisory editing permissions.

For an existing database, run `node scripts/apply-ticketing-port-display.mjs` using the existing local management configuration. New databases include this migration through `supabase/setup.sql`.

Migration `067_today_first_staff_trips.sql` applies Admin's Philippine-day priority to Ticketing and Boarding before the 30-record pagination: actionable sailings today, other sailings today, upcoming departures ascending, then past departures descending, with trip code as a stable tie-breaker. Existing search, status filters, and departure-port authorization remain in the query. Apply it with `node scripts/apply-today-first-staff-trips.mjs` on existing databases. Staff trips pages no longer render the port-weather picker; Passenger booking weather remains available.

Validation: staff navigation, port feed, and staff assignment unit tests; isolated database tests for URL overrides, reassignment, missing/inactive assignments, private-function permissions, public TVs, and Admin access; browser fixtures for port controls, UUID/readable URL overrides, TV mode, responsive layouts, and light/dark themes. Lint, formatting, and production build also pass.
