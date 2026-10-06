# Landing page

The `/` page adapts the supplied Base44 layout to Vue and Ionic: ocean hero with working search, responsive navigation, route cards, six features, booking steps, scheduled vessels, travel tips, the existing port guide and a booking CTA.

Public ports and sailings come from `BrowseActivePorts` and `BrowseSailings`. Route cards group upcoming scheduled sailings with available seats, show the lowest regular fare and send the earliest available departure's route/date to the existing search flow. Scheduled vessels are derived from public sailings; no private administration endpoint is exposed. Fares exclude fees and accommodation charges, which are explained beside the cards.

The content describes the existing counter-payment and issued QR-ticket workflow. No unsupported online payment, online check-in, 24/7 support, ratings, passenger totals, testimonials or vessel amenities are advertised. Travel preparation cards occupy the testimonial-style section until authentic reviews are available.

Validation includes lint, TypeScript/production build, three focused catalog tests, and Edge browser checks in light/dark themes at 1440, 1024, 768, 390 and 320px. Browser fixtures exercise responsive bounds, mobile navigation/Escape/focus, route selection, guest search, empty catalogs and failed-load recovery. Run `node scripts/verify-landing-ui.mjs` against the local dev server; screenshots stay in ignored `docs/screenshots/landing/`.
