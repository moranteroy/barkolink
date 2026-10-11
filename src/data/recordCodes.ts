const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomToken(length: number, characters: string): string {
  const limit = Math.floor(256 / characters.length) * characters.length;
  let result = '';
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte < limit && result.length < length) result += characters[byte % characters.length];
    }
  }
  return result;
}
export function bookingReference(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `BKG${part('year')}-${part('month')}${part('day')}${randomToken(12, '0123456789')}`;
}
export function voucherCode(): string {
  let token: string;
  do { token = randomToken(16, alphabet); } while (!/[A-Z]/.test(token) || !/[0-9]/.test(token));
  return `VCH-${token}`;
}
