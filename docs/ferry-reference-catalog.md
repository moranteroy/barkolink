# Nationwide ferry reference catalog

Checked on 11 October 2026. The committed catalog contains 79 ports, 168 directed port pairs (84 corridors), and 88 vessel identities across eight operators: Montenegro, Starlite, FastCat, OceanJet, SuperCat, Besta, Orange Navigation and Atienza. Only Batangas Port and Calapan Port are active, with two directed routes and 23 eligible vessels. All other ports and unsupported vessels are inactive. Routes with inactive endpoints cannot be used to create a sailing.

## Primary sources

- [PPA Mindoro port projects](https://www.ppa.com.ph/content/mindoro%E2%80%99s-%E2%80%98food-highway%E2%80%99-gets-boost-completion-8-integrated-seaport-projects-prrd-leads?page=1): Calapan, Balatero, Abra de Ilog, Roxas and Bulalacao port identities.
- [PCBSI corporate profile](https://linkrigroup.com/pcbsi-port-terminal-management-corp/): terminal services operator, including its Calapan branch. PCBSI is not the vessel operator.
- [MARINA March 2026 Philippine Nautical Highway Matrix](https://marina.gov.ph/wp-content/uploads/2026/04/Philippine-Nautical-Highway-Matrix-MAR-2026.pdf): dated vessel capacities and vessel-route associations. Source page numbers are retained in the catalog.
- [Starlite official fleet](https://starliteferries.com/our-fleet/): named passenger vessels and their published deployment pairs. Cargo-only Starlite Tamaraw is excluded.
- [Montenegro official offices and routes](https://montenegrolines.com.ph/contact.php): nationwide ferry corridors. Rorobus land routes are excluded.
- [FastCat schedules](https://www.fastcat.ph/routes-schedules/) and [classes](https://www.fastcat.ph/rates/): August 2026 Batangas–Calapan departures, Bulalacao–Caticlan departures and nationwide operator corridors. Individual ships are assigned only where the MARINA matrix names them.
- [SuperCat schedules and classes](https://supercat.ph/schedules-and-rates/): three published daily departures in each direction for Batangas–Calapan.
- [Starlite schedules and classes](https://starliteferries.com/schedule-and-rates-2025-2/): the source is explicitly dated 2025 and displayed as requiring reconfirmation.
- [OceanJet accommodation policy](https://www.oceanjet.net/travel-advisories/updated-baggage-policy): Open Air, Tourist Class and Business Class. This does not certify class availability or seat allocations on each ship.
- [Montenegro booking lookup](https://montenegrolines.com.ph/booking.php): date-specific schedules. No fixed daily departure times were verified and none are invented.

## Interpretation and limits

Port codes are BarkoLink identifiers, not official UN/LOCODEs. `PGA` now explicitly names Balatero Port in Puerto Galera. `ROX` means Dangay, Roxas, Oriental Mindoro; `RXS` means Culasi, Roxas City, Capiz. Lipata, Surigao and Lipata, Culasi, Antique have separate records. Siquijor and Larena also remain separate ports.

Multi-stop itineraries produce consecutive legs only. The catalog does not infer direct service between every pair of stops. Both travel directions are represented as reference planning pairs; this does not create a departure in either direction. Operator corridors without published named-vessel assignments remain visible without fabricated assignments.

The MARINA PDF has merged cells, page continuations and several inconsistent values. Extraction is only a research aid; the preparation script explicitly maps reviewed route strings and page-continuation corrections. Deleted CPC routes, temporary stoppages, unknown truncated routes, cargo-only vessels and incorrectly carried operator labels are excluded. The source's Pulupandan label carries into a separate Dumaguete–Larena block on page 29; its actual port columns were used. Page 40's Aleson suspension note is not applied to Montenegro's separately marked served Zamboanga–Jolo row.

Sixty vessels have a single published capacity; 23 are active on the Batangas-Calapan corridor. Twenty-seven have missing or conflicting capacities; Ocean Jet 3 has a published capacity but is inactive because the March 2026 matrix explicitly marks preventive maintenance. MV Baleno's conflicting 820/498 capacities are retained and not averaged. The Montenegro vessel webpage repeats identical 2019 specifications across many ships and was not used as a capacity source. A published reference value still needs operational confirmation before scheduling.

Ten published operator timetable records and four operator/route accommodation profiles are included in the JSON and stored in route/vessel reference metadata. Trips shows a daily timetable panel with Philippine-time departure buttons; a button prepares an unsaved trip and limits vessel choices to that operator's verified route assignments. FastCat arrivals are estimated from published durations, including overnight rollover. Its inconsistent 09:00 AM → 11:00 PM source entry is documented and not copied. Starlite and SuperCat arrivals remain manual when no duration is captured. Disabled routes remain visible as references but cannot prepare a trip.

Accommodation shows official class names and offers them in the class editor. Profiles have null class capacity and surcharge, because published names alone do not establish per-vessel seat inventory or current extra fares. No operational accommodation allocation, fare or bookable departure is invented. Administrators must configure the actual vessel class allocation and confirm fares before opening bookings. Existing accommodation records remain unchanged.

## Import and safety

1. `node scripts/reference-catalog.mjs generate` regenerates `supabase/reference-catalog.sql` and the optional new-project seed from the committed JSON.
2. `node scripts/apply-reference-catalog.mjs` previews the target project and counts without writing.
3. `node scripts/apply-reference-catalog.mjs --apply` backs up catalog rows locally, applies migrations 034/035 when needed, and imports references in one transaction.

The importer uses the existing management connection and verifies the project matches the frontend. It locks affected tables and asserts identical fingerprints for accounts, authentication records, bookings, passengers, sailings, fares, accommodation and online payments before committing. It does not truncate tables or reset transactions. Repeating an import preserves operational vessel capacities and duration edits, reapplies the requested port service area and disables routes with inactive endpoints. Historical sailings can retain their original ports; new assignments require active ports.

Old synthetic vessels remain inactive under their original IDs so existing bookings and ticket history retain their vessel identity and seats. The fictitious Calapan South Terminal and Calapan–Puerto Galera demonstration route remain inactive. Tests keep their synthetic operational fixtures in `tests/fixtures/basic-reference.sql`; those fixtures are not deployment reference data.

`vessel_route` assignments are available through the administrator RPC, with source metadata and route details in the directories. A database trigger rejects unsupported origin/destination assignments for imported reference vessels. Changing a verified route's endpoints requires a separate route, so it cannot silently move all linked vessels to another corridor.

Research preparation helpers need the downloaded official PDF in `.audit/reference-catalog/` and a local PyMuPDF installation in `.audit/pdf-tools/`. The application, SQL generator and importer use the committed JSON and do not require those tools or network scraping.

Database tests run serially in separate Node processes so each PGlite instance and Edge Function mock has its own runtime. Sharing all suites in one process caused a WebAssembly function-signature failure after the additional catalog database was created.
