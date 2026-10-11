// Fixed Philippine time: UTC+08:00, with no daylight-saving offset.
export function manilaDate(now: number): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function remainingDepartures(times: readonly string[], date: string, now: number): string[] {
  if (!date) return [];
  return times.filter(time => new Date(`${date}T${time}:00+08:00`).getTime() > now).sort();
}
