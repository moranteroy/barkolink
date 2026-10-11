export function activeFirst<T>(rows: readonly T[], inactive: (row: T) => boolean): T[] {
  return [...rows.filter(row => !inactive(row)), ...rows.filter(inactive)];
}
