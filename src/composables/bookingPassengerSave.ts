import { confirmAction } from './confirmation';
import { notifyError, notifySuccess } from './toast';
import { savedTravelers, saveTraveler, type SavedTraveler } from '../services/database/experience';
import type { DatabaseClient } from '../services/database/client';
import { databaseRequestError } from '../data/databaseErrors';

export type SaveableBookingPassenger = {
  name: string;
  birthDate: string;
  sex: string;
  phone: string;
  nationality: string;
  savedPassengerDecision?: string;
  isAccountPassenger?: boolean;
};
function details(person: SaveableBookingPassenger): Omit<SavedTraveler, 'id'> {
  return {
    fullName: person.name.trim(),
    birthDate: person.birthDate,
    sex: person.sex.toUpperCase(),
    phone: person.phone.trim(),
    nationality: person.nationality.trim(),
  };
}
const identity = (person: Omit<SavedTraveler, 'id'>) =>
  JSON.stringify([
    person.fullName.trim().replace(/\s+/g, ' ').toLowerCase(),
    person.birthDate,
    person.sex,
    person.phone.replace(/[^+\d]/g, ''),
    person.nationality.trim().toLowerCase(),
  ]);

// Saving is optional and must never prevent the passenger from booking.
export async function offerToSaveBookingPassengers(
  client: DatabaseClient,
  people: SaveableBookingPassenger[],
  isCurrent: () => boolean,
) {
  const candidates = people.filter(
    (person) =>
      !person.isAccountPassenger &&
      ['MALE', 'FEMALE', 'OTHER'].includes(person.sex.toUpperCase()) &&
      person.nationality.trim().length <= 60 &&
      person.savedPassengerDecision !== identity(details(person)),
  );
  if (!candidates.length || !isCurrent()) return 0;
  let saved = 0;
  try {
    const existing = (await savedTravelers(client)).data.travelers;
    for (const person of candidates) {
      if (!isCurrent()) break;
      const passenger = details(person),
        snapshot = identity(passenger);
      if (existing.some((item) => identity(item) === snapshot)) {
        person.savedPassengerDecision = snapshot;
        continue;
      }
      const approved = await confirmAction({
        title: 'Save this passenger?',
        message: `Would you like to add ${passenger.fullName} to your saved passengers for future bookings?`,
        confirmText: 'Save passenger',
        cancelText: 'Not now',
      });
      if (!isCurrent() || identity(details(person)) !== snapshot) continue;
      if (!approved) {
        person.savedPassengerDecision = snapshot;
        continue;
      }
      try {
        await saveTraveler(client, passenger);
        if (!isCurrent()) break;
        person.savedPassengerDecision = snapshot;
        existing.push({ ...passenger, id: '' });
        saved++;
        notifySuccess(`${passenger.fullName} was added to your saved passengers.`);
      } catch (cause) {
        notifyError(
          databaseRequestError(
            cause,
            'Could not save this passenger. You can still continue with your booking.',
          ),
        );
      }
    }
  } catch {
    // Do not create potential duplicates when the saved list is unavailable.
    notifyError('Saved passengers could not be checked. You can still continue with your booking.');
  }
  return saved;
}
