import type { BrowseSailingsData } from '../services/database/passenger.types';
export type LandingSailing = BrowseSailingsData['sailings'][number];
export function landingCatalog(sailings: LandingSailing[], now = Date.now()) {
  const upcoming = sailings.filter(s => ['SCHEDULED', 'AVAILABLE'].includes(s.status.toUpperCase()) && Date.parse(s.departureAt) > now).sort((a, b) => Date.parse(a.departureAt) - Date.parse(b.departureAt));
  const routes = new Map<string, { id: string; sailing: LandingSailing; fare: number | null }>();
  const vessels = new Map<string, { vessel: LandingSailing['vessel']; routes: Set<string> }>();
  for (const sailing of upcoming) {
    const id = `${sailing.origin.id}:${sailing.destination.id}`;
    const vessel = vessels.get(sailing.vessel.id) || { vessel: sailing.vessel, routes: new Set<string>() };
    vessel.routes.add(id); vessels.set(sailing.vessel.id, vessel);
    if (sailing.availableSeats <= 0) continue;
    const fare = Number.isFinite(sailing.regularFare) && sailing.regularFare >= 0 ? sailing.regularFare : null;
    const route = routes.get(id);
    if (route) { if (fare !== null && (route.fare === null || fare < route.fare)) route.fare = fare; }
    else routes.set(id, { id, sailing, fare });
  }
  return { routes: [...routes.values()], vessels: [...vessels.values()] };
}
