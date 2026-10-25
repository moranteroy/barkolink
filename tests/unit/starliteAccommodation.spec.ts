import { describe, expect, it } from 'vitest';
import { starliteVesselCode } from '../../src/data/starliteAccommodation';
describe('Starlite vessel codes', () => {
  it('uses a consistent prefix without repeating vessel name prefixes', () => {
    expect(starliteVesselCode('MV Starlite Annapolis')).toBe('SL-ANNAPOLIS');
    expect(starliteVesselCode('MV SWM Stella del Mar')).toBe('SL-STELLA-DEL-MAR');
    expect(starliteVesselCode('M/V Starlite Sprint 1')).toBe('SL-SPRINT-1');
    expect(starliteVesselCode('')).toBe('');
  });
});
