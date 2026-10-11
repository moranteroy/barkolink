import { expect, it } from 'vitest';
import { durationHours, durationInput, parseDurationMinutes } from '../../src/data/duration';
it('displays durations as hours and minutes without decimal fractions', () => {
  expect(durationHours(90)).toBe('1:30 hours');
  expect(durationHours(120)).toBe('2:00 hours');
  expect(durationHours(78)).toBe('1:18 hours');
  expect(durationHours(135)).toBe('2:15 hours');
  expect(durationHours(60)).toBe('1:00 hour');
  expect(durationHours(null)).toBe('Not published');
});
it('converts hour:minute inputs to exact database minutes', () => {
  expect(parseDurationMinutes('1:30')).toBe(90);
  expect(parseDurationMinutes('2:15')).toBe(135);
  expect(parseDurationMinutes('2')).toBe(120);
  expect(parseDurationMinutes('0:01')).toBe(1);
  expect(parseDurationMinutes('168:00')).toBe(10080);
  for (const value of ['1.3','1.5','1:60','0:00','168:01','bad','']) expect(parseDurationMinutes(value)).toBeNull();
  expect(parseDurationMinutes(durationInput(90))).toBe(90);
});
