import type { DatabaseClient } from './client';

// Read-only lookups are scoped to the current authenticated client, never shared across accounts.
const caches = new WeakMap<DatabaseClient, Map<string, { expires: number; value: unknown }>>();
export async function cachedReference<T>(client: DatabaseClient, key: string, fetch: () => Promise<T>, fresh = false): Promise<T> {
  let cache = caches.get(client);
  if (!cache) { cache = new Map(); caches.set(client, cache); }
  const entry = cache.get(key);
  if (!fresh && entry && entry.expires > Date.now()) return entry.value as T;
  const value = await fetch();
  cache.set(key, { expires: Date.now() + 60000, value });
  return value;
}
export function clearReferenceCache(client: DatabaseClient) { caches.delete(client); }
