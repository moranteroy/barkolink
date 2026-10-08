# BarkoLink

A web and Android ferry booking and passenger management system with **Passenger**, **Admin**, **Ticketing**, and **Boarding** workspaces.

Built with Vue 3, TypeScript, Ionic Vue, Vite, Capacitor, Supabase Auth/PostgreSQL, AG Grid Community, and source-owned shadcn-vue UI components. The passenger web interface uses a mobile-style layout; all workspaces support Light, Dark, and System appearance.

## Set up on another laptop

### 1. Install the prerequisites

- [Git](https://git-scm.com/downloads).
- [Node.js 24 LTS](https://nodejs.org/) with npm. The repository includes `.nvmrc` for version managers. Use Node 24 for the complete toolchain, including database tests.
- A terminal: PowerShell on Windows, or Terminal on macOS/Linux.
- Internet access and the Supabase **project URL** and **publishable key** from the project owner.

Android Studio, Java, the Supabase CLI, and Firebase emulators are **not required to run the web app against an existing configured Supabase project**.

Check your installation:

```sh
git --version
node --version
npm --version
```

### 2. Clone the repository

```sh
git clone https://github.com/moranteroy/barkolink.git
cd barkolink
```

Run all remaining commands from this folder, where `package.json` and `ionic.config.json` are located.

### 3. Install dependencies and the Ionic CLI

```sh
npm ci
npm install -g @ionic/cli
```

`npm ci` installs the versions recorded in `package-lock.json`. Keep that lockfile in Git. Use `npm install` when deliberately adding or updating dependencies.

### 4. Create your local environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```sh
cp .env.example .env.local
```

Open `.env.local` and fill in the owner's Supabase values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

Use the publishable key, or put a legacy anon key in `VITE_SUPABASE_ANON_KEY` instead. The Google Maps key is optional. These `VITE_*` values are included in the browser/Android build, so **never use a service-role key, secret API key, database password, or Supabase management token here**.

`.env.local` stays on your laptop and is ignored by Git. `.env.example` is the blank template that belongs in the repository. Ask the project owner for the public connection settings through the team's normal private channel; do not put local environment files in a GitHub issue.

### 5. Start the app

```sh
ionic serve --port 8100
```

Open **http://localhost:8100**. Ionic watches the source files and reloads the browser when you save changes. Stop the server with **Ctrl+C**.

You can also start the same Vite app without installing the Ionic CLI:

```sh
npm run dev -- --host localhost --port 8100
```

After editing `.env.local`, stop and restart the server. Sign in with an existing account, or register a passenger account and confirm its email if email confirmation is enabled. Admin and staff roles must be granted by an administrator; selecting a role in the browser does not grant access.

**For the existing team backend:** cloning the project and providing the public URL/key is enough. Do not rerun the schema installation or reset the database. All teammates using those settings share the same hosted records.

## Set up a new Supabase project

This section is for a project owner creating a separate backend. Skip it when using the existing configured backend.

1. Create a Supabase project and copy its public URL/key into `.env.local`.
2. In its SQL Editor, run `supabase/setup.sql` **once on the new project**. It combines the current migrations in a transaction. Alternatively, apply `supabase/migrations/*.sql` in numeric order; choose one method. Optional: run `supabase/seed.sql` for example ports and a vessel. When adding migrations later, regenerate the combined script with `node scripts/build-sql.mjs`; existing databases should receive only the new migrations.
3. In Authentication URL Configuration, allow the app's actual origins and redirect URLs. For the commands above, include `http://localhost:8100/login` and `http://localhost:8100/reset-password`. Add the production URLs when hosting. If you use `127.0.0.1` or another port, configure those URLs too.
4. Register and confirm the first administrator account. Replace the example email in `supabase/queries/set-account-role.sql`, then run it as the project owner in SQL Editor. Sign out and sign in again after changing a role.
5. Deploy the server-only account management function. Replace `YOUR_PROJECT_REF` with your project's reference:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy manage-account
   ```

   The function validates the caller's user token and requires ADMIN. Its hosted runtime supplies the server credentials. Privileged credentials must stay server-side.

6. As Admin, configure ports, vessels, routes, accommodation classes, fares, and future sailings. Verify booking, cash collection, ticket issuance, check-in, and boarding before using the project operationally.

Supabase Auth manages accounts. The app calls the `barkolink_execute` PostgreSQL RPC for authorized database operations. Database functions enforce roles, fares, seat inventory, and transactional booking/payment/boarding changes. The active app does not use Firebase.

## Useful commands

| Command | Purpose |
| --- | --- |
| `ionic serve --port 8100` | Run the web app with Ionic CLI |
| `npm run dev -- --port 8100` | Run Vite directly |
| `npm run build` | Type-check and build production assets into `dist/` |
| `npm run preview -- --port 8100` | Preview a completed production build |
| `npm run lint` | Check code style/errors |
| `npm run test:unit` | Run UI/helper unit tests |
| `npm run test:database` | Run isolated PGlite database tests; no hosted writes |
| `npm run test:e2e` | Run Cypress against its configured local server |
| `npm run android:build` | Build and sync web assets, then compile a debug APK |

Browser fixture checks in `scripts/verify-*-ui.mjs` have their own server/browser requirements. See their `BARKOLINK_UI_URL` setting. They intercept backend traffic; scripts with `live` or `management` in their name are owner tools and should not be run as part of a normal laptop setup.

## Android setup (optional)

Install Android Studio, Android SDK Platform 36, Build Tools/Platform Tools, and a compatible JDK. Set `JAVA_HOME` and `ANDROID_HOME` to the actual installation folders. Then, from the project root:

```sh
npm run build
npx cap sync android
npx cap open android
```

Build/run the app in Android Studio, or run `npm run android:build` after configuring the toolchain. Its expected debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

Native Android source, icons, Gradle scripts, and `gradle/wrapper/gradle-wrapper.jar` belong in Git. Copied web assets, APKs, Gradle caches, signing keys, and the machine-specific `android/local.properties` do not. Rebuild and run Capacitor sync after cloning or changing web code. See [the Android guide](docs/ANDROID.md) for device checks.

## Project structure

```text
src/
  components/       Shared UI, passenger cards, admin/staff components
  composables/      Theme, confirmations, session lifecycle
  data/             Validation, fares, reports, ticket helpers
  services/         Supabase Auth, account functions, typed database RPC calls
  theme/            Shared palettes, Ionic/shadcn styles, workspace layouts
  views/            Auth, passenger, admin, ticketing, boarding, settings
  router/           Routes and role access checks
supabase/
  migrations/       Versioned database changes
  functions/        Server-only Edge Functions
  queries/          SQL examples and first-admin role setup
  setup.sql         Combined setup for a new backend
android/            Native Android project
tests/              Unit, browser, and isolated database tests
scripts/            Local checks, database script builder, Android helper
docs/               Feature and development guides
```

Archived Firebase/prototype files and generated screenshots are retained locally by the owner and excluded from new commits.

## Troubleshooting

- **`ionic` is not recognized:** run `npm install -g @ionic/cli`, reopen the terminal, and check `ionic --version`. Or use `npm run dev`.
- **PowerShell blocks `npm.ps1` or `ionic.ps1`:** use `npm.cmd` / `ionic.cmd`, or run the commands in Command Prompt. You do not need to change the system execution policy to start this project.
- **Supabase is not configured:** verify `.env.local` is beside `package.json`, fill the URL and public key, then restart the server.
- **Login or email reset redirects to the wrong address:** ask the backend owner to add the exact localhost origin/redirect URLs in Supabase Authentication settings.
- **A port is in use:** stop the other server or choose another port, for example `ionic serve --port 8101`. Update auth redirect settings if you change the origin.
- **`npm ci` reports a lockfile mismatch:** use the matching `package.json`/`package-lock.json` from the same commit. Maintainers changing dependencies should run `npm install` and commit both files.
- **Vite or Capacitor rejects the Node version:** install Node 24 LTS and reopen the terminal.
- **Camera scanning fails:** allow camera access and use localhost or HTTPS. Android camera checks should be performed on a phone/emulator.

## Before committing

```sh
git status --short
git diff --cached --stat
```

Commit source, tests, SQL migrations, config templates, native source, and the npm lockfile. `.gitignore` excludes nested `node_modules`, local environment files, credentials, build outputs, generated screenshots, and archived code. An ignore rule does not remove a file already tracked in a previous commit; see [the repository audit and cleanup notes](docs/GITHUB-PREP.md).

Further guides: [shared UI and appearance](docs/UI-COMPONENTS.md), [AG Grid integration](docs/AG-GRID-INTEGRATION.md), [operations](docs/OPERATIONS-UPGRADE.md), and [development commands](scripts/LOCAL-DEVELOPMENT.md).

Current updates: [release readiness](docs/RELEASE-READINESS.md), [demonstration accounts and workflows](docs/DEMO-WORKFLOWS.md), [Vercel deployment](docs/VERCEL-DEPLOYMENT.md), and [GitHub review](docs/GITHUB-REVIEW-20261006.md).
# PayMongo sandbox payments

Cash and PayMongo test checkout (GCash, Maya and cards) are supported. See [the sandbox setup guide](docs/paymongo-sandbox-setup.md) to configure test secrets, apply migration 019 and deploy the payment Edge Function. Online payments remain unavailable until setup is complete; no live payment keys are accepted.
