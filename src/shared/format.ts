export function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : null;
}

/** Signed number with a real minus sign: +1.2 / −0.4 / 0.0 */
export function fmtNum(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const s = Math.abs(n).toFixed(d);
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
}

export function plain(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return n.toFixed(d);
}

/** Prices are plain numbers; the currency is a hardcoded peso sign (no currency toggle). */
export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '₱0.00';
  return '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function uid(prefix: string): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
