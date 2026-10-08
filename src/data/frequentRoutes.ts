import type { BrowseSailingsData, MyBookingsData } from '../services/database/passenger.types';

export type FrequentRoute = {
  id: string; from: string; to: string; count: number; lastBooked: number;
  fare: number | null; duration: number | null;
};

export function frequentRoutes(bookings: MyBookingsData['bookings'], sailings: BrowseSailingsData['sailings'], now = Date.now()): FrequentRoute[] {
  const routes = new Map<string, FrequentRoute>();
  for (const booking of bookings) {
    if (booking.paymentStatus !== 'PAID' || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) continue;
    const from = booking.sailing.origin.city, to = booking.sailing.destination.city;
    if (!from || !to || from === to) continue;
    const id = JSON.stringify([from, to]);
    const route = routes.get(id) || { id, from, to, count: 0, lastBooked: 0, fare: null, duration: null };
    route.count++;
    route.lastBooked = Math.max(route.lastBooked, Date.parse(booking.createdAt) || 0);
    routes.set(id, route);
  }
  for (const sailing of sailings) {
    const departure = Date.parse(sailing.departureAt);
    if (!['SCHEDULED', 'AVAILABLE'].includes(sailing.status) || !Number.isFinite(departure) || departure <= now || sailing.availableSeats <= 0) continue;
    const route = routes.get(JSON.stringify([sailing.origin.city, sailing.destination.city]));
    if (!route || !Number.isFinite(sailing.regularFare) || sailing.regularFare < 0) continue;
    if (route.fare === null || sailing.regularFare < route.fare) {
      route.fare = sailing.regularFare;
      route.duration = Number.isFinite(sailing.durationMinutes) && sailing.durationMinutes > 0 ? sailing.durationMinutes : null;
    }
  }
  return [...routes.values()].sort((a, b) => b.count - a.count || b.lastBooked - a.lastBooked || a.id.localeCompare(b.id)).slice(0, 4);
}
