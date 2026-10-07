# WeatherAPI setup

Trip details show weather for the departure and arrival port. Staff and admin Trips pages include a sailing selector to load the same panel. Weather does not change sailing status, reservations, payments or staff verification. Provider data is for travel planning; official advisories and the operator determine sailing status.

## Activate weather

1. Create an account at https://www.weatherapi.com/signup.aspx and copy the API key from the account dashboard.
2. Put `WEATHERAPI_KEY=your_key` in the Git-ignored `.env.weather.local` file. Do not paste it into chat, commit it, or use a `VITE_*` variable.
3. From the `barkolink` directory, run `node scripts/weatherapi-setup.mjs`. It uses the existing ignored Supabase management credentials, installs migration 024 if missing, uploads the weather key if supplied, and deploys only the weather function. Without a key, it deploys the integration in an unavailable state. Run the command again after adding the key.

Alternatively, apply `supabase/migrations/024_port_weather_cache.sql` in Supabase SQL Editor, set `WEATHERAPI_KEY` in Edge Function secrets, and run `supabase functions deploy weather`. A fresh `supabase/setup.sql` includes the cache schema.

## Behavior and limits

- Uses HTTPS `forecast.json` with `days=3`, based on canonical port cities from the database, never a client-supplied weather location. Keep each port's city accurate; the response must match the Philippines.
- The free plan currently provides 100,000 calls/month and a 3-day forecast. This integration uses general port weather; it does not query marine or tide data. See [pricing](https://www.weatherapi.com/pricing.aspx) and [documentation](https://www.weatherapi.com/docs/).
- Shows the departure-hour forecast when the trip falls within the returned forecast window. For later sailings, shows clearly labeled current weather and “Departure forecast is not available yet.” No forecast is fabricated for future demo trips.
- Shares a 30-minute cache per port across passengers and staff. Two frequently viewed ports use roughly 2,880 upstream calls in a 30-day month if requested around the clock. Weather loads when opening a trip; staff/admin load only their chosen sailing.
- On provider failure, previously cached weather is displayed for up to 6 hours with “Saved weather · update delayed.” Older data is discarded. Missing credentials, expired quotas or unavailable data do not block bookings.
- Requests require a valid signed-in account. The key and cache table are unavailable to browser clients. The panel credits WeatherAPI.com and displays a weather-planning disclaimer.

Validate with your own WeatherAPI key before demonstrating live weather. Check a departure within 3 days, a later departure, unavailable service, and weather display on mobile. Confirm that trip status remains controlled by staff.
