// Pure game rules for the Exercise view: levels, ranks, quest generation, XP and
// missed-day penalties. Everything here is deterministic and unit-tested.
import { addDays, daysBetween } from '../shared/dates';
import type { ISODate } from '../shared/types';
import { CATALOG, DIFFICULTIES, MUSCLES, type Difficulty, type Exercise } from './catalog';

/* ---------------- levels & ranks ---------------- */

/** XP needed to go from level 0 to level 1. */
export const FIRST_LEVEL_XP = 20;
/** Each level needs 10% more XP than the one before, rounded up to a whole number. */
export function xpToNext(level: number): number {
  let need = FIRST_LEVEL_XP;
  // Integer maths: need*11 is a whole number, so /10 never produces 22.000000000000004.
  for (let i = 0; i < level; i++) need = Math.ceil((need * 11) / 10);
  return need;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level needs in total to reach the next one. */
  need: number;
  total: number;
}

export function levelInfo(total: number): LevelInfo {
  let level = 0;
  let left = Math.max(0, total);
  let need = xpToNext(0);
  while (left >= need) { left -= need; level++; need = Math.ceil((need * 11) / 10); }
  return { level, into: left, need, total: Math.max(0, total) };
}

export const LEVELS_PER_RANK = 5;
export const RANKS = [
  { name: 'Rookie', icon: 'bi-person-arms-up' },
  { name: 'Mover', icon: 'bi-person-walking' },
  { name: 'Grinder', icon: 'bi-lightning-charge' },
  { name: 'Athlete', icon: 'bi-fire' },
  { name: 'Warrior', icon: 'bi-shield' },
  { name: 'Gladiator', icon: 'bi-shield-shaded' },
  { name: 'Spartan', icon: 'bi-award' },
  { name: 'Titan', icon: 'bi-gem' },
  { name: 'Olympian', icon: 'bi-trophy' },
  { name: 'Legend', icon: 'bi-stars' },
] as const;

export interface Rank { index: number; name: string; tier: number; label: string; icon: string }

/** Level 0–4 → Rookie 1–5, 5–9 → Mover 1–5, … The last rank keeps counting (Legend 6, 7, …). */
export function rankOf(level: number): Rank {
  const index = Math.min(Math.floor(level / LEVELS_PER_RANK), RANKS.length - 1);
  const tier = level - index * LEVELS_PER_RANK + 1;
  const r = RANKS[index];
  return { index, name: r.name, tier, label: r.name + ' ' + tier, icon: r.icon };
}

/* ---------------- quests ---------------- */

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; dailyXp: number; optionalXp: number; amountMult: number }> = {
  easy: { label: 'Easy', dailyXp: 5, optionalXp: 8, amountMult: 1 },
  medium: { label: 'Medium', dailyXp: 8, optionalXp: 15, amountMult: 1.25 },
  hard: { label: 'Hard', dailyXp: 12, optionalXp: 30, amountMult: 1.5 },
  elite: { label: 'Elite', dailyXp: 20, optionalXp: 50, amountMult: 2 },
};

export type QuestKind = 'daily' | 'optional';

/** Reps (or seconds) a quest needs at a level: base + perLevel × level, scaled up for optional quests. */
export function questAmount(ex: Exercise, level: number, kind: QuestKind): number {
  const amount = ex.base + ex.perLevel * level;
  return kind === 'daily' ? amount : Math.ceil(amount * DIFFICULTY_INFO[ex.difficulty].amountMult);
}

/** XP for a quest: the difficulty's base XP, +10% per rank, rounded up. */
export function questXp(difficulty: Difficulty, level: number, kind: QuestKind): number {
  const info = DIFFICULTY_INFO[difficulty];
  const base = kind === 'daily' ? info.dailyXp : info.optionalXp;
  return Math.ceil((base * (10 + rankOf(level).index)) / 10);
}

/** Hardest difficulty daily quests may use: Rookie/Mover easy, Grinder/Athlete medium, Warrior/Gladiator hard, then elite. */
export function maxDailyDifficulty(level: number): Difficulty {
  return DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.floor(rankOf(level).index / 2))];
}

export const DAILY_SLOTS = ['q0', 'q1', 'q2'] as const;
export type DailySlot = (typeof DAILY_SLOTS)[number];
/** Daily quest slots: one legs, one upper body, one core. */
const SLOT_CATEGORIES: Record<DailySlot, Exercise['category'][]> = { q0: ['legs'], q1: ['push', 'pull'], q2: ['core', 'full'] };
const HOME_EQUIPMENT: Exercise['equipment'][] = ['none', 'wall', 'chair'];

export interface QuestSlot {
  ex: string;
  /** Optional quests only: when it was accepted. */
  accepted?: number;
  /** When it was completed, and what it was worth at the time. */
  done?: number;
  amount?: number;
  xp?: number;
}

export interface DayRecord {
  daily?: Partial<Record<DailySlot, QuestSlot>>;
  optional?: Partial<Record<Difficulty, QuestSlot>>;
  /** XP taken away because no daily quest was completed that day. */
  penalty?: number;
}
export type DaysMap = Record<ISODate, DayRecord>;

export interface Profile {
  /** First day the account opened Exercise. Missed days count from here. */
  startDate?: ISODate;
  /** Days up to and including this one have had their missed-day penalty settled. */
  settledThrough?: ISODate;
}

/** A small seeded PRNG (mulberry32) so every device picks the same quests for a day. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickFrom = <T,>(list: T[], rnd: () => number): T => list[Math.floor(rnd() * list.length)];

/** The quests offered on a day: 3 daily (legs, upper, core) and one optional per difficulty. */
export function generateDay(level: number, seed: string, catalog: Exercise[] = CATALOG): Required<Pick<DayRecord, 'daily' | 'optional'>> {
  const rnd = seededRandom(seed);
  const max = DIFFICULTIES.indexOf(maxDailyDifficulty(level));
  const daily: DayRecord['daily'] = {};
  for (const slot of DAILY_SLOTS) {
    const allowed = DIFFICULTIES.slice(0, max + 1);
    const pool = (d: Difficulty) => catalog.filter(e => e.difficulty === d && SLOT_CATEGORIES[slot].includes(e.category) && HOME_EQUIPMENT.includes(e.equipment));
    const tiers = allowed.filter(d => pool(d).length);
    const tier = tiers.length ? pickFrom(tiers, rnd) : null;
    const ex = tier ? pickFrom(pool(tier), rnd) : pickFrom(catalog, rnd);
    daily[slot] = { ex: ex.id };
  }
  const optional: DayRecord['optional'] = {};
  for (const d of DIFFICULTIES) {
    const pool = catalog.filter(e => e.difficulty === d);
    if (pool.length) optional[d] = { ex: pickFrom(pool, rnd).id };
  }
  return { daily, optional };
}

export const daySeed = (uid: string, date: ISODate) => uid + ':' + date;

/* ---------------- XP ledger ---------------- */

const slotsOf = (day: DayRecord | undefined): QuestSlot[] =>
  [...Object.values(day?.daily ?? {}), ...Object.values(day?.optional ?? {})].filter((s): s is QuestSlot => !!s);

/** XP earned on a day (completed quests, at the value they had when completed). */
export function dayGain(day: DayRecord | undefined): number {
  return slotsOf(day).reduce((sum, s) => sum + (s.done ? s.xp ?? 0 : 0), 0);
}

/** At least one daily quest was completed; only then is the day safe from the penalty. */
export const dailyDone = (day: DayRecord | undefined) => Object.values(day?.daily ?? {}).some(s => !!s?.done);

/** What the 3 daily quests are worth at a level: the amount a missed day costs. */
export function dailyXpTotal(day: DayRecord | undefined, level: number, byId: Record<string, Exercise>): number {
  return DAILY_SLOTS.reduce((sum, slot) => {
    const ex = day?.daily?.[slot] && byId[day.daily[slot]!.ex];
    return sum + questXp(ex ? ex.difficulty : 'easy', level, 'daily');
  }, 0);
}

/** Total XP from the ledger: each day adds its gains, then loses its penalty, never going below 0. */
export function totalXp(days: DaysMap, before?: ISODate): number {
  let xp = 0;
  for (const date of Object.keys(days).sort()) {
    if (before && date >= before) break;
    xp = Math.max(0, xp + dayGain(days[date]) - (days[date].penalty ?? 0));
  }
  return xp;
}

export interface Settlement {
  /** update() patch relative to the tracker root; null when there's nothing to settle. */
  patch: Record<string, unknown> | null;
  missedDays: number;
  xpLost: number;
}

/**
 * Settles every finished day since the last settlement: a day with no completed daily
 * quest costs that day's daily XP (at the level the account had then), capped at the XP
 * the account has, so a Level 0 account with 0 XP loses nothing.
 */
export function settle(days: DaysMap, profile: Profile, today: ISODate, uid: string, catalog: Exercise[] = CATALOG): Settlement {
  const yesterday = addDays(today, -1);
  const start = profile.startDate ?? today;
  const from = profile.settledThrough && profile.settledThrough >= start ? addDays(profile.settledThrough, 1) : start;
  if (from > yesterday) return { patch: null, missedDays: 0, xpLost: 0 };

  const byId = Object.fromEntries(catalog.map(e => [e.id, e]));
  const patch: Record<string, unknown> = {};
  let xp = totalXp(days, from);
  let missedDays = 0;
  let xpLost = 0;
  for (let i = 0, n = daysBetween(from, yesterday); i <= n; i++) {
    const date = addDays(from, i);
    const day = days[date];
    xp += dayGain(day);
    if (day?.penalty) { xp = Math.max(0, xp - day.penalty); continue; } // already settled (e.g. on another device)
    if (dailyDone(day)) continue;
    missedDays++;
    const level = levelInfo(xp).level;
    const quests = day?.daily ? day : generateDay(level, daySeed(uid, date), catalog);
    const penalty = Math.min(xp, dailyXpTotal(quests, level, byId));
    if (penalty > 0) { patch['days/' + date + '/penalty'] = penalty; xp -= penalty; xpLost += penalty; }
  }
  patch['profile/settledThrough'] = yesterday;
  return { patch, missedDays, xpLost };
}

/** Consecutive days with at least one daily quest done, ending today (or yesterday if today isn't done yet). */
export function streak(days: DaysMap, today: ISODate): number {
  let d = dailyDone(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (dailyDone(days[d])) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------------- snapshot normalization ---------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object';
const numOr = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined);

function normSlot(v: unknown): QuestSlot | undefined {
  if (!isObj(v) || typeof v.ex !== 'string') return undefined;
  const s: QuestSlot = { ex: v.ex };
  for (const k of ['accepted', 'done', 'amount', 'xp'] as const) { const n = numOr(v[k]); if (n !== undefined) s[k] = n; }
  return s;
}

export function normalizeDays(v: unknown): DaysMap {
  const out: DaysMap = {};
  if (!isObj(v)) return out;
  for (const [date, d] of Object.entries(v)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isObj(d)) continue;
    const day: DayRecord = {};
    if (isObj(d.daily)) {
      day.daily = {};
      for (const slot of DAILY_SLOTS) { const s = normSlot(d.daily[slot]); if (s) day.daily[slot] = s; }
    }
    if (isObj(d.optional)) {
      day.optional = {};
      for (const k of DIFFICULTIES) { const s = normSlot(d.optional[k]); if (s) day.optional[k] = s; }
    }
    const p = numOr(d.penalty);
    if (p) day.penalty = p;
    out[date] = day;
  }
  return out;
}

export function normalizeProfile(v: unknown): Profile {
  if (!isObj(v)) return {};
  const p: Profile = {};
  if (typeof v.startDate === 'string') p.startDate = v.startDate;
  if (typeof v.settledThrough === 'string') p.settledThrough = v.settledThrough;
  return p;
}

/** Firebase returns arrays as arrays, or as {0:…,1:…} objects; MemoryBackend always as objects. */
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : isObj(v) ? Object.keys(v).sort((a, b) => +a - +b).map(k => v[k]) : []);
const strings = (v: unknown) => list(v).filter((s): s is string => typeof s === 'string');

/** The catalog as stored at `exercises/`, or null if it's missing or malformed. */
export function normalizeCatalog(v: unknown): { version: number; items: Exercise[] } | null {
  if (!isObj(v) || typeof v.version !== 'number' || !isObj(v.items)) return null;
  const items: Exercise[] = [];
  for (const [id, e] of Object.entries(v.items)) {
    if (!isObj(e) || typeof e.name !== 'string' || !DIFFICULTIES.includes(e.difficulty as Difficulty)) continue;
    const muscles = (m: unknown) => strings(m).filter(x => (MUSCLES as readonly string[]).includes(x)) as Exercise['primary'];
    items.push({
      id, name: e.name, variant: String(e.variant ?? ''),
      category: (e.category as Exercise['category']) ?? 'full',
      difficulty: e.difficulty as Difficulty,
      measure: e.measure === 'seconds' ? 'seconds' : 'reps',
      base: numOr(e.base) ?? 10, perLevel: numOr(e.perLevel) ?? 1,
      perSide: e.perSide === true,
      gender: e.gender === 'female' || e.gender === 'male' ? e.gender : 'any',
      equipment: (e.equipment as Exercise['equipment']) ?? 'none',
      primary: muscles(e.primary), secondary: muscles(e.secondary),
      summary: String(e.summary ?? ''), steps: strings(e.steps), form: strings(e.form), mistakes: strings(e.mistakes),
      easier: String(e.easier ?? ''),
    });
  }
  const order = new Map(CATALOG.map((e, i) => [e.id, i]));
  items.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || a.name.localeCompare(b.name));
  return { version: v.version, items };
}

/** The catalog as written to `exercises/` (no `id` inside items; the key is the id). */
export function catalogRecord(version: number, catalog: Exercise[]): Obj {
  const items: Obj = {};
  for (const { id, ...rest } of catalog) items[id] = rest;
  return { version, items };
}
