import { describe, expect, it } from 'vitest';
import { dayTotal, expensesInRange, normalizeExpenses, totalOf } from './derive';

const m = normalizeExpenses({
  e1: { date: '2026-03-01', item: 'Coffee', price: 140, createdAt: 1 },
  e2: { date: '2026-03-01', item: 'Lunch', price: 250.5, createdAt: 2 },
  e3: { date: '2026-03-05', item: 'Load', price: null, createdAt: 3 },
  e4: { item: 'no date', price: 1, createdAt: 4 },
  e5: null,
});

describe('spending derive', () => {
  it('drops invalid entries and fills ids', () => {
    expect(Object.keys(m)).toEqual(['e1', 'e2', 'e3']);
    expect(m.e1.id).toBe('e1');
  });
  it('totals by day and range, treating null prices as 0', () => {
    expect(dayTotal(m, '2026-03-01')).toBe(390.5);
    expect(totalOf(expensesInRange(m, '2026-03-01', '2026-03-31'))).toBe(390.5);
    expect(expensesInRange(m, '2026-03-02', '2026-03-05')).toHaveLength(1);
  });
});
