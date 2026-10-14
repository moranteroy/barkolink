# Open-Meteo weather setup

The weather integration now uses Open-Meteo. Passenger Home shows seven daily forecasts for Batangas or Calapan. Passenger trip details and the admin trip picker show both ports with the departure-hour forecast when available. The shared card uses a sky gradient, large temperature, condition, timestamp, rain/wind tiles and secondary cloud cover/visibility.

## Deploy and diagnose

- Apply migration `024_port_weather_cache.sql` if the cache table is missing.
- Run `node scripts/openmeteo-setup.mjs` with the existing ignored Supabase management credentials. It deploys only the weather function, without uploading or removing secrets. The legacy `weatherapi-setup.mjs` command forwards to this script.
- Run `node scripts/check-openmeteo.mjs` for a read-only live check of both ports.
- `.env.weather.local` and the old WeatherAPI key are no longer required. Existing secrets are left untouched.

## Data and usage

- Uses the same verified port-area coordinates as the map: Batangas `[13.7580556, 121.0458333]`, Calapan `[13.43, 121.1966667]`. Unmapped ports show unavailable rather than a guessed location.
- Specifies seven days, Philippine timezone, Celsius, km/h and Unix timestamps. Maps WMO conditions to text; converts visibility meters to km. Missing measurements stay unavailable.
- The authenticated Edge Function shares a 30-minute per-port cache. Old WeatherAPI payloads are ignored to prevent incorrect attribution. On upstream failure, Open-Meteo cache is retained for up to six hours with a stale warning.
- Far-future trips show explicitly labeled current conditions, never an invented departure forecast. Weather does not change sailing status, payments, reservations or staff verification.
- The UI credits [Open-Meteo](https://open-meteo.com/). The free hosted API is for non-commercial use with attribution and usage limits. Commercial deployment requires the appropriate subscription and integration configuration; see [pricing](https://open-meteo.com/en/pricing) and [API documentation](https://open-meteo.com/en/docs).
