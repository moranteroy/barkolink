import { describe, expect, it } from 'vitest';
import { displaySailings, manilaDate, type PortDisplayData } from '../../src/services/portDisplay';

const data: PortDisplayData = {
  date: '2026-10-11', updatedAt: '2026-10-11T00:00:00Z', portId: 'cal', ports: [], advisories: [],
  sailings: [
    { code: 'IN', departureAt: '2026-10-10T15:00:00Z', arrivalAt: '2026-10-10T17:00:00Z', status: 'DELAYED', origin: { id: 'btg', name: 'Batangas Port', city: 'Batangas' }, destination: { id: 'cal', name: 'Calapan Port', city: 'Calapan' }, vessel: { name: 'Ferry' }, operator: 'FastCat' },
    { code: 'OUT', departureAt: '2026-10-11T04:00:00Z', arrivalAt: '2026-10-11T06:00:00Z', status: 'CANCELLED', origin: { id: 'cal', name: 'Calapan Port', city: 'Calapan' }, destination: { id: 'btg', name: 'Batangas Port', city: 'Batangas' }, vessel: { name: 'Ferry' }, operator: 'FastCat' },
  ],
};
describe('terminal schedule day boundaries', () => {
  it('uses Philippine dates and keeps overnight arrivals on the arrival board', () => {
    expect(manilaDate('2026-10-10T17:00:00Z')).toBe('2026-10-11');
    expect(displaySailings(data, 'arrivals', data.date).map(s => s.code)).toEqual(['IN']);
    expect(displaySailings(data, 'departures', data.date).map(s => s.code)).toEqual(['OUT']);
  });
  it('removes yesterday’s data when midnight passes even if the network is unavailable', () => {
    expect(displaySailings(data, 'departures', '2026-10-12')).toEqual([]);
    expect(displaySailings(null, 'arrivals', data.date)).toEqual([]);
  });
  it('keeps cancellations visible and orders trips by scheduled time', () => {
    const extra = { ...data.sailings[1], code: 'EARLY', departureAt: '2026-10-11T00:00:00Z' };
    const rows = displaySailings({ ...data, sailings: [...data.sailings, extra] }, 'departures', data.date);
    expect(rows.map(s => s.code)).toEqual(['EARLY', 'OUT']);
    expect(rows[1].status).toBe('CANCELLED');
  });
});
