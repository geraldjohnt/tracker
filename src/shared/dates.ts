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
