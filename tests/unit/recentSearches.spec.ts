import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const account = vi.hoisted(() => ({ uid: null as string | null }));
vi.mock('../../src/services/auth', () => ({ auth: { get currentUser() { return account.uid ? { uid: account.uid } : null; } } }));
import { readRecentSearches, recordRecentSearch } from '../../src/data/recentSearches';
const search = { from: 'Batangas', to: 'Calapan', date: '2099-01-01', passengers: 1 };
describe('Recent search ownership', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    account.uid = null;
  });
  afterEach(() => vi.unstubAllGlobals());
  it('starts new accounts empty and restores the original account history', () => {
    account.uid = 'first'; recordRecentSearch(search);
    account.uid = 'second'; expect(readRecentSearches()).toEqual([]);
    recordRecentSearch({ ...search, passengers: 2 });
    account.uid = 'first'; expect(readRecentSearches()).toEqual([search]);
    account.uid = 'second'; expect(readRecentSearches()).toEqual([{ ...search, passengers: 2 }]);
  });
  it('keeps guest searches separate from signed-in users', () => {
    recordRecentSearch(search);
    account.uid = 'new-account'; expect(readRecentSearches()).toEqual([]);
    recordRecentSearch({ ...search, passengers: 3 });
    account.uid = null; expect(readRecentSearches()).toEqual([search]);
  });
  it('does not assign unowned legacy history to a new account', () => {
    localStorage.setItem('barkolink-recent-searches', JSON.stringify([search]));
    account.uid = 'new-account'; expect(readRecentSearches()).toEqual([]);
  });
  it('deduplicates searches and keeps only three within the active account', () => {
    account.uid = 'first';
    for (let passengers = 1; passengers <= 4; passengers++) recordRecentSearch({ ...search, passengers });
    recordRecentSearch({ ...search, passengers: 2 });
    expect(readRecentSearches().map(item => item.passengers)).toEqual([2, 4, 3]);
  });
  it('ignores corrupted account storage', () => {
    account.uid = 'first'; localStorage.setItem('barkolink-recent-searches:user:first', '{broken');
    expect(readRecentSearches()).toEqual([]);
  });
});
