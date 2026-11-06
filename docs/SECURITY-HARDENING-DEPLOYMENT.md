**Security changes prepared on October 15, 2026**

**Applied to the configured Supabase backend on October 15, 2026:** migration 043 is installed; the default payment window is 30 minutes; `manage-account` version 11, `paymongo` version 10, and `weather` version 7 are ACTIVE. Hosted password minimum is now 8 characters for new/changed passwords, email confirmation remains required, and TOTP enrollment/verification are enabled. Staff/admin users must enroll their own authenticator through the updated local frontend; zero of the three staff accounts had a verified factor before rollout. No account/password/factor was created or reset on their behalf.

Live verification confirmed rejection of AAL1 administrator access, acceptance of simulated AAL2 access in a rolled-back transaction, restricted function grants, an active expiry job, and HTTP 401 for unsigned requests to all three handlers. Counts remained 866 bookings, 2,533 passengers, and 9 accounts. Pre-change database function definitions, relevant auth settings, and previous deployed function artifacts are backed up under the ignored `.backups/security-2026-10-15/` directory. Redacted live verification is in `.audit/security-live-verification.json`.

The repository includes security enforcement for database RPCs and Edge Functions, staff/admin authenticator enrollment and verification, frontend validation, strict browser headers, and Android backup exclusions. Backend changes are active. The configured frontend is localhost, with no linked Vercel deployment/credentials found in this workspace; remote website headers and newly distributed Android APKs still require their respective deployments.

Authentication uses Supabase's verified user identity. Authorization continues to use trusted `app_metadata` and authoritative database roles, with ownership and staff departure-port checks. Staff/admin operations additionally require a gateway-verified JWT with `aal2`. The frontend redirect improves the user flow; PostgreSQL and the account-management handler independently enforce MFA. A caller cannot grant access by sending a role, actor ID, paid status, or MFA flag in the request body.

**New enforced limits**

| Boundary                     | Rule                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unpaid online holds          | At most 8 seats per passenger account per sailing, 16 across all sailings; serialized with a transaction lock                        |
| Reservation churn            | At most 10 recent non-paid reservations per account in 10 minutes, including cancelled attempts that previously created a booking    |
| Default hold period          | 30 minutes; migration changes an existing 1,440-minute setting to 30, preserves other custom settings and existing booking deadlines |
| API calls                    | Per-account, per-minute durable budgets: weather 60, PayMongo 30, account management 20                                              |
| Edge request bodies          | 16 KiB for normal requests; PayMongo signed webhook envelopes up to 256 KiB                                                          |
| Database arguments           | JSON object, at most 32 KiB; individual text values bounded                                                                          |
| New online passenger details | Required name, type, birth date, sex, phone, nationality; valid dates from 1900 through today's Philippine date                      |
| Passenger text               | Names up to 120 characters, nationalities up to 80; control characters rejected                                                      |
| Phone                        | 7–15 digits with optional leading `+`; ordinary spacing/parenthesis/hyphen formatting accepted                                       |
| Walk-in details              | Required name, type, birth date, sex, nationality; phone remains optional and is validated when supplied                             |
| Reservation cleanup          | At most 100 records per cleanup invocation; signed-out schedule reads perform no cleanup writes                                      |

Existing ownership, fare, discount verification, refund, voucher, QR, and staff-port checks remain in the underlying operations. Old booking records are preserved. Duplicate retries retain their idempotency. Per-account limits reduce abuse but do not prevent coordinated abuse through multiple accounts; use hosting/WAF IP limits and Supabase signup bot controls as additional measures.

**Rollout for the existing hosted system**

1. Plan a maintenance window and a tested database backup. Confirm the hosted database already has migrations 001–042. The migration uses a private function version and requires the current schema; do not run the full `supabase/setup.sql` on an existing database.
2. Deploy the frontend with `/verify-staff` so trusted staff can enroll their authenticator. The screen uses Supabase TOTP enrollment, challenge, and verification. Verify that TOTP enrollment is enabled in the actual project. Staff should enroll from a trusted device and retain their authenticator before server enforcement is rolled out. [Supabase documents the TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp).
3. Apply [043_security_hardening.sql](../supabase/migrations/043_security_hardening.sql) once, transactionally, through the normal migration workflow. If using SQL Editor, wrap the file in `begin;` and `commit;`. The migration creates the durable quotas, updates the dispatcher, and protects both versions of the staff payment RPC. Do not execute individual statements out of order or rerun the rename after a successful migration.
4. Deploy `manage-account`, `paymongo`, and `weather`, including `supabase/functions/_shared/security.ts`. With Supabase CLI from this project, run `supabase functions deploy manage-account`, `supabase functions deploy paymongo`, and `supabase functions deploy weather` against the intended linked project. Existing secrets stay server-side. The new handlers fail closed if the quota RPC is unavailable.
5. Redeploy the latest frontend through Vercel so `vercel.json` response headers take effect. `npm run build -- --configLoader native` also checks all built inline script hashes. The Vite legacy browser detector is served from `/security/modern-browser-check.js`, avoiding data-script permissions. Preserve that public asset and the Vite plugin when changing the build. Verify the actual deployed headers; a local build cannot establish that a host applied them.
6. Rebuild the Android app before distributing it. The manifest disables backup and explicitly excludes app data from cloud backup and device transfer. FileProvider grants are limited to `cache/shared-tickets/`; future native sharing integrations must write only there. A web redeploy does not update already-installed APKs.
7. Test one real staff/admin MFA enrollment and subsequent challenge, passenger booking/payment, staff port isolation, account creation, and signed webhook delivery. Confirm `barkolink-expire-reservations` still runs every minute. Monitor quotas and tune budgets for observed legitimate load without removing the checks.

**Hosted authentication settings still require verification**

In the actual Supabase dashboard, require email confirmation, configure the intended redirect URL allowlist, password policy and leaked-password protection where available, authentication rate limits, and bot protection. Signup and password-reset protections are managed by Supabase Auth, not by the application's PostgreSQL booking RPC. CAPTCHA needs a configured provider and frontend integration; no fake or nonfunctional CAPTCHA was introduced. Review authenticated session lifetimes and project-owner dashboard MFA. These settings were not read or changed during the local implementation. [Supabase's production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) explains these controls.

**Recovery and limitations**

Local validation passed: 325 unit tests, 139 database/Edge Function tests, production compilation, build-time CSP hash checks, the production-browser MFA/CSP check, and Android XML parsing. The existing permission/ownership tests still pass with explicit MFA-verified test sessions; dedicated regressions reject staff AAL1 sessions, excess holds, omitted passenger details, malformed inputs, and exhausted quotas.

Losing an authenticator does not grant an email-only application bypass. A trusted project owner must verify the staff member's identity and reset their factor using Supabase's authorized administration workflow. The staff member can then re-enroll. Do not remove the server MFA gate or grant staff roles through editable user metadata for recovery.

The app still uses persistent Supabase sessions, so protect devices and the browser against session theft. CSP reduces injection exposure but does not replace secure input handling. The Android changes were checked as source/XML only: this environment has no available Java toolchain or Android SDK Platform 36, so a release APK build and merged-manifest/device-backup verification remain required. Local tests use synthetic identity and payment records; they do not prove a deployed configuration or real-money payment readiness.
