Use Node.js 24 LTS. After cloning, run `npm ci`, install the Ionic CLI with `npm install -g @ionic/cli`, and create `.env.local` using the blank settings in [README.md](../README.md). Fill in the Supabase project URL and public key supplied by the owner. All `.env*` files remain local.

Run `ionic serve --port 8100` from the project folder, or use `npm run dev -- --host localhost --port 8100`. Both run the same Vite app. Open `http://localhost:8100`.

When using the existing configured team backend, do not reinstall its schema. A project owner creating a separate backend should apply the migrations and deploy the account Edge Function as described in the root README. Authentication, account creation and bookings use the configured project's real services. No Firebase emulator is needed.

Run `npm run test:database` for isolated local PostgreSQL tests without modifying hosted data.
