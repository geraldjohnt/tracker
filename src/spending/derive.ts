// Pure derived data for the spending tracker. Expenses are a flat map, so every
// day/week/month/year aggregation filters on `date`.
//
// Averages: for the period containing today, divide by days/months elapsed so far
// (e.g. this month's avg/day divides by today's day-of-month); for past/future
// periods divide by the full period length.
import { addDays, daysBetween, daysInMonth, daysInYear, startOfWeek } from '../shared/dates';
import { num } from '../shared/format';
import type { Expense, ISODate } from '../shared/types';

export type ExpensesMap = Record<string, Expense>;

/** Fill `id` from the key; drop null or date-less entries. */
export function normalizeExpenses(raw: Record<string, Partial<Expense> | null> | null): ExpensesMap {
  const out: ExpensesMap = {};
  for (const [id, e] of Object.entries(raw || {})) {
    if (!e || !e.date) continue;
    out[id] = { ...(e as Expense), id };
  }
  return out;
}

export const expensesArr = (m: ExpensesMap) => Object.values(m);
/** A day's expenses in the order they were added. */
export const expensesOnDate = (m: ExpensesMap, iso: ISODate) =>
  expensesArr(m).filter(e => e.date === iso).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const expensesInRange = (m: ExpensesMap, start: ISODate, end: ISODate) =>
  expensesArr(m).filter(e => e.date >= start && e.date <= end);
export const totalOf = (list: Expense[]) => list.reduce((s, e) => s + (num(e.price) || 0), 0);
export const dayTotal = (m: ExpensesMap, iso: ISODate) => totalOf(expensesOnDate(m, iso));

const pad2 = (n: number) => String(n).padStart(2, '0');
const maxIndex = (xs: number[]) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

export function monthSummary(m: ExpensesMap, ym: string, today: ISODate) {
  const dim = daysInMonth(ym);
  const days = Array.from({ length: dim }, (_, i) => ym + '-' + pad2(i + 1));
  const totals = days.map(d => dayTotal(m, d));
  const total = totals.reduce((a, b) => a + b, 0);
  const daysCounted = ym === today.slice(0, 7) ? Number(today.slice(8, 10)) : dim;
  const hi = maxIndex(totals);
  return {
    days, totals, total, dim,
    avgPerDay: total / daysCounted,
    trackedDays: totals.filter(t => t > 0).length,
    highest: totals[hi] > 0 ? { day: hi + 1, total: totals[hi] } : null,
  };
}

export function weekSummary(m: ExpensesMap, anchor: ISODate, today: ISODate) {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const totals = days.map(d => dayTotal(m, d));
  const total = totals.reduce((a, b) => a + b, 0);
  const daysCounted = today >= start && today <= end ? daysBetween(start, today) + 1 : 7;
  const hi = maxIndex(totals);
  return { start, end, days, totals, total, avgPerDay: total / daysCounted, highest: totals[hi] > 0 ? { date: days[hi], total: totals[hi] } : null };
}

export function yearSummary(m: ExpensesMap, y: string, today: ISODate) {
  const months = Array.from({ length: 12 }, (_, i) => y + '-' + pad2(i + 1));
  const totals = months.map(ym => totalOf(expensesInRange(m, ym + '-01', ym + '-' + pad2(daysInMonth(ym)))));
  const total = totals.reduce((a, b) => a + b, 0);
  const current = y === today.slice(0, 4);
  const monthsCounted = current ? Number(today.slice(5, 7)) : 12;
  const daysCounted = current ? daysBetween(y + '-01-01', today) + 1 : daysInYear(y);
  return { months, totals, total, avgPerMonth: total / monthsCounted, avgPerDay: total / daysCounted };
}

/** Month grid cells (Monday-first), null for padding. */
export function calendarCells(ym: string): Array<number | null> {
  const [y, mo] = ym.split('-').map(Number);
  const startDow = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
  const cells: Array<number | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(ym); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
