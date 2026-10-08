import { describe, it, expect } from 'vitest';
import { calendarMonth, sailingDays, type CalendarSailing } from '../../src/data/sailingCalendar';

const sailing = (code: string, departureAt: string, arrivalAt: string): CalendarSailing => ({
  code, departureAt, arrivalAt, origin: { city: 'Batangas', name: 'Batangas Port' }, destination: { city: 'Calapan', name: 'Calapan Port' }, vessel: { name: 'MV Test' },
});
describe('sailing calendar', () => {
  it('groups departures and overnight arrivals by their Philippine date', () => {
    const trip = sailing('overnight', '2099-10-12T15:30:00Z', '2099-10-12T17:30:00Z');
    expect([...sailingDays([trip], 'departure').keys()]).toEqual(['2099-10-12']);
    expect([...sailingDays([trip], 'arrival').keys()]).toEqual(['2099-10-13']);
  });
  it('counts each listed sailing and orders by the chosen event time', () => {
    const a = sailing('A', '2099-10-12T08:00:00+08:00', '2099-10-12T14:00:00+08:00');
    const b = sailing('B', '2099-10-12T09:00:00+08:00', '2099-10-12T12:00:00+08:00');
    expect(sailingDays([b, a], 'departure').get('2099-10-12')?.map(trip => trip.code)).toEqual(['A', 'B']);
    expect(sailingDays([a, b], 'arrival').get('2099-10-12')?.map(trip => trip.code)).toEqual(['B', 'A']);
  });
  it('omits invalid timestamps rather than creating calendar markers', () => {
    expect(sailingDays([sailing('bad', 'invalid', 'invalid')], 'departure').size).toBe(0);
  });
  it('aligns weekdays, handles leap years and adds complete calendar weeks', () => {
    const october = calendarMonth('2026-10');
    expect(october.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(october.filter(Boolean)).toHaveLength(31);
    expect(october.length % 7).toBe(0);
    expect(calendarMonth('2028-02').filter(Boolean)).toHaveLength(29);
    expect(calendarMonth('2027-02').filter(Boolean)).toHaveLength(28);
  });
});
