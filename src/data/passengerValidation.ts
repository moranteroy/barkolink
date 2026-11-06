import { validName, validPhone, validNationality, mobileNumberError } from './securityValidation';
import { validBirthDate } from './travelDate';
export type PassengerField = 'name' | 'type' | 'birthDate' | 'sex' | 'phone' | 'nationality';
export type PassengerInput = {
  name: string;
  type?: string;
  birthDate: string;
  sex: string;
  phone: string;
  nationality: string;
};
export function passengerFieldErrors(person: PassengerInput, passengerTypes?: string[]) {
  const errors: Partial<Record<PassengerField, string>> = {};
  if (!validName(person.name))
    errors.name =
      'Enter a full name using letters, spaces, apostrophes, periods or hyphens (up to 120 characters).';
  if (passengerTypes && !passengerTypes.includes(person.type || ''))
    errors.type = 'Choose an available passenger type for this sailing.';
  if (!validBirthDate(person.birthDate))
    errors.birthDate = 'Enter a valid birth date from 1900 to today.';
  if (!['Male', 'Female', 'Other', 'Prefer not to say'].includes(person.sex))
    errors.sex = 'Choose a sex from the list.';
  if (!validPhone(person.phone)) errors.phone = mobileNumberError;
  if (!validNationality(person.nationality))
    errors.nationality =
      'Enter a nationality using letters, spaces, apostrophes or hyphens (up to 60 characters).';
  return errors;
}
