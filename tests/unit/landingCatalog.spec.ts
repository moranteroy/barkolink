import { describe, expect, it } from 'vitest';
import { landingCatalog, type LandingSailing } from '../../src/data/landingCatalog';
const now = Date.parse('2026-10-06T00:00:00Z');
const sailing = (overrides: Partial<LandingSailing> = {}): LandingSailing => ({
  id: 's1', code: 'S1', departureAt: '2026-10-07T00:00:00Z', arrivalAt: '2026-10-07T02:00:00Z', durationMinutes: 120,
  regularFare: 528, studentFare: 400, seniorFare: 400, pwdFare: 400, childFare: 200, availableSeats: 50, status: 'SCHEDULED',
  origin: { id: 'bat', code: 'BAT', name: 'Batangas Port', city: 'Batangas' }, destination: { id: 'cal', code: 'CAL', name: 'Calapan Port', city: 'Calapan' },
  vessel: { id: 'v1', code: 'V1', name: 'Mindoro Voyager', passengerCapacity: 200 }, ...overrides,
});
describe('Public landing catalog', () => {
  it('omits past, cancelled and sold-out routes without hiding a scheduled vessel', () => {
    const result = landingCatalog([sailing({ status: 'CANCELLED' }), sailing({ departureAt: '2026-10-05T00:00:00Z' }), sailing({ availableSeats: 0 })], now);
    expect(result.routes).toEqual([]);
    expect(result.vessels).toHaveLength(1);
  });
  it('groups directed routes and uses only available fares while selecting the earliest available departure', () => {
    const first = sailing();
    const result = landingCatalog([sailing({ departureAt: '2026-10-08T00:00:00Z', regularFare: 500 }), sailing({ availableSeats: 0, regularFare: 1 }), first, sailing({ origin: first.destination, destination: first.origin })], now);
    expect(result.routes).toHaveLength(2);
    expect(result.routes[0].fare).toBe(500);
    expect(result.routes[0].sailing.departureAt).toBe(first.departureAt);
    expect(result.vessels[0].routes.size).toBe(2);
  });
  it('does not invent fares for invalid values or entries for an empty catalog', () => {
    expect(landingCatalog([], now)).toEqual({ routes: [], vessels: [] });
    expect(landingCatalog([sailing({ regularFare: NaN })], now).routes[0].fare).toBeNull();
  });
});
