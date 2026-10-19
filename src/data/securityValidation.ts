const controls = /[\u0000-\u001f\u007f]/;
export function validName(value: string) { return !!value.trim() && value.trim().length <= 120 && !controls.test(value); }
export function validPhone(value: string) { return /^\+?\d{7,15}$/.test(value.trim().replace(/[-()\s]/g,'')); }
export function validNationality(value: string) { return !!value.trim() && value.trim().length <= 80 && !controls.test(value); }
export function validEmail(value: string) { return value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function safeDestination(value: unknown, fallback='/home') {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  return value;
}
