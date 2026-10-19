import {describe,it,expect} from 'vitest';
import {validEmail,validName,validPhone,validNationality,safeDestination} from '../../src/data/securityValidation';
describe('Security input boundaries',()=>{
  it('accepts international names and formatted phones while rejecting invalid bounds',()=>{
    expect(validName('José 李')).toBe(true);expect(validName('x'.repeat(121))).toBe(false);expect(validName('A\u0001B')).toBe(false);
    expect(validPhone('+63 (912) 123-4567')).toBe(true);expect(validPhone('123')).toBe(false);expect(validPhone('1'.repeat(16))).toBe(false);
    expect(validNationality('Filipino')).toBe(true);expect(validNationality('x'.repeat(81))).toBe(false);
    expect(validEmail('a@example.invalid')).toBe(true);expect(validEmail('invalid')).toBe(false);
  });
  it('only accepts local post-login destinations',()=>{
    for(const value of ['//attacker.invalid','https://attacker.invalid','/\\attacker.invalid','/\nadmin',{}])expect(safeDestination(value)).toBe('/home');
    expect(safeDestination('/bookings?reference=BL-123')).toBe('/bookings?reference=BL-123');
  });
});
