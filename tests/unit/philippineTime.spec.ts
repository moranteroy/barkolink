import { describe, expect, it } from 'vitest';
import {
  philippineDateTime,
  philippineInput,
  parsePhilippineInput,
  routeArrivalInput,
} from '../../src/data/philippineTime';

describe('terminal time consistency', () => {
  it('calculates route arrivals across midnight, month and year boundaries', () => {
    expect(routeArrivalInput('2026-10-24T20:00', 120)).toBe('2026-10-24T22:00');
    expect(routeArrivalInput('2026-10-31T23:30', 120)).toBe('2026-11-01T01:30');
    expect(routeArrivalInput('2026-12-31T23:00', 120)).toBe('2027-01-01T01:00');
    expect(routeArrivalInput('2026-10-24T20:00', null)).toBe('');
    expect(routeArrivalInput('', 120)).toBe('');
  });
  it('round trips a Philippine midnight departure without applying the device offset', () => {
    const input = '2026-10-15T00:30';
    expect(parsePhilippineInput(input).toISOString()).toBe('2026-10-14T16:30:00.000Z');
    expect(philippineInput('2026-10-14T16:30:00Z')).toBe(input);
    expect(philippineDateTime('2026-10-14T16:30:00Z')).toContain('Oct 15, 2026');
  });
  it('keeps the correct arrival day on an overnight sailing', () => {
    const departure = parsePhilippineInput('2026-10-14T23:00');
    const arrival = new Date(departure.getTime() + 2 * 3600000);
    expect(philippineInput(arrival)).toBe('2026-10-15T01:00');
  });
  it('rejects malformed and impossible dates instead of silently rolling them forward', () => {
    for (const input of ['', '2026-02-30T10:00', '2026-10-14', '2026-10-14T25:00']) {
      expect(Number.isNaN(parsePhilippineInput(input).getTime())).toBe(true);
    }
  });
});
