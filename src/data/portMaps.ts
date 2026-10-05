export type MapPort = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
};

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
