// Fake data for local development and tests. Dates are relative to "today" so
// every view (this week, this month, last 7 days…) has something to show.
// This is the ONLY data used outside production — see mem/rules.md.
import { addDays, startOfWeek, todayISO } from './dates';
import { SPEND_ROOT, WEIGHT_ROOT, type Expense, type Week } from './types';

export function sampleTree(today = todayISO()): Record<string, unknown> {
  const people = [
    { name: 'Sample Alex', w: 82.4, step: -0.6 },
    { name: 'Sample Bea', w: 64.1, step: -0.3 },
    { name: 'Sample Cris', w: 91.0, step: 0.2 },
  ];
  const weeks: Record<string, Omit<Week, 'id'>> = {};
  const firstStart = addDays(startOfWeek(today), -21);
  for (let i = 0; i < 4; i++) {
    const startDate = addDays(firstStart, i * 7);
    const current = i === 3;
    const participants: Week['participants'] = {};
    people.forEach((p, j) => {
      const start = +(p.w + p.step * i).toFixed(1);
      participants['p_sample' + j] = {
        name: p.name,
        startWeight: start,
        endWeight: current ? null : +(start + p.step).toFixed(1),
        order: j,
      };
    });
    weeks['w_sample' + i] = { startDate, endDate: addDays(startDate, 7), createdAt: 1700000000000 + i, participants };
  }

  const items: Array<[string, number]> = [
    ['Coffee', 140], ['Lunch', 250], ['Groceries', 1830.5], ['Jeepney fare', 26],
    ['Load', 100], ['Dinner', 420], ['Snacks', 65.75],
  ];
  const expenses: Record<string, Expense> = {};
  for (let d = 0; d < 45; d++) {
    const date = addDays(today, -d);
    const n = (d * 7) % 3; // 0–2 expenses a day, deterministic
    for (let k = 0; k < n; k++) {
      const [item, price] = items[(d + k * 3) % items.length];
      expenses[`e_sample${d}_${k}`] = { date, item, price, createdAt: 1700000000000 + (45 - d) * 10 + k };
    }
  }

  return {
    [WEIGHT_ROOT]: { settings: { unit: 'kg' }, weeks },
    [SPEND_ROOT]: { expenses },
  };
}
