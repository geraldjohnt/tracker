import { describe, expect, it } from 'vitest';
import { delta, normalizeWeeks, peopleOf, sortedWeeks, weightAllTime } from './derive';

const weeks = normalizeWeeks({
  w_a: { startDate: '2026-01-01', endDate: '2026-01-08', createdAt: 1, participants: {
    p1: { name: 'Ann', startWeight: 80, endWeight: 79, order: 0 },
    p2: { name: 'bob', startWeight: 90, endWeight: null, order: 1 },
  } },
  w_b: { startDate: '2026-01-08', endDate: '2026-01-15', createdAt: 2, participants: {
    p3: { name: ' ann ', startWeight: 79, endWeight: 78.5, order: 0 },
    p4: { name: 'Bob', startWeight: 90, endWeight: 91, order: 1 },
  } },
  w_null: null,
});

describe('weight derive', () => {
  it('normalizes ids and drops null weeks', () => {
    expect(Object.keys(weeks)).toEqual(['w_a', 'w_b']);
    expect(weeks.w_a.id).toBe('w_a');
  });
  it('sorts newest first', () => {
    expect(sortedWeeks(weeks).map(w => w.id)).toEqual(['w_b', 'w_a']);
  });
  it('orders people by order then name', () => {
    expect(peopleOf(weeks.w_a).map(p => p.name)).toEqual(['Ann', 'bob']);
  });
  it('computes delta and percent', () => {
    expect(delta({ startWeight: 80, endWeight: 79 })).toEqual({ has: true, diff: -1, pct: -1.25 });
    expect(delta({ startWeight: 80, endWeight: null }).has).toBe(false);
  });
  it('aggregates all-time by case-insensitive trimmed name', () => {
    const { rows, weekLabels } = weightAllTime(weeks);
    expect(weekLabels).toHaveLength(2);
    const ann = rows.find(r => r.key === 'ann')!;
    expect(ann.first).toBe(80);
    expect(ann.last).toBe(78.5);
    expect(ann.overall).toBe(-1.5);
    expect(ann.data).toEqual([-1, -0.5]);
    const bob = rows.find(r => r.key === 'bob')!;
    expect(bob.overall).toBe(1);
    expect(bob.data).toEqual([null, 1]);
  });
});

describe('weight status / all-time stats / export', async () => {
  const { weekStatus, allTimeStats, exportRows, initials } = await import('./derive');
  it('derives week status', () => {
    expect(weekStatus(weeks.w_a, '2026-01-05').text).toBe('In progress');
    expect(weekStatus(weeks.w_a, '2025-12-31').text).toBe('Upcoming');
    expect(weekStatus(weeks.w_a, '2026-02-01').text).toBe('Awaiting final weights');
    expect(weekStatus(weeks.w_b, '2026-01-01').text).toBe('Completed');
  });
  it('aggregates all-time stats sorted by net', () => {
    const s = allTimeStats(weeks);
    expect(s.map(r => r.name)).toEqual(['Ann', 'bob']);
    expect(s[0]).toMatchObject({ weeks: 2, net: -1.5, best: -1, first: 80, last: 78.5 });
  });
  it('builds CSV rows', () => {
    const rows = exportRows(weeks, 'kg', kg => kg);
    expect(rows[0][3]).toBe('Start (kg)');
    expect(rows[1]).toEqual(['2026-01-01', '2026-01-08', 'Ann', '80.0', '79.0', '-1.0', '-1.3']);
    expect(rows).toHaveLength(5);
  });
  it('makes initials', () => {
    expect(initials('ann marie lee')).toBe('AL');
    expect(initials('bob')).toBe('BO');
    expect(initials('')).toBe('?');
  });
});
