# Windows Vite dependency cache collisions

The October 24 EPERM rename errors coincided with Ionic on port 8100 and a second Vite development server on 8110 optimizing dependencies in the same `node_modules/.vite/deps` directory. One process could attempt to rename that directory while the other process was using it. The parallel audit development server was stopped; the browser audit now uses a production preview, which does not optimize dependencies.

The `port-isolated-dependency-cache` configuration hook gives development servers separate cache directories by mode and requested port. Ionic's 8100 server uses `node_modules/.vite/development-8100`; an audit server on 8110 uses `node_modules/.vite/development-8110`. Explicit cacheDir settings are preserved. Preview and build configuration do not use the development-cache override.

Vite resolveConfig checks verify the two CLI-port cache paths differ and an explicit cacheDir is retained. No existing optimizer cache was deleted while the user's Ionic server was running. If that server still uses the old configuration after a failed optimizer restart, stop it with Ctrl+C and run `ionic serve` once from the app directory. The new cache can take time to populate on the first load.

This addresses the observed concurrent-server collision. Antivirus or other processes holding filesystem handles can also cause Windows EPERM errors; these were not established as causes in this session.
