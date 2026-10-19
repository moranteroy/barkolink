// Same feature check used by Vite's legacy fallback, hosted under script-src 'self'.
if (!import.meta.resolve) throw Error('import.meta.resolve not supported');
