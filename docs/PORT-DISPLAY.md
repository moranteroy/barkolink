# Port television display

Open **Admin → Port Display (TV)** at the top of the sidebar, or **Trips & schedules → Open port display**, choose a port and click **Copy TV link**.
Open that link in the television browser or a computer connected to the television by HDMI. Select **Fullscreen** (or use the browser fullscreen command). The television does not need an admin login.

The link is `/port-display?port=<port UUID>&screen=1`. The `screen=1` option hides setup controls initially. **Display controls** reopens them.

The display shows today's scheduled departures and arrivals in Philippine time, including overnight arrivals. Pages rotate every 12 seconds and data refreshes every 30 seconds. Status comes from existing trip operations. Cancelled and delayed trips remain visible. Published, currently effective global advisories and advisories for sailings at the selected port rotate below the schedules. Update those through the existing Admin Advisories page.

When disconnected, the last received data is labelled with a warning; yesterday's trips are removed at midnight. Schedules and notices come from the system, not the photographed sample board.

## Database installation

For an existing hosted database, apply only `supabase/migrations/042_port_display.sql` after migrations 001–041. Do not rerun `setup.sql` on an existing database. Fresh installations can use the regenerated `supabase/setup.sql`.

With the existing local Supabase management credentials, `node scripts/apply-port-display.mjs --apply` installs the migration transactionally and verifies the anonymous live API. Reruns verify the existing installation.

The `port_display` RPC permits anonymous access to a fixed set of schedule, active port, vessel name/operator, and published advisory fields. It exposes no passenger, account, manifest, booking or payment data. Existing table permissions stay unchanged.
