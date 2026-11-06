import { describe, expect, it } from 'vitest';
import { passengerFieldErrors } from '../../src/data/passengerValidation';
const person = {
  name: 'Ana Santos',
  type: 'Regular',
  birthDate: '1990-01-01',
  sex: 'Female',
  phone: '09171234567',
  nationality: 'Filipino',
};
describe('booking passenger input validation', () => {
  it('reports every invalid field and rejects unknown stored choices', () => {
    const errors = passengerFieldErrors(
      {
        ...person,
        name: '123',
        type: 'Unknown',
        birthDate: '2099-02-31',
        sex: 'Unknown',
        phone: '091712345678',
        nationality: '123',
      },
      ['Regular'],
    );
    expect(Object.keys(errors)).toEqual([
      'name',
      'type',
      'birthDate',
      'sex',
      'phone',
      'nationality',
    ]);
    expect(errors.phone).toContain('11 digits');
  });
  it('accepts valid passenger data including country-code phones', () => {
    expect(passengerFieldErrors(person, ['Regular'])).toEqual({});
    expect(
      passengerFieldErrors({ ...person, phone: '+639171234567', sex: 'Prefer not to say' }, [
        'Regular',
      ]),
    ).toEqual({});
  });
  it('rejects birthdays before 1900 and invalid leap days', () => {
    for (const birthDate of ['1899-12-31', '2001-02-29', '2100-01-01'])
      expect(passengerFieldErrors({ ...person, birthDate })).toHaveProperty('birthDate');
    expect(passengerFieldErrors({ ...person, birthDate: '2000-02-29' })).toEqual({});
  });
});
