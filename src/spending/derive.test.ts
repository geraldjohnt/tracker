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

describe('spending periods (averages use elapsed days for the current period)', async () => {
  const { monthSummary, weekSummary, yearSummary, calendarCells, expensesOnDate } = await import('./derive');
  const data = normalizeExpenses({
    a: { date: '2026-10-01', item: 'A', price: 100, createdAt: 2 },
    b: { date: '2026-10-01', item: 'B', price: 50, createdAt: 1 },
    c: { date: '2026-10-20', item: 'C', price: 30, createdAt: 3 },
    d: { date: '2026-09-15', item: 'D', price: 300, createdAt: 4 },
  });
  it('orders a day by createdAt', () => {
    expect(expensesOnDate(data, '2026-10-01').map(e => e.item)).toEqual(['B', 'A']);
  });
  it('month: current month divides by day-of-month, past by length', () => {
    const cur = monthSummary(data, '2026-10', '2026-10-20');
    expect(cur.total).toBe(180);
    expect(cur.avgPerDay).toBe(9);
    expect(cur.trackedDays).toBe(2);
    expect(cur.highest).toEqual({ day: 1, total: 150 });
    expect(monthSummary(data, '2026-09', '2026-10-20').avgPerDay).toBe(10);
  });
  it('week: Monday start, elapsed days in the current week', () => {
    const w = weekSummary(data, '2026-10-21', '2026-10-21'); // Wed
    expect(w.start).toBe('2026-10-19');
    expect(w.total).toBe(30);
    expect(w.avgPerDay).toBe(10); // Mon..Wed = 3 days
    expect(w.highest).toEqual({ date: '2026-10-20', total: 30 });
    expect(weekSummary(data, '2026-10-12', '2026-10-21').highest).toBeNull();
  });
  it('year: months and days elapsed', () => {
    const y = yearSummary(data, '2026', '2026-01-10');
    expect(y.total).toBe(480);
    expect(y.avgPerMonth).toBe(480);
    expect(y.avgPerDay).toBe(48);
    expect(yearSummary(data, '2025', '2026-01-10').avgPerDay).toBe(0);
  });
  it('builds a Monday-first calendar grid', () => {
    const cells = calendarCells('2026-10'); // Oct 1 2026 is a Thursday
    expect(cells.slice(0, 4)).toEqual([null, null, null, 1]);
    expect(cells.length % 7).toBe(0);
  });
});
