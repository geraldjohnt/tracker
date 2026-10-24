import { describe, expect, it } from 'vitest';
import { cw, inputValue, unitToKg } from './units';

describe('kg/lb units', () => {
  it('stores kg, displays either', () => {
    expect(cw(1, 'kg')).toBe(1);
    expect(cw(0.45359237, 'lb')).toBeCloseTo(1);
    expect(cw(null, 'lb')).toBeNull();
  });
  it('converts typed values to kg', () => {
    expect(unitToKg('10', 'kg')).toBe(10);
    expect(unitToKg('10', 'lb')).toBeCloseTo(4.5359237);
    expect(unitToKg('', 'lb')).toBeNull();
  });
  it('formats inputs: full precision kg, 1dp lb', () => {
    expect(inputValue(82.45, 'kg')).toBe('82.45');
    expect(inputValue(unitToKg('180', 'lb'), 'lb')).toBe('180.0');
    expect(inputValue(null, 'kg')).toBe('');
  });
});
