import { auth } from '../services/auth';

export type RecentSearch = { from: string; to: string; date: string; passengers: number };
function historyKey() {
  const uid = auth?.currentUser?.uid;
  return uid ? `barkolink-recent-searches:user:${uid}` : 'barkolink-recent-searches:guest';
}
export function readRecentSearches(): RecentSearch[] {
  try {
    // The old shared key has no owner; never import it into an account.
    const items: unknown = JSON.parse(localStorage.getItem(historyKey()) || "[]");
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is RecentSearch => item &&
      typeof item.from === "string" && typeof item.to === "string" && item.from !== item.to &&
      typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      Number.isFinite(Date.parse(`${item.date}T00:00:00+08:00`)) && Number.isInteger(item.passengers) &&
      item.passengers >= 1 && item.passengers <= 8).slice(0, 3);
  } catch { return []; }
}
export function recordRecentSearch(search: RecentSearch) {
  try {
    const previous = readRecentSearches().filter(item =>
      item.from !== search.from || item.to !== search.to || item.date !== search.date || item.passengers !== search.passengers);
    localStorage.setItem(historyKey(), JSON.stringify([search, ...previous].slice(0, 3)));
  } catch { /* Search still works when history storage is unavailable. */ }
}
