# One account per browser

All tabs for the same app origin and browser profile share one Supabase login through the SDK's default local storage and auth broadcasts. The login and registration routes redirect signed-in users to their existing workspace. Account service methods also reject another sign-in or registration while a session exists, including a form left open before another tab signed in.

Browser Web Locks serialize account access so two tabs cannot both check an empty session and sign in to different accounts simultaneously. The fallback serializes calls in the current page on browsers without Web Locks; the supported HTTPS/localhost browser environment should provide Web Locks for concurrent-tab protection.

Normal logout ends the shared browser session (`scope: 'local'`) without logging out other devices. Other open tabs navigate to Sign in and clear cached private pages. Password-check sessions remain temporary and isolated.

Refresh all open tabs after loading this update to replace the earlier tab-isolated implementation. Its per-tab sessions are no longer read. Separate browser profiles, private windows, and different app origins have separate browser storage; this policy applies to tabs sharing the same profile and origin.

The admin notification inbox remains accessible from the header, without the duplicate sidebar entry.

Run `node scripts/verify-browser-session-ui.mjs` against the Vite development server (`BARKOLINK_UI_URL` defaults to `http://127.0.0.1:8110`). It uses mocked backend requests in one browser context to exercise login blocking, new-tab routing, refresh, shared logout, and subsequent sign-in.
