// Achievements: lifetime milestones worked out from the quest history (nothing extra is stored,
// so past work counts). Each achievement has 10 levels with rising thresholds; the badge's
// colour follows the level (achievement badges, AchievementBadge.tsx) and its symbol the type.
import { addDays } from '../shared/dates';
import type { ISODate } from '../shared/types';
import type { Exercise } from './catalog';
import {
  dayGain, DEFAULT_TARGETS, isRestDay, levelInfo, streakDay, type DaysMap, type QuestSlot, type Targets, type WeeksMap,
} from './derive';

export const ACHIEVEMENT_LEVELS = 10;

/** How the value is shown: a count, or a duration in seconds. */
type Format = 'count' | 'seconds';

export interface AchievementDef {
  id: string;
  name: string;
  /** What is counted, e.g. "Longest streak"; shown with the value. */
  measure: string;
  /** Short line per level, e.g. "A 7-day streak": `n` is the formatted threshold, `v` the number (for plurals). */
  goal: (n: string, v: number) => string;
  /** Bootstrap Icons code point for the badge's symbol. */
  glyph: string;
  /** 1–3: how hard the achievement is overall. The hardest ones get extra ornaments on their badges. */
  difficulty: 1 | 2 | 3;
  format?: Format;
  thresholds: readonly number[];
}

/** "s" unless it's one. */
const s = (v: number) => (v === 1 ? '' : 's');

const reps = [25, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];

/** Every achievement, in the order they're shown. Each has exactly ACHIEVEMENT_LEVELS thresholds, rising. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'streak', name: 'On Fire', measure: 'Longest streak', goal: n => `A ${n}-day streak`, glyph: '', difficulty: 3,
    thresholds: [7, 14, 30, 50, 100, 500, 750, 1000, 1500, 2000] },
  { id: 'quests', name: 'Quest Master', measure: 'Quests completed', goal: (n, v) => `Complete ${n} quest${s(v)}`, glyph: '', difficulty: 1,
    thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] },
  { id: 'xp', name: 'XP Hunter', measure: 'XP earned', goal: n => `Earn ${n} XP`, glyph: '', difficulty: 2,
    thresholds: [50, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] },
  { id: 'reps', name: 'Rep Machine', measure: 'Reps done', goal: n => `Do ${n} reps`, glyph: '', difficulty: 2,
    thresholds: [50, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] },
  { id: 'hold', name: 'Iron Hold', measure: 'Time in holds', goal: n => `Hold for ${n} in total`, glyph: '', difficulty: 2, format: 'seconds',
    thresholds: [60, 300, 600, 1200, 1800, 3600, 7200, 14400, 28800, 57600] },
  { id: 'legs', name: 'Leg Day', measure: 'Leg reps', goal: n => `${n} leg reps`, glyph: '', difficulty: 1, thresholds: reps },
  { id: 'push', name: 'Push Power', measure: 'Push reps', goal: n => `${n} push reps`, glyph: '', difficulty: 1, thresholds: reps },
  { id: 'pull', name: 'Pull Strength', measure: 'Pull and back reps', goal: n => `${n} pull or back reps`, glyph: '', difficulty: 2,
    thresholds: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000] },
  { id: 'core', name: 'Core of Steel', measure: 'Core reps', goal: n => `${n} core reps`, glyph: '', difficulty: 1, thresholds: reps },
  { id: 'perfect', name: 'Perfect Day', measure: 'Days with all 3 daily quests', goal: (n, v) => `All 3 daily quests on ${n} day${s(v)}`, glyph: '', difficulty: 2,
    thresholds: [1, 7, 14, 30, 60, 100, 200, 365, 500, 1000] },
  { id: 'active', name: 'Regular', measure: 'Days active', goal: (n, v) => `Be active on ${n} day${s(v)}`, glyph: '', difficulty: 1,
    thresholds: [3, 7, 14, 30, 60, 100, 200, 365, 730, 1000] },
  { id: 'optional', name: 'Side Quester', measure: 'Optional quests completed', goal: (n, v) => `Complete ${n} optional quest${s(v)}`, glyph: '', difficulty: 1,
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000] },
  { id: 'daredevil', name: 'Daredevil', measure: 'Hard and elite optional quests', goal: (n, v) => `Complete ${n} hard or elite optional quest${s(v)}`, glyph: '', difficulty: 3,
    thresholds: [1, 3, 5, 10, 25, 50, 100, 200, 350, 500] },
  { id: 'camera', name: 'Form Check', measure: 'Camera-checked quests', goal: (n, v) => `Complete ${n} quest${s(v)} on camera`, glyph: '', difficulty: 1,
    thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] },
  { id: 'explorer', name: 'Explorer', measure: 'Different exercises done', goal: (n, v) => (v === 1 ? 'Do your first exercise' : `Do ${n} different exercises`), glyph: '', difficulty: 2,
    thresholds: [1, 3, 5, 8, 12, 16, 20, 28, 36, 48] },
  { id: 'climber', name: 'Climber', measure: 'Highest level reached', goal: n => `Reach Level ${n}`, glyph: '', difficulty: 3,
    thresholds: [1, 5, 10, 25, 50, 75, 100, 125, 175, 225] },
  { id: 'challenger', name: 'Challenger', measure: 'Weekly challenges completed', goal: (n, v) => `Complete ${n} weekly challenge${s(v)}`, glyph: '', difficulty: 3,
    thresholds: [1, 2, 4, 8, 12, 20, 30, 52, 78, 104] },
  { id: 'nodaysoff', name: 'No Days Off', measure: 'Quests done on rest days', goal: (n, v) => `Complete ${n} quest${s(v)} on rest days`, glyph: '', difficulty: 2,
    thresholds: [1, 3, 5, 10, 20, 35, 50, 75, 100, 150] },
];
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** A number or duration as shown on achievements: 1,000 · 5 min · 2 h. */
export function fmtValue(v: number, format: Format = 'count'): string {
  if (format === 'count') return v.toLocaleString('en-US');
  if (v < 60) return v + ' s';
  if (v < 3600) return Math.floor(v / 60) + ' min';
  const h = v / 3600;
  return (Number.isInteger(h) ? h : h.toFixed(1)) + ' h';
}

/** What a level asks for, e.g. "A 7-day streak" (level 1–10). */
export const goalText = (def: AchievementDef, level: number) => {
  const t = def.thresholds[level - 1];
  return def.goal(fmtValue(t, def.format), t);
};

/** The lifetime numbers every achievement is measured on. */
export type AchievementStats = Record<string, number>;

/**
 * Works out every achievement's value from the history: completed quests (at the amounts they
 * were done at), the weekly challenges, the XP ledger and the streak rule (rest days included).
 */
export function achievementStats(days: DaysMap, weeks: WeeksMap, byId: Record<string, Exercise>, targets: Targets = DEFAULT_TARGETS, today?: ISODate): AchievementStats {
  const st: AchievementStats = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, 0]));
  const seen = new Set<string>();
  /** Adds work on one exercise: reps (or seconds for holds) per category. */
  const work = (exId: string, amount: number) => {
    seen.add(exId);
    const ex = byId[exId];
    if (!ex || amount <= 0) return;
    const total = amount * (ex.perSide ? 2 : 1);
    if (ex.measure === 'seconds') { st.hold += total; return; }
    st.reps += total;
    if (ex.category === 'legs') st.legs += total;
    else if (ex.category === 'push') st.push += total;
    else if (ex.category === 'pull') st.pull += total;
    else if (ex.category === 'core') st.core += total;
  };

  const dates = Object.keys(days).sort();
  let xp = 0, peak = 0, run = 0;
  const last = today ?? dates[dates.length - 1];
  for (let d = dates[0]; d && last && d <= last; d = addDays(d, 1)) {
    const day = days[d];
    const rest = isRestDay(day, targets, d);
    if (day) {
      const gain = dayGain(day);
      st.xp += gain;
      xp = Math.max(0, xp + gain - (day.penalty ?? 0));
      peak = Math.max(peak, xp);
      const daily = Object.values(day.daily ?? {}).filter((s): s is QuestSlot => !!s?.done);
      const optional = Object.entries(day.optional ?? {}).filter((e): e is [string, QuestSlot] => !!e[1]?.done);
      for (const s of [...daily, ...optional.map(e => e[1])]) {
        st.quests++;
        if (!s.manual) st.camera++;
        if (rest) st.nodaysoff++;
        work(s.ex, s.amount ?? 0);
      }
      st.optional += optional.length;
      st.daredevil += optional.filter(([k]) => k === 'hard' || k === 'elite').length;
      if (daily.length >= 3) st.perfect++;
      if (daily.length || optional.length) st.active++;
    }
    // Longest streak, by the same rule as the live streak; today not done yet doesn't end it.
    if (streakDay(day, rest)) st.streak = Math.max(st.streak, ++run);
    else if (!rest && d !== today) run = 0;
  }
  for (const w of Object.values(weeks)) {
    const c = w.challenge;
    if (!c) continue;
    work(c.ex, (c.cam ?? 0) + (c.man ?? 0));
    if (c.done) st.challenger++;
  }
  st.explorer = seen.size;
  st.climber = levelInfo(peak).level;
  return st;
}

/** Level reached (0 = not yet) for a value. */
export const levelFor = (def: AchievementDef, value: number) => def.thresholds.filter(t => value >= t).length;

export interface AchievementProgress {
  def: AchievementDef;
  value: number;
  /** 0–10. */
  level: number;
  /** Threshold of the next level, or null at the top. */
  next: number | null;
  /** 0–1 from this level's threshold to the next one. */
  pct: number;
}

export function achievementProgress(stats: AchievementStats): AchievementProgress[] {
  return ACHIEVEMENTS.map(def => {
    const value = stats[def.id] ?? 0;
    const level = levelFor(def, value);
    const next = level < def.thresholds.length ? def.thresholds[level] : null;
    const from = level ? def.thresholds[level - 1] : 0;
    return { def, value, level, next, pct: next === null ? 1 : Math.min(1, (value - from) / (next - from)) };
  });
}

/** Achievement id → level reached; the store compares these before and after a quest. */
export function achievementLevels(days: DaysMap, weeks: WeeksMap, byId: Record<string, Exercise>, targets?: Targets, today?: ISODate): Record<string, number> {
  const stats = achievementStats(days, weeks, byId, targets, today);
  return Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, levelFor(a, stats[a.id] ?? 0)]));
}
