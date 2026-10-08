# Passenger port map

Trip details use Leaflet 1.9.4 with departure (A) and arrival (B) markers, port selection, both-port bounds, and Google Maps directions. The connector is a straight reference line, not navigation or live vessel tracking. No passenger location permission or automatic geocoding is requested.

`src/data/portMaps.ts` accepts explicit numeric latitude/longitude pairs and rejects incomplete or out-of-range pairs. Existing Batangas and Calapan port names have port-area references sourced from [Batangas](https://www.wikidata.org/wiki/Q15831585) and [Calapan](https://www.wikidata.org/wiki/Q23581630). These are not boarding gates. Name and city must both match; arbitrary terminals in the same city do not inherit a marker. Puerto Galera's generic port name is ambiguous between terminals and has no automatic marker. Add verified coordinates for the actual terminal before mapping it.

Default tiles are `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible OpenStreetMap attribution and normal browser caching/referrer behavior. There is no prefetch, offline download, or background tile polling. Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). Production operators can set `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` together for another provider, then rebuild. These are public browser settings; do not place private keys there. Google directions remain name-based to help passengers find the terminal.

Leaflet loads on demand, cleans up on component removal, and resizes when Ionic views become visible. Unknown locations and tile errors preserve port details and directions.
