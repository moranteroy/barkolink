export type RecentSearch = { from: string; to: string; date: string; passengers: number };
const key = "barkolink-recent-searches";
export function readRecentSearches(): RecentSearch[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(key) || "[]");
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
    localStorage.setItem(key, JSON.stringify([search, ...previous].slice(0, 3)));
  } catch { /* Search still works when history storage is unavailable. */ }
}
