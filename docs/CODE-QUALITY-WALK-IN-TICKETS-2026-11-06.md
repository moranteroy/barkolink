# Code quality and walk-in tickets — November 6, 2026

## Supabase diagnostics and formatting

The functions use their own strict Deno configuration and a pinned Supabase dependency import map. Deno is enabled only for `supabase/functions`; the Vue frontend retains its normal TypeScript/Volar environment. The official Deno editor extension is recommended and installed on the owner's development machine.

All 40 initial Deno lint findings were resolved without disabling lint rules. External response contracts, tool results and request data have explicit types; input validation remains active. Source bundling and Edge Function test loading now parse TypeScript imports, supporting multiline formatting and the import map.

Supported source files use Prettier with two-space indentation and LF endings. SQL migrations and native sources retain their respective syntax and formatting; generated files, credentials, research documents and screenshots are excluded. The four reviewed production inline-script CSP hashes were updated after formatting, with other security directives retained.

Run these checks from the application directory:

```sh
npm run format:check
npm run lint
npm run lint:edge
npm run check:edge
npm run test:unit
npm run test:database
npm run build -- --configLoader native
npm run test:browser
```

For the editor, install the recommended Deno, Vue and Prettier extensions, then run `npm run setup:editor`. If the folder opened in the editor is the parent containing `barkolink/`, run `npm run setup:editor -- --parent`. Machine-specific settings remain ignored. Reload the editor window if its language servers were already running before configuration.

## Walk-in e-tickets

Walk-in sales already produced confirmed, cash-paid bookings and issued passenger tickets in PostgreSQL. The counter-sale page previously displayed a receipt and ticket code, without rendering the server-issued QR or offering the shared ticket export.

After cash confirmation, Ticketing now retrieves the saved booking through the existing staff/port-scoped operation and displays the individual QR e-ticket. Staff can print/save a PDF or download the ticket. The same ticket panel is available in the booking-and-payment dialog for later reprinting. Native Android printing uses the registered TicketPrint plugin.

The QR contains the backend-provided verified payload, never a fabricated booking reference or client-generated verification token. Unpaid, cancelled and unverified payments remain ineligible. Used/historical tickets retain their record-only behavior. Lost-response recovery reuses the original sale intent; ticket retrieval never collects cash or creates a second sale.

A guest walk-in has no passenger login. Its e-ticket is handed over by Ticketing and does not automatically appear in an unrelated passenger account's My Bookings. No database migration is required for this UI fix.

Validation includes existing frontend/database tests, five additional staff ticket tests, and browser fixtures at mobile/desktop widths in both themes. Browser checks decode the screen and printed QR, download the ticket, reopen it from the queue, and simulate a committed sale whose response was lost. Physical phone/printer acceptance remains separate. Android package version is 1.0.2 (code 3).
