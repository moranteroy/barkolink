# Deploy BarkoLink to Vercel

The frontend is a Vue/Ionic Vite single-page application. Supabase continues to provide its database, authentication and account function. `vercel.json` configures the build, `dist` output and SPA fallback so that directly opening `/login`, `/search` or an admin URL works. See [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).

## Deployment status

On 6 October 2026, migration 018 was applied to the configured Supabase project and verified. The frontend build and Android asset sync passed. No Vercel deployment has been created: this workstation has no configured Vercel login, token or linked project.

At the owner's subsequent request, operational records were replaced with realistic demonstration data and three new passenger accounts were added. See [DEMO-WORKFLOWS.md](DEMO-WORKFLOWS.md) for the current accounts, booking references and varied passenger details. A deployed app will use this same demonstration dataset until it is changed through normal operations or another authorized reset.

## Connect and publish

1. Sign in to Vercel and import the `moranteroy/barkolink` repository after the current changes have been committed and pushed. Choose the repository root as Root Directory, Vite as Framework, and Node.js 24. The committed `vercel.json` supplies the build command and output directory.
2. Add `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` from the local project configuration to the appropriate Vercel environments. These are public frontend values. Never add `SUPABASE_ACCESS_TOKEN` or a service-role key to the frontend.
3. Leave `VITE_OPERATOR_NAME`, `VITE_SUPPORT_EMAIL` and `VITE_SUPPORT_PHONE` blank until the official details are available. Terminal-desk guidance is provided in the meantime.
4. Deploy and record the actual production URL. A change to these Vite environment values requires a rebuild.
5. In Supabase Authentication URL configuration, set Site URL to the actual production origin. Add that origin's `/login` and `/reset-password` to the redirect allowlist, preserving existing required entries. Do this after the actual origin is known; the current Site URL still points to localhost.
6. Verify direct links and refreshes on `/login`, `/search`, `/help`, `/privacy` and `/admin/reports`; anonymous access to private pages must lead to sign-in. Check real email confirmation and password reset with an operator-approved account. Perform approved booking/payment/boarding/refund acceptance checks before operational use.

For a CLI deployment from this local working tree instead of Git import, authenticate locally with `npx vercel login`, then run `npx vercel` from the project directory to link a project and create a preview. Configure its environment variables, review the preview and run `npx vercel --prod` for production. `.vercelignore` excludes local credentials and native/test artifacts from CLI uploads. Do not send account passwords or access tokens in chat.

## Android

Vercel hosts the web application; the Android APK still requires a working JDK and Android SDK. Updated web assets have already been synced with `npx cap sync android`. See [ANDROID.md](ANDROID.md) for the build prerequisites and physical-device checks.
