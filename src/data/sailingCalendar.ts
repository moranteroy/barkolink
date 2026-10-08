import { philippineDateKey } from './travelDate';

export type ScheduleEvent = 'departure' | 'arrival';
export type CalendarSailing = {
  code: string; departureAt: string; arrivalAt: string;
  origin: { city: string; name: string }; destination: { city: string; name: string };
  vessel: { name: string };
};
export function sailingDays(sailings: CalendarSailing[], event: ScheduleEvent) {
  const days = new Map<string, CalendarSailing[]>();
  for (const sailing of sailings) {
    const instant = new Date(event === 'arrival' ? sailing.arrivalAt : sailing.departureAt);
    if (!Number.isFinite(instant.valueOf())) continue;
    const date = philippineDateKey(instant);
    const items = days.get(date) || [];
    items.push(sailing); days.set(date, items);
  }
  for (const items of days.values()) items.sort((a, b) => Date.parse(event === 'arrival' ? a.arrivalAt : a.departureAt) - Date.parse(event === 'arrival' ? b.arrivalAt : b.departureAt));
  return days;
}
export function calendarMonth(month: string) {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((first.getUTCDay() + length) / 7) * 7 }, (_, slot) => {
    const day = slot - first.getUTCDay() + 1;
    return day < 1 || day > length ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}
