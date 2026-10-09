# Staff port access

In **Admin → Staff port assignments**, choose a port for each ticketing and boarding account and press **Save**. This directory contains staff only. Create accounts separately in **Admin → Users**; new staff remain unassigned until an administrator assigns their port. Terminal operations are blocked while unassigned or while the assigned port is inactive. Passengers can book from all ports and do not need an assignment.

Access follows the **departure port**. Calapan staff handle Calapan → Batangas departures; Batangas staff handle Batangas → Calapan departures. The other port remains visible as the journey's destination. Administrators retain access across ports.

PostgreSQL scopes staff sailing lists, bookings, passenger records, payment queues, dashboard counts, fares, manifests and boarding activity. Payments, refunds, discount verification, walk-in sales, QR verification, check-in, boarding and no-show actions check the stored sailing origin before proceeding. Direct online payment verification has the same guard. Browser-provided port IDs cannot override the account assignment.

The staff workspace checks the allowed **MyProfile** operation before requesting terminal records. Staff without an active assignment see a **Port assignment needed** notice and a single toast; restricted record requests are stopped locally. After an administrator assigns a port, press **Check assignment** to reopen the workspace without signing in again. Dashboard queues also recheck the profile during refresh. PostgreSQL still enforces all port restrictions independently of the browser.

Apply migrations `032_staff_port_access.sql` and `033_staff_port_directory.sql` and deploy `manage-account`, or run `node scripts/staff-port-setup.mjs --apply` with the existing local Supabase management configuration. Inspect without changes with `node scripts/staff-port-setup.mjs`.
