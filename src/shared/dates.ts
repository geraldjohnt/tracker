// Dates are parsed as LOCAL to avoid timezone drift (new Date('2026-01-01') is UTC midnight).
import type { ISODate } from './types';

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const p = String(s).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

export function toISO(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseDate(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const A = parseDate(a), B = parseDate(b);
  if (!A || !B) return 0;
  return Math.round((B.getTime() - A.getTime()) / 86400000);
}

/** Monday-start week, independent of locale. */
export function startOfWeek(iso: ISODate): ISODate {
  const d = parseDate(iso);
  if (!d) return '';
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function fmtDate(iso: ISODate | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
}

export function fmtRange(a: ISODate, b: ISODate): string {
  const A = parseDate(a), B = parseDate(b);
  if (!A || !B) return '—';
  const sameYear = A.getFullYear() === B.getFullYear();
  const l = A.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  const r = B.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return l + ' – ' + r;
}

/** "Oct 19 – Oct 25, 2026" (year shown once when both dates share it). */
export function fmtRangeShort(a: ISODate, b: ISODate): string {
  const A = parseDate(a), B = parseDate(b);
  if (!A || !B) return '—';
  const sameYear = A.getFullYear() === B.getFullYear();
  const l = A.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const r = B.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  return l + ' – ' + r + (sameYear ? ', ' + B.getFullYear() : '');
}

export function weekdayShort(iso: ISODate): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '—';
}

/** "YYYY-MM" → "October 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysInYear(y: string | number): number {
  const yy = Number(y);
  return (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0 ? 366 : 365;
}

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
