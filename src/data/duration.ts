export function durationInput(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '';
  const whole = Math.round(minutes);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
export function durationHours(minutes: number | null | undefined): string {
  const value = durationInput(minutes);
  return value ? `${value} ${Math.round(minutes!) === 60 ? 'hour' : 'hours'}` : 'Not published';
}
export function parseDurationMinutes(value: string): number | null {
  const match = /^(\d{1,3})(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2] || 0);
  return minutes >= 1 && minutes <= 10080 ? minutes : null;
}
