# GitHub preparation — October 25, 2026

Target repository: `https://github.com/moranteroy/barkolink`, branch `main`.

GitHub API verification confirmed the saved credential belongs to **moranteroy** (GitHub user ID `245299651`), the repository owner, and has push permission. Git author and committer use `moranteroy` and the owner's GitHub noreply address. Repository-local credential selection is pinned to that username; no credential is stored in tracked configuration. The repository is public.

## Publication checks

- Checked publishable working files and the exact Git index for known local credential values, staff temporary passwords, common provider token/key formats, embedded JWTs, credential-bearing connection strings, private-key markers, and private/generated paths.
- `.env.local`, management credentials, staff credentials, `.audit/`, `.backups/`, `node_modules/`, `dist/`, browser screenshots/videos, logs and native build/signing artifacts remain ignored and excluded.
- `.env.example` contains blank configuration placeholders. Required source, tests, migration scripts, fonts/license and UI assets are included.
- Reviewed all 6,338 historical Git blobs available locally. Found no exact matches for current local credential values. Historical `functions/node_modules` paths were committed before the earlier repository cleanup; they are absent from the current index. Eleven private-key marker findings in those dependencies were reviewed as documentation, examples or key-format detection code, without complete PEM private-key bodies. No history rewrite was performed.
- `scripts/check-publish-safety.mjs` provides a repeatable local check. It prints locations/categories rather than credential values, and stores its full report in ignored `.audit/`. Historical generated paths and format markers deliberately require review, so a historical scan can flag them even when the current index is clean.
- `git diff --cached --check` passed. Application validation is recorded in [the system audit](SYSTEM-AUDIT-2026-10-25.md): 393 unit tests, 191 database/Edge Function tests, role workflows, lint and production build passed.

These checks reduce publication risk but are not a guarantee against every possible secret format. Local audit reports and credentials must stay outside Git. This step prepares a local commit; it does not publish changes or deploy the application.
