# BarkoLink UI and Google Maps

The UI uses an ocean palette, gentle background gradients, translucent navigation and passenger cards, and solid operational tables and form fields. Glass surfaces fall back to solid backgrounds when blur is unsupported or reduced transparency is requested. Light and dark modes remain available through appearance settings.

The landing page includes a ferry illustration, an upcoming sailing preview when the database returns available sailings, booking instructions, and a port guide. Login and registration include password visibility, password recovery, clear validation, submission guards, and a linked privacy notice. Existing account roles still determine the sign-in destination.

Google Maps appears in the landing page port guide, passenger trip details, and admin Ports & routes. Registered ports come from the database. If the landing page has no available port records, it shows a reference guide for Batangas and Calapan; these reference locations do not create bookable trips. Directions open Google Maps in a separate tab. This integration locates ports; it does not track ferry positions or calculate sailing routes.

## Without an API key

No configuration is needed. The app uses Google's public map embed and Maps directions links. Internet access is needed to display map tiles. The directions link remains available if the iframe fails to load. Only port names and location descriptions are included in the map URLs; passenger records and device coordinates are not sent by BarkoLink.

## Optional Maps Embed API

To use the official keyed Maps Embed API, enable Maps Embed API in your Google Cloud project and set `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`. Restrict that browser key to Maps Embed API and the actual application URLs, then restart the dev server or rebuild. Do not use a server credential. See [Google's Embed documentation](https://developers.google.com/maps/documentation/embed/embedding-map) and [Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started).

## Verification

Run `npm run test:unit`, `npm run build`, and `node scripts/verify-ui.mjs` with the local server running on port 8100. The browser script uses installed Microsoft Edge via Playwright Core. Set `BARKOLINK_UI_URL` to use another local server address. It checks public pages at desktop and mobile sizes, invalid registration, password visibility, sign-in errors, port switching, dark appearance, and protected workspace rendering.

Auth submissions in these browser checks are intercepted. Protected pages use isolated browser fixtures, not live accounts or booking mutations. Review screenshots are written to `docs/screenshots/`; workspace screenshots contain synthetic test records.
