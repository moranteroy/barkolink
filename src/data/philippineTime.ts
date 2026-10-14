/** Sailing times always belong to Philippine terminals, not the device timezone. */
export function philippineDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(date) : 'Time unavailable';
}

export function philippineInput(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16) : '';
}

export function parsePhilippineInput(value: string): Date {
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+08:00` : NaN);
  return philippineInput(date) === value ? date : new Date(NaN);
}
