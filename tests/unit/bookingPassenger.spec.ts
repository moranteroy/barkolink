import { describe, expect, it } from 'vitest';
import { accountPassengerDetails, travelerPassengerDetails } from '../../src/data/bookingPassenger';

const owner = { id: 'owner', fullName: 'Maria Santos', birthDate: '1990-01-01', sex: 'FEMALE', phone: '09111111111', nationality: 'Filipino' };
describe('Booking account passenger defaults', () => {
  it('uses account contact details and a uniquely matching saved traveler', () => {
    expect(accountPassengerDetails({ fullName: ' MARIA   SANTOS ', phone: '09222222222' }, [owner]))
      .toEqual({ name: ' MARIA   SANTOS ', birthDate: owner.birthDate, sex: 'Female', phone: '09222222222', nationality: 'Filipino' });
  });
  it('does not use another traveler or guess between duplicate names', () => {
    for (const travelers of [[{ ...owner, fullName: 'Other Passenger' }], [owner, { ...owner, id: 'other', birthDate: '2000-01-01' }]]) {
      expect(accountPassengerDetails({ fullName: 'Maria Santos' }, travelers))
        .toEqual({ name: 'Maria Santos', birthDate: '', sex: '', phone: '', nationality: 'Filipino' });
    }
  });
  it('keeps missing information blank and maps saved sex choices without guessing', () => {
    expect(accountPassengerDetails({ fullName: 'Maria Santos' }, [owner]).phone).toBe(owner.phone);
    expect(travelerPassengerDetails({ ...owner, sex: 'PREFER_NOT_TO_SAY' }).sex).toBe('Prefer not to say');
    expect(travelerPassengerDetails({ ...owner, sex: '' }).sex).toBe('');
  });
});
