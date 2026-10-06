import type { SavedTraveler } from '../services/database/experience';

export function travelerPassengerDetails(traveler: SavedTraveler) {
  const sexes: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say' };
  return { name: traveler.fullName, birthDate: traveler.birthDate, sex: sexes[traveler.sex] || '', phone: traveler.phone, nationality: traveler.nationality };
}

export function accountPassengerDetails(profile: { fullName: string; phone?: string | null }, travelers: SavedTraveler[]) {
  const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
  const matches = travelers.filter(person => normalize(person.fullName) === normalize(profile.fullName));
  // Do not pick between multiple people with the same name.
  const saved = profile.fullName.trim() && matches.length === 1 ? travelerPassengerDetails(matches[0]) : null;
  return { name: profile.fullName, birthDate: saved?.birthDate || '', sex: saved?.sex || '', phone: profile.phone || saved?.phone || '', nationality: saved?.nationality || 'Filipino' };
}
