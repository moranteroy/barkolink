import { expect, it } from 'vitest';
import { manilaDate, remainingDepartures } from '../../src/data/dailyDepartures';
it('hides elapsed departures at the exact departure time in Philippine time', () => {
  const now = Date.parse('2026-10-11T09:00:00+08:00');
  expect(remainingDepartures(['01:00','09:00','13:00'],'2026-10-11',now)).toEqual(['13:00']);
  expect(remainingDepartures(['01:00','09:00','13:00'],'2026-10-12',now)).toEqual(['01:00','09:00','13:00']);
});
it('rolls over the Philippine day at midnight', () => {
  expect(manilaDate(Date.parse('2026-10-11T16:00:00Z'))).toBe('2026-10-12');
  expect(remainingDepartures(['23:59'],'2026-10-11',Date.parse('2026-10-11T16:00:00Z'))).toEqual([]);
});
