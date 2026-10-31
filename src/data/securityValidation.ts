function hasControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
const nameCharacters = /^[\p{L}\p{M} .,'\u2019-]+$/u;
const nationalityCharacters = /^[\p{L}\p{M} '\u2019-]+$/u;
export const mobileNumberError = 'Use 11 digits for Philippine mobile numbers, or include + and the country code.';
export function validName(value: string) {
  return value.trim().length <= 120 && !hasControlCharacters(value) && /\p{L}/u.test(value) && nameCharacters.test(value);
}
export function validPhone(value: string) {
  if (hasControlCharacters(value)) return false;
  const phone = value.trim().replace(/[-() ]/g, '');
  if (phone.startsWith('+63')) return /^\+63[89]\d{9}$/.test(phone);
  if (phone.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(phone);
  return /^0[89]\d{9}$/.test(phone);
}
export function validNationality(value: string) {
  return value.trim().length <= 60 && !hasControlCharacters(value) && /\p{L}/u.test(value) && nationalityCharacters.test(value);
}
export function validEmail(value: string) { return value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function safeDestination(value: unknown, fallback='/home') {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes(' ') || hasControlCharacters(value)) return fallback;
  return value;
}
