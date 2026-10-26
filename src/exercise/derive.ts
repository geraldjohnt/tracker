// Pure game rules for the Exercise view: levels, ranks, quest generation, XP and
// missed-day penalties. Everything here is deterministic and unit-tested.
import { addDays, daysBetween } from '../shared/dates';
import type { ISODate } from '../shared/types';
import { CATALOG, DIFFICULTIES, MUSCLES, TRACKERS, type Difficulty, type Exercise, type TrackerKind } from './catalog';

/* ---------------- levels & ranks ---------------- */

/** XP each level needs in the first tier (Rookie 1: Levels 0–4). */
export const FIRST_LEVEL_XP = 15;
/** Every tier (5 levels) needs this much more XP per level: Rookie 1 15, Rookie 2 20, …, Mover 1 40. */
export const XP_STEP_PER_TIER = 5;
/** XP to go from `level` to the next one. */
export function xpToNext(level: number): number {
  return FIRST_LEVEL_XP + XP_STEP_PER_TIER * tierStep(level);
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level needs in total to reach the next one. */
  need: number;
  total: number;
}

/** Total XP an account needs to reach a level from 0. */
export function xpForLevel(level: number): number {
  let sum = 0;
  for (let l = 0; l < level; l++) sum += xpToNext(l);
  return sum;
}

export function levelInfo(total: number): LevelInfo {
  let level = 0;
  let left = Math.max(0, total);
  let need = xpToNext(0);
  while (left >= need) { left -= need; level++; need = xpToNext(level); }
  return { level, into: left, need, total: Math.max(0, total) };
}

/** Every 5 levels is the next tier of a rank (Rookie 1 → Rookie 2 at Level 5); 5 tiers make a rank. */
export const LEVELS_PER_TIER = 5;
export const TIERS_PER_RANK = 5;
export const LEVELS_PER_RANK = LEVELS_PER_TIER * TIERS_PER_RANK;
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

/** Tiers reached so far: one every 5 levels (Level 0–4 → 0, 5–9 → 1, …). XP per level and daily difficulty follow it. */
export const tierStep = (level: number) => Math.floor(Math.max(0, level) / LEVELS_PER_TIER);

export function rankAt(index: number, tier: number): Rank {
  const r = RANKS[index];
  return { index, name: r.name, tier, label: r.name + ' ' + tier, icon: r.icon };
}

/** Level 0–4 → Rookie 1, 5–9 → Rookie 2, …, 20–24 → Rookie 5, 25 → Mover 1. The last rank keeps counting (Legend 6, 7, …). */
export function rankOf(level: number): Rank {
  const step = tierStep(level);
  const index = Math.min(Math.floor(step / TIERS_PER_RANK), RANKS.length - 1);
  return rankAt(index, step - index * TIERS_PER_RANK + 1);
}

/** First level of a rank's tier (tier 1–5). */
export const rankLevel = (index: number, tier: number) => (index * TIERS_PER_RANK + tier - 1) * LEVELS_PER_TIER;

/** The level of the next tier up, and its rank. */
export function nextRank(level: number): { level: number; rank: Rank } {
  const next = (tierStep(level) + 1) * LEVELS_PER_TIER;
  return { level: next, rank: rankOf(next) };
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

/** XP for a quest: the difficulty's base XP, +10% per rank (Mover +10%, Grinder +20%, …), rounded up. */
export function questXp(difficulty: Difficulty, level: number, kind: QuestKind): number {
  const info = DIFFICULTY_INFO[difficulty];
  const base = kind === 'daily' ? info.dailyXp : info.optionalXp;
  return Math.ceil((base * (10 + rankOf(level).index)) / 10);
}

/**
 * XP for a quest completed without the camera (no camera, or camera access denied): half
 * the quest's XP, rounded down. Camera-checked quests get the full amount.
 */
export const manualXp = (xp: number) => Math.floor(xp / 2);

/** Hardest difficulty daily quests may use: easy until Level 10, medium from 10, hard from 20, elite from 30. */
export function maxDailyDifficulty(level: number): Difficulty {
  return DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.floor(tierStep(level) / 2))];
}

export const DAILY_SLOTS = ['q0', 'q1', 'q2'] as const;
export type DailySlot = (typeof DAILY_SLOTS)[number];

/* ---------------- weekly targets ---------------- */

/** What a day's daily quests train. */
export const FOCUSES = ['legs', 'upper', 'core', 'full'] as const;
export type Focus = (typeof FOCUSES)[number];
export const FOCUS_INFO: Record<Focus, { label: string; short: string; icon: string; note: string }> = {
  legs: { label: 'Legs', short: 'Legs', icon: 'bi-person-walking', note: 'Squats, lunges, bridges' },
  upper: { label: 'Upper body', short: 'Upper', icon: 'bi-arrow-up-circle', note: 'Push-ups and back work' },
  core: { label: 'Core', short: 'Core', icon: 'bi-bullseye', note: 'Planks, crunches, holds' },
  full: { label: 'Full body', short: 'Full', icon: 'bi-lightning-charge', note: 'One legs, one upper, one core' },
};
/** Daily quest slots per focus. Bodyweight only: equipment is for optional quests. */
const FOCUS_SLOTS: Record<Focus, Record<DailySlot, Exercise['category'][]>> = {
  legs: { q0: ['legs'], q1: ['legs'], q2: ['legs', 'full'] },
  upper: { q0: ['push'], q1: ['pull'], q2: ['push', 'pull'] },
  core: { q0: ['core'], q1: ['core'], q2: ['core', 'full'] },
  full: { q0: ['legs'], q1: ['push', 'pull'], q2: ['core', 'full'] },
};

/** Weekdays, Monday first (weeks start on Monday everywhere in the app). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
export type Targets = Record<Weekday, Focus>;
/** The plan every account starts with; each day can be changed in the weekly plan. */
export const DEFAULT_TARGETS: Targets = { mon: 'legs', tue: 'upper', wed: 'core', thu: 'legs', fri: 'upper', sat: 'core', sun: 'full' };

/** mon…sun for a local ISO date. */
export function weekdayOf(date: ISODate): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
}

export const focusOn = (targets: Targets, date: ISODate): Focus => targets[weekdayOf(date)];

/** Stored targets (`settings/targets`) over the defaults; anything unknown is ignored. */
export function normalizeTargets(v: unknown): Targets {
  const out = { ...DEFAULT_TARGETS };
  if (v && typeof v === 'object') {
    for (const wd of WEEKDAYS) {
      const f = (v as Record<string, unknown>)[wd];
      if ((FOCUSES as readonly unknown[]).includes(f)) out[wd] = f as Focus;
    }
  }
  return out;
}

export interface QuestSlot {
  ex: string;
  /** Optional quests only: when it was accepted. */
  accepted?: number;
  /** When it was completed, and what it was worth at the time. */
  done?: number;
  amount?: number;
  xp?: number;
  /** Completed without the camera, for half XP. */
  manual?: boolean;
}

export interface DayRecord {
  /** The target the daily quests were picked for. */
  focus?: Focus;
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

/** Today's 3 daily quests for a focus, bodyweight only, no exercise twice when the pool allows it. */
export function generateDaily(level: number, seed: string, focus: Focus, catalog: Exercise[] = CATALOG): NonNullable<DayRecord['daily']> {
  const rnd = seededRandom(seed + ':' + focus);
  const allowed = DIFFICULTIES.slice(0, DIFFICULTIES.indexOf(maxDailyDifficulty(level)) + 1);
  const daily: DayRecord['daily'] = {};
  const used = new Set<string>();
  for (const slot of DAILY_SLOTS) {
    const fits = (e: Exercise) => FOCUS_SLOTS[focus][slot].includes(e.category) && e.equipment === 'none';
    let pool = (d: Difficulty) => catalog.filter(e => e.difficulty === d && fits(e) && !used.has(e.id));
    if (!allowed.some(d => pool(d).length)) pool = d => catalog.filter(e => e.difficulty === d && fits(e));
    const tiers = allowed.filter(d => pool(d).length);
    const ex = tiers.length ? pickFrom(pool(pickFrom(tiers, rnd)), rnd) : pickFrom(catalog, rnd);
    used.add(ex.id);
    daily[slot] = { ex: ex.id };
  }
  return daily;
}

/** The quests offered on a day: 3 daily for the day's focus and one optional per difficulty. */
export function generateDay(level: number, seed: string, catalog: Exercise[] = CATALOG, focus: Focus = 'full'): Required<Pick<DayRecord, 'daily' | 'optional' | 'focus'>> {
  const daily = generateDaily(level, seed, focus, catalog);
  const rnd = seededRandom(seed);
  const optional: DayRecord['optional'] = {};
  for (const d of DIFFICULTIES) {
    const pool = catalog.filter(e => e.difficulty === d);
    if (pool.length) optional[d] = { ex: pickFrom(pool, rnd).id };
  }
  return { focus, daily, optional };
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
export function settle(days: DaysMap, profile: Profile, today: ISODate, uid: string, catalog: Exercise[] = CATALOG, targets: Targets = DEFAULT_TARGETS): Settlement {
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
    const quests = day?.daily ? day : generateDay(level, daySeed(uid, date), catalog, focusOn(targets, date));
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
  if (v.manual === true) s.manual = true;
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
    if ((FOCUSES as readonly unknown[]).includes(d.focus)) day.focus = d.focus as Focus;
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
      ...((TRACKERS as readonly unknown[]).includes(e.tracker) ? { tracker: e.tracker as TrackerKind } : {}),
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

/* ---------------- ranking board ---------------- */

/** One participant on the shared ranking board (`leaderboard/<uid>`). Only accounts that opt in have one. */
export interface BoardEntry {
  uid: string; // from the key; not stored
  username: string;
  level: number;
  xp: number;
  joinedAt: number;
  updatedAt?: number;
}

export function normalizeBoard(v: unknown): BoardEntry[] {
  if (!isObj(v)) return [];
  const out: BoardEntry[] = [];
  for (const [uid, e] of Object.entries(v)) {
    if (!isObj(e) || typeof e.username !== 'string') continue;
    out.push({ uid, username: e.username, level: numOr(e.level) ?? 0, xp: numOr(e.xp) ?? 0, joinedAt: numOr(e.joinedAt) ?? 0, updatedAt: numOr(e.updatedAt) });
  }
  return out;
}

/** Highest level first; ties go to more total XP, then to whoever joined first. Equal level and XP share a place. */
export function rankBoard(entries: BoardEntry[]): Array<BoardEntry & { place: number }> {
  const sorted = [...entries].sort((a, b) => b.level - a.level || b.xp - a.xp || a.joinedAt - b.joinedAt || a.username.localeCompare(b.username));
  let place = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.level !== sorted[i - 1].level || e.xp !== sorted[i - 1].xp) place = i + 1;
    return { ...e, place };
  });
}
