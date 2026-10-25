function hasControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
export function validName(value: string) { return !!value.trim() && value.trim().length <= 120 && !hasControlCharacters(value); }
export function validPhone(value: string) { return /^\+?\d{7,15}$/.test(value.trim().replace(/[-()\s]/g,'')); }
export function validNationality(value: string) { return !!value.trim() && value.trim().length <= 80 && !hasControlCharacters(value); }
export function validEmail(value: string) { return value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function safeDestination(value: unknown, fallback='/home') {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes(' ') || hasControlCharacters(value)) return fallback;
  return value;
}
