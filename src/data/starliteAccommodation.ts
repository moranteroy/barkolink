// Current Batangas–Calapan service classes. See docs/port-accommodation-catalog.md.
export const starliteAccommodationDescriptions: Record<string, string> = {
  Economy: 'Standard passenger seating in the Economy accommodation.',
  'Tourist Class':
    'Passenger seating in the Tourist Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.',
  'Business Class':
    'Passenger seating in the Business Class accommodation. Confirm the seating arrangement and amenities for the assigned vessel.',
};
export const starliteAccommodationClasses = Object.keys(starliteAccommodationDescriptions);

export function starliteVesselCode(name: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/^(?:MV|M\/V)\s+/, '')
    .replace(/^(?:STARLITE|SWM)\s+/, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `SL-${slug}`.slice(0, 32).replace(/-$/, '') : '';
}
