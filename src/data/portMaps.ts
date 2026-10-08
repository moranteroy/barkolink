export type MapPort = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// Port-area references, not specific boarding gates. See docs/port-maps.md.
const referencePorts = [
  { names: ['batangas port', 'batangas international port', 'port of batangas', '[test] batangas terminal'], cities: ['batangas', 'batangas city'], point: [13.7580556, 121.0458333] },
  { names: ['calapan port', 'port of calapan', '[test] calapan terminal'], cities: ['calapan', 'calapan city'], point: [13.43, 121.1966667] },
] as const;

export function portCoordinates(port: MapPort): [number, number] | null {
  if (port.latitude != null || port.longitude != null) {
    return typeof port.latitude === 'number' && typeof port.longitude === 'number' &&
      Number.isFinite(port.latitude) && Number.isFinite(port.longitude) &&
      Math.abs(port.latitude) <= 90 && Math.abs(port.longitude) <= 180
      ? [port.latitude, port.longitude] : null;
  }
  const name = port.name.trim().toLowerCase(), city = port.city?.trim().toLowerCase();
  const known = referencePorts.find(p => (p.names as readonly string[]).includes(name) &&
    !!city && (p.cities as readonly string[]).includes(city));
  return known ? [...known.point] : null;
}

export function portMapQuery(port: MapPort) {
  return [
    port.name.trim(),
    port.city?.trim(),
    port.region?.trim(),
    "Philippines",
  ]
    .filter(Boolean)
    .join(", ");
}
export function googleMapEmbed(port: MapPort, key = "") {
  const url = new URL(
    key
      ? "https://www.google.com/maps/embed/v1/place"
      : "https://maps.google.com/maps",
  );
  url.searchParams.set("q", portMapQuery(port));
  if (key) {
    url.searchParams.set("key", key);
    url.searchParams.set("region", "PH");
  } else {
    url.searchParams.set("output", "embed");
    url.searchParams.set("z", "15");
  }
  return url.toString();
}
export function googleMapDirections(port: MapPort) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", portMapQuery(port));
  return url.toString();
}
export function googleMapSearch(port: MapPort) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", portMapQuery(port));
  return url.toString();
}
