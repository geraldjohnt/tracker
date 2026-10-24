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
