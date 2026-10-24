// Pure derived data for the spending tracker. Expenses are a flat map, so every
// day/week/month/year aggregation filters on `date`.
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
export const expensesOnDate = (m: ExpensesMap, iso: ISODate) => expensesArr(m).filter(e => e.date === iso);
export const expensesInRange = (m: ExpensesMap, start: ISODate, end: ISODate) =>
  expensesArr(m).filter(e => e.date >= start && e.date <= end);
export const totalOf = (list: Expense[]) => list.reduce((s, e) => s + (num(e.price) || 0), 0);
export const dayTotal = (m: ExpensesMap, iso: ISODate) => totalOf(expensesOnDate(m, iso));
