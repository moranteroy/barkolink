import { validName, validPhone, mobileNumberError } from './securityValidation';
export function validatedProfile(name: string, phone: string) {
  const fullName = name.trim().replace(/\s+/g, ' ');
  const mobile = phone.trim().replace(/[\s()-]/g, '');
  if (!validName(fullName)) throw new Error('Enter your full name using 1 to 120 characters.');
  if (mobile && !validPhone(phone)) throw new Error(mobileNumberError);
  return { fullName, phone: mobile || null };
}
