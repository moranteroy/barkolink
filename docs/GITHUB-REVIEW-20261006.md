# GitHub review — 6 October 2026

Repository: [moranteroy/barkolink](https://github.com/moranteroy/barkolink), branch `main`. The fetched remote was at `c03ef49` before this update and matched local HEAD. This review supersedes the historical preparation instructions in [GITHUB-PREP.md](GITHUB-PREP.md).

## Findings

- The latest fetched remote tree contained 246 files. No private environment file, backup, dependency tree, generated screenshot, production build or copied Android web asset was present in that tree.
- The earlier commit `5b41e6f` incorrectly included `functions/node_modules/`. The cleanup commit `c03ef49` removed it from the latest tree. Those dependency files remain in old history; this update uses a normal push and does not rewrite history.
- Credential pattern scanning covered 5,424 unique blobs reachable from the fetched remote `main`, plus all eligible working files. No recognized management token, Supabase secret/service-role credential, GitHub token, Slack token, AWS credential or hosted database password URL was found in application/history blobs.
- Exact matching against the locally configured private management credential and the owner-supplied demo password found neither in eligible source or remote history. Values were never printed or written into the audit report.
- Eleven historical third-party dependency files contained private-key format markers or documentation placeholders. None contained a complete PEM private key. These files are already absent from the latest tree.

This is a scoped pattern/exact-value scan, not proof that every conceivable secret format or deleted/unreachable GitHub object is absent. The sanitized local report is `.audit/git-safety-report.json` and is excluded from commits.

## Files included and excluded

The update includes application UI/UX fixes, the revised dashboard, migration 018, reusable synthetic-data and verification scripts, tests, Vercel routing configuration, blank operator-contact settings and current workflow/release documentation.

The ignore rules now also exclude `.audit/`. Private `.env.local` and `.env.supabase-management`, `.backups/`, screenshots, `node_modules/`, `dist/`, native build output and signing material remain local. Only the blank `.env.example` is included. Synthetic passenger account email addresses and seed formulas are documented; their shared password and live database snapshots are excluded. Administrative scripts read credentials locally and require explicit invocation; no reset is run by the application build.

## Validation

- Lint passed.
- All 115 unit tests passed across 22 files.
- All 52 isolated database/account-function tests passed, including realistic passenger details, age/category validation and user-preserving reset checks.
- The production build passed from an export of the staged source with no local credentials or backups. It reused the existing installed dependencies; this was not a fresh dependency installation.
- The earlier dashboard checks passed in both themes at 1440, 1240, 1024, 768, 390 and 320px. Live sample-data and new Passenger login checks were completed separately, as recorded in [DEMO-WORKFLOWS.md](DEMO-WORKFLOWS.md).

## Future pushes

From the actual cloned project directory:

```powershell
git fetch origin --prune
git status --short
node scripts/audit-git-safety.mjs origin/main
git diff --cached --check
git diff --cached --stat
```

The scanner reports locations and finding types without displaying matched values. It checks all currently eligible files and reachable history. Investigate findings before committing. Do not force-push to remove the old dependency history as part of an ordinary source update.
