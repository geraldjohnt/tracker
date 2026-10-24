// Everything is stored in kg; the unit toggle only affects what's rendered and
// how typed values are interpreted — never what's written to state/Firebase.
import { num } from '../shared/format';
import type { Unit } from '../shared/types';

export const KG_PER_LB = 0.45359237;

/** kg → display unit (weights and diffs alike: a pure scale factor). */
export function cw(kg: number | null | undefined, unit: Unit): number | null {
  if (kg === null || kg === undefined || !isFinite(kg)) return kg ?? null;
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

/** Typed display-unit text → kg. */
export function unitToKg(val: unknown, unit: Unit): number | null {
  const n = num(val);
  if (n === null) return null;
  return unit === 'lb' ? n * KG_PER_LB : n;
}

/** kg → editable input text: full precision in kg, 1 decimal in lb. */
export function inputValue(kg: unknown, unit: Unit): string {
  const n = num(kg);
  if (n === null) return '';
  return unit === 'lb' ? (n / KG_PER_LB).toFixed(1) : String(n);
}
