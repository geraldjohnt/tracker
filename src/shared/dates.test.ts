import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, parseDate, startOfWeek, toISO } from './dates';

describe('dates', () => {
  it('parses as local dates and round-trips', () => {
    expect(toISO(parseDate('2026-02-28')!)).toBe('2026-02-28');
    expect(parseDate('nope')).toBeNull();
  });
  it('adds days across month/year boundaries', () => {
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Sunday → previous Monday
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
  it('counts days between', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
  });
});
