import { describe, it, expect } from 'vitest';
import {
  validEmail,
  validName,
  validPhone,
  validNationality,
  safeDestination,
} from '../../src/data/securityValidation';
describe('Security input boundaries', () => {
  it('rejects all ASCII control characters in names, nationalities and redirect destinations', () => {
    for (const code of [...Array(32).keys(), 127]) {
      const character = String.fromCharCode(code);
      expect(validName(`Ana${character}Santos`)).toBe(false);
      expect(validNationality(`Fili${character}pino`)).toBe(false);
      expect(safeDestination(`/bookings${character}?id=1`)).toBe('/home');
    }
    expect(safeDestination('/bookings with spaces')).toBe('/home');
    expect(validName('Ana Santos')).toBe(true);
    expect(validNationality('New Zealander')).toBe(true);
  });
  it('accepts international names and formatted phones while rejecting invalid bounds', () => {
    expect(validName('José 李')).toBe(true);
    expect(validName('x'.repeat(121))).toBe(false);
    expect(validName('A\u0001B')).toBe(false);
    expect(validPhone('+63 (912) 123-4567')).toBe(true);
    expect(validPhone('123')).toBe(false);
    expect(validPhone('1'.repeat(16))).toBe(false);
    expect(validNationality('Filipino')).toBe(true);
    expect(validNationality('x'.repeat(61))).toBe(false);
    expect(validEmail('a@example.invalid')).toBe(true);
    expect(validEmail('invalid')).toBe(false);
  });
  it('rejects extra local digits and invalid Philippine country-code lengths', () => {
    for (const value of [
      '091712345678',
      '0917123456',
      '12345678901',
      '0917abc4567',
      '+6309171234567',
      '+6391712345678',
      '639171234567',
    ])
      expect(validPhone(value), value).toBe(false);
    for (const value of [
      '09171234567',
      '0917 123 4567',
      '+639171234567',
      '+63 (917) 123-4567',
      '+14155552671',
    ])
      expect(validPhone(value), value).toBe(true);
  });
  it('rejects numbers and symbols in names and nationalities while allowing real name punctuation', () => {
    for (const value of ['12345', 'Ana123', '<script>', '???', '---'])
      expect(validName(value), value).toBe(false);
    for (const value of ["José O'Neill", 'Maria-Jane Santos Jr.', 'D\u2019Angelo', '\u674e\u660e'])
      expect(validName(value), value).toBe(true);
    for (const value of ['123', 'Filipino123', '!!!', 'x'.repeat(61)])
      expect(validNationality(value), value).toBe(false);
    expect(validNationality('New Zealander')).toBe(true);
  });
  it('only accepts local post-login destinations', () => {
    for (const value of [
      '//attacker.invalid',
      'https://attacker.invalid',
      '/\\attacker.invalid',
      '/\nadmin',
      {},
    ])
      expect(safeDestination(value)).toBe('/home');
    expect(safeDestination('/bookings?reference=BL-123')).toBe('/bookings?reference=BL-123');
  });
});
