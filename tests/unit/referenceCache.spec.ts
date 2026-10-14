import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedReference, clearReferenceCache } from '../../src/services/database/referenceCache';
import type { DatabaseClient } from '../../src/services/database/client';

afterEach(() => vi.useRealTimers());
describe('reference lookup cache', () => {
  it('expires lookups and isolates clients and account keys', async () => {
    vi.useFakeTimers();
    const client = {} as DatabaseClient, other = {} as DatabaseClient;
    const fetch = vi.fn().mockResolvedValue({ ports: ['BTG','CAL'] });
    await cachedReference(client,'ports:admin-a',fetch);
    await cachedReference(client,'ports:admin-a',fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    await cachedReference(client,'ports:admin-b',fetch);
    await cachedReference(other,'ports:admin-a',fetch);
    vi.advanceTimersByTime(60001);
    await cachedReference(client,'ports:admin-a',fetch);
    expect(fetch).toHaveBeenCalledTimes(4);
    clearReferenceCache(client);
    await cachedReference(client,'ports:admin-a',fetch);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it('does not cache failed requests', async () => {
    const client = {} as DatabaseClient;
    const fetch = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([]);
    await expect(cachedReference(client,'vessels',fetch)).rejects.toThrow('Unavailable');
    await expect(cachedReference(client,'vessels',fetch)).resolves.toEqual([]);
  });
});
