# GitHub publication review — November 5, 2026

Target: `moranteroy/barkolink`, branch `main`. GitHub authentication and Git author identity were verified as `moranteroy` before publication.

This review supersedes earlier instructions that included `.env.example`. All `.env*` files now remain local, including the blank template. The README contains blank setup instructions so another developer can configure a checkout without receiving local credentials.

## Included

Application source and required branding/assets; Android native source and Gradle wrapper; package lockfile; tests and reusable browser fixtures; Supabase migrations and generated setup SQL; deployment/maintenance tools that read credentials locally; technical documentation.

The snapshot includes passenger voucher and ticket-history fixes, staff travel-window admission guards, loyalty usage reporting, readable assistant times and Android ticket printing. It also adds CI checks for excluded/private files and consistency between the combined setup SQL and all 65 migrations.

## Kept local

- Every `.env*` file and private configuration, signing material, credentials and tokens.
- `docs/research/`, including Chapter 1, Chapter 3, system-overview documents and Word files.
- Feature/system-overview screenshots and their archives; generated browser screenshots and test output.
- Installed dependencies, caches, database backups, copied Android web assets, APK/AAB files and native build output.
- One-off capture and rehearsal helpers. Reusable application verification scripts remain included.

Existing local files are preserved. Excluding a file from Git does not delete it from the owner's machine. The former blank `.env.example` is removed from the current repository tree; no history rewrite is performed.

## Verification

- Lint and production build passed, including TypeScript and security-header validation.
- All 466 unit tests passed across 81 files.
- All 234 database/Edge Function tests passed across 26 isolated files.
- Generated setup SQL matches all 65 migrations.
- Read-only hosted integrity checks found zero seat, reservation, accommodation, passenger-count, staff-port, account-role or trip-time issues.
- The staged repository scan found no credential patterns or excluded file paths; only Git blobs were inspected, without reading local environment/credential files.
- Browser verification covers role access/redirects, paginated inboxes, mobile layouts, manual vouchers, historical tickets, QR tampering/repeated attendance guards and isolated ticket printing.

The earlier [Android APK build](https://github.com/moranteroy/barkolink/actions/runs/42023127550) compiled the same application/native changes successfully. Physical Android hardware, camera and printer acceptance remain separate from automated browser and compilation checks. Passing these checks does not establish that every possible production interaction is error-free.
