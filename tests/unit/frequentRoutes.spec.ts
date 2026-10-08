import { describe, expect, it } from 'vitest';
import { frequentRoutes } from '../../src/data/frequentRoutes';
import type { BrowseSailingsData, MyBookingsData } from '../../src/services/database/passenger.types';

const booking = (from = 'Batangas', to = 'Calapan', extra = {}) => ({
  status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-01-01T00:00:00Z',
  sailing: { origin: { city: from }, destination: { city: to } }, ...extra,
}) as MyBookingsData['bookings'][number];
const sailing = (extra = {}) => ({
  status: 'SCHEDULED', departureAt: '2099-01-01T00:00:00Z', availableSeats: 5,
  regularFare: 528, durationMinutes: 150,
  origin: { city: 'Batangas' }, destination: { city: 'Calapan' }, ...extra,
}) as BrowseSailingsData['sailings'][number];

describe('personal frequent routes', () => {
  it('ranks paid bookings by frequency and keeps reverse routes distinct', () => {
    const result = frequentRoutes([booking(), booking(), booking('Calapan', 'Batangas')], []);
    expect(result.map(route => [route.from, route.to, route.count])).toEqual([['Batangas', 'Calapan', 2], ['Calapan', 'Batangas', 1]]);
  });
  it('excludes unpaid, cancelled and refunded reservations', () => {
    expect(frequentRoutes([booking('A', 'B', { paymentStatus: 'UNPAID' }), booking('A', 'B', { status: 'CANCELLED' }), booking('A', 'B', { paymentStatus: 'REFUNDED' })], [])).toEqual([]);
  });
  it('uses the lowest valid upcoming fare and its corresponding duration', () => {
    const [route] = frequentRoutes([booking()], [sailing({ regularFare: 700 }), sailing(), sailing({ regularFare: 1, availableSeats: 0 }), sailing({ regularFare: 2, status: 'CANCELLED' }), sailing({ regularFare: 3, departureAt: '2020-01-01T00:00:00Z' }), sailing({ regularFare: 4, departureAt: 'invalid' }), sailing({ regularFare: -1 })]);
    expect([route.fare, route.duration]).toEqual([528, 150]);
  });
  it('keeps historical routes without inventing current fares', () => {
    expect(frequentRoutes([booking()], [sailing({ availableSeats: 0 })])[0]).toMatchObject({ fare: null, duration: null });
    expect(frequentRoutes([], [sailing()])).toEqual([]);
  });
  it('breaks frequency ties using the most recent booking and limits to four routes', () => {
    const result = frequentRoutes(Array.from({ length: 6 }, (_, index) => booking(`City ${index}`, 'Calapan', { createdAt: `2026-01-0${index + 1}T00:00:00Z` })), []);
    expect(result.map(route => route.from)).toEqual(['City 5', 'City 4', 'City 3', 'City 2']);
  });
});
