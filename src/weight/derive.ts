// Pure derived data for the weight tracker — computed from the weeks map on
// every render, nothing cached.
import { fmtDate } from '../shared/dates';
import { num } from '../shared/format';
import type { Participant, Week } from '../shared/types';

export type WeeksMap = Record<string, Week>;
export type Person = Participant & { id: string };

/** Fill each week's `id` from its key and default missing participants; drop null entries. */
export function normalizeWeeks(raw: Record<string, Partial<Week> | null> | null): WeeksMap {
  const out: WeeksMap = {};
  for (const [id, w] of Object.entries(raw || {})) {
    if (!w) continue;
    out[id] = { ...(w as Week), id, participants: w.participants || {} };
  }
  return out;
}

/** Newest first (by startDate, then createdAt). */
export function sortedWeeks(weeks: WeeksMap): Week[] {
  return Object.values(weeks).sort((a, b) => {
    const d = String(b.startDate || '').localeCompare(String(a.startDate || ''));
    return d !== 0 ? d : (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function peopleOf(w: Week | null | undefined): Person[] {
  if (!w || !w.participants) return [];
  return Object.keys(w.participants).map(id => {
    const p = (w.participants[id] || {}) as Partial<Participant>;
    return { id, name: p.name || '', startWeight: p.startWeight ?? null, endWeight: p.endWeight ?? null, order: p.order ?? 0 };
  }).sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
}

export interface Delta { has: boolean; diff: number | null; pct: number | null }

/** endWeight − startWeight; negative = loss. */
export function delta(p: Pick<Participant, 'startWeight' | 'endWeight'>): Delta {
  const s = num(p.startWeight), e = num(p.endWeight);
  if (s === null || e === null) return { has: false, diff: null, pct: null };
  const diff = e - s;
  return { has: true, diff, pct: s !== 0 ? (diff / s) * 100 : null };
}

export interface AllTimeRow {
  key: string;            // lower-cased trimmed name
  name: string;
  first: number | null;   // first recorded start weight
  last: number | null;    // latest end (or start) weight
  overall: number | null; // last − first
  data: Array<number | null>; // per-week delta, aligned with weekLabels
}

/**
 * Aggregate every week by case-insensitive name, oldest week first (renaming a
 * person creates a new identity). `weekLabels` holds one label per week that has
 * at least one logged delta.
 */
export function weightAllTime(weeks: WeeksMap): { rows: AllTimeRow[]; weekLabels: string[] } {
  const weeksAsc = sortedWeeks(weeks).slice().reverse();
  const agg: Record<string, { name: string; first: number | null; last: number | null }> = {};
  const weekLabels: string[] = [];
  const perWeekDiffs: Record<string, Record<string, number>> = {};

  weeksAsc.forEach(w => {
    const label = fmtDate(w.endDate || w.startDate);
    let labelUsed = false;
    peopleOf(w).forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      if (!key) return;
      if (!agg[key]) agg[key] = { name: p.name.trim(), first: null, last: null };
      const a = agg[key];
      if (a.first === null && num(p.startWeight) !== null) a.first = num(p.startWeight);
      if (num(p.endWeight) !== null) a.last = num(p.endWeight);
      else if (num(p.startWeight) !== null) a.last = num(p.startWeight);

      const d = delta(p);
      if (d.has) {
        if (!labelUsed) { weekLabels.push(label); labelUsed = true; }
        (perWeekDiffs[key] ||= {})[label] = d.diff as number;
      }
    });
  });

  const rows = Object.keys(agg).map(key => {
    const a = agg[key];
    const overall = a.first !== null && a.last !== null ? a.last - a.first : null;
    const data = weekLabels.map(l => (perWeekDiffs[key] && l in perWeekDiffs[key] ? perWeekDiffs[key][l] : null));
    return { key, name: a.name, first: a.first, last: a.last, overall, data };
  });
  return { rows, weekLabels };
}

export interface WeekStatus { key: 'live' | 'done' | 'soon' | 'open'; text: string; cls: string }

export function weekStatus(w: Week, today: string): WeekStatus {
  if (!w.startDate || !w.endDate) return { key: 'live', text: 'Active', cls: 'chip-live' };
  const people = peopleOf(w);
  const withBoth = people.filter(p => delta(p).has).length;
  if (people.length && withBoth === people.length) return { key: 'done', text: 'Completed', cls: 'chip-done' };
  if (today < w.startDate) return { key: 'soon', text: 'Upcoming', cls: 'chip-soon' };
  if (today > w.endDate) return { key: 'open', text: 'Awaiting final weights', cls: 'chip-open' };
  return { key: 'live', text: 'In progress', cls: 'chip-live' };
}

export function avatarColor(name: string): string {
  let h = 0;
  const s = String(name || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return 'linear-gradient(135deg, hsl(' + h + ' 70% 55%), hsl(' + ((h + 40) % 360) + ' 72% 46%))';
}

export function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AllTimeStat { name: string; weeks: number; net: number; best: number | null; first: number | null; last: number | null }

/** The "All time" progress table: per person (case-insensitive name), sorted by net change. */
export function allTimeStats(weeks: WeeksMap): AllTimeStat[] {
  const agg: Record<string, AllTimeStat> = {};
  sortedWeeks(weeks).slice().reverse().forEach(w => {
    peopleOf(w).forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      if (!key) return;
      const d = delta(p);
      const a = (agg[key] ||= { name: p.name.trim(), weeks: 0, net: 0, best: null, first: null, last: null });
      if (a.first === null && num(p.startWeight) !== null) a.first = num(p.startWeight);
      if (num(p.endWeight) !== null) a.last = num(p.endWeight);
      else if (num(p.startWeight) !== null) a.last = num(p.startWeight);
      if (d.has) {
        a.weeks++;
        a.net += d.diff as number;
        if (a.best === null || (d.diff as number) < a.best) a.best = d.diff;
      }
    });
  });
  return Object.values(agg).sort((a, b) => a.net - b.net);
}

/** CSV rows for export, oldest week first, in the display unit. */
export function exportRows(weeks: WeeksMap, unit: 'kg' | 'lb', cw: (kg: number | null) => number | null): string[][] {
  const rows = [['Week start', 'Week end', 'Participant', 'Start (' + unit + ')', 'Final (' + unit + ')', 'Change', 'Change %']];
  sortedWeeks(weeks).slice().reverse().forEach(w => {
    peopleOf(w).forEach(p => {
      const d = delta(p);
      const s = cw(num(p.startWeight)), e = cw(num(p.endWeight));
      rows.push([
        w.startDate || '', w.endDate || '', p.name || '',
        s === null ? '' : s.toFixed(1),
        e === null ? '' : e.toFixed(1),
        d.has ? (cw(d.diff) as number).toFixed(1) : '',
        d.has && d.pct !== null ? d.pct.toFixed(1) : '',
      ]);
    });
  });
  return rows;
}
