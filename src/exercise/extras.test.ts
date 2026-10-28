// Phase 9 rules: rest days, the streak bonus, the weekly challenge and achievements.
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_LEVELS, ACHIEVEMENTS, achievementLevels, achievementProgress, achievementStats, fmtValue, levelFor } from './achievements';
import { LEVEL_COLORS } from './AchievementBadge';
import { CATALOG, CATALOG_BY_ID } from './catalog';
import {
  challengeReward, challengeXp, CHALLENGE_DAYS, DEFAULT_TARGETS, exerciseSummary, generateChallenge, generateDay, isRestDay, MAX_REST_DAYS,
  maxDailyDifficulty, normalizeDays, normalizeTargets, normalizeWeeks, questAmount, restDays, settle, streak, streakBonusPct, streakBonusXp,
  streakWithToday, totalXp, type DaysMap, type Targets,
} from './derive';

const done = (xp: number, ex = 'air-squat', amount = 10) => ({ ex, done: 1, amount, xp });
const dailyDay = (xp = 5) => ({ focus: 'legs' as const, daily: { q0: done(xp) } });
// 2026-10-26 is a Monday; Sunday 2026-11-01 is the default rest day.

describe('rest days', () => {
  it('Sunday is the default rest day, at most 3 a week', () => {
    expect(DEFAULT_TARGETS.sun).toBe('rest');
    expect(restDays(DEFAULT_TARGETS)).toBe(1);
    expect(normalizeTargets({ mon: 'rest', tue: 'rest' })).toMatchObject({ mon: 'rest', tue: 'rest', sun: 'rest' });
    // Three stored rest days: the default Sunday gives way.
    const t = normalizeTargets({ mon: 'rest', tue: 'rest', wed: 'rest' });
    expect(restDays(t)).toBe(MAX_REST_DAYS);
    expect(t.sun).toBe('full');
  });

  it('have no daily quests, only optional ones', () => {
    const day = generateDay(0, 'u1:2026-11-01', CATALOG, 'rest');
    expect(day.focus).toBe('rest');
    expect(day.daily).toEqual({});
    expect(Object.keys(day.optional)).toHaveLength(4);
  });

  it('are never penalised', () => {
    const days: DaysMap = { '2026-10-31': { daily: { q0: done(100) } } };
    const s = settle(days, { startDate: '2026-10-31', settledThrough: '2026-10-31' }, '2026-11-03', 'u1');
    expect(s.missedDays).toBe(1); // Monday the 2nd; Sunday the 1st is a rest day
    expect(s.patch!['days/2026-11-01/penalty']).toBeUndefined();
    expect(s.patch!['days/2026-11-02/penalty']).toBeGreaterThan(0);
    // A stored rest focus wins over the plan.
    const t: Targets = { ...DEFAULT_TARGETS, sun: 'legs' };
    expect(isRestDay({ focus: 'rest' }, t, '2026-11-01')).toBe(true);
    expect(isRestDay(undefined, t, '2026-11-01')).toBe(false);
  });

  it("don't break the streak, and count when a quest is done on them", () => {
    const days: DaysMap = { '2026-10-30': dailyDay(), '2026-10-31': dailyDay(), '2026-11-01': { focus: 'rest' }, '2026-11-02': dailyDay() };
    expect(streak(days, '2026-11-02')).toBe(3); // Fri, Sat, (rest), Mon
    expect(streak(days, '2026-11-01')).toBe(2); // today is the rest day, nothing done: still 2
    const active = { ...days, '2026-11-01': { focus: 'rest' as const, optional: { easy: { ex: 'air-squat', accepted: 1, done: 1, amount: 10, xp: 8 } } } };
    expect(streak(active, '2026-11-02')).toBe(4);
    expect(streak(active, '2026-11-01')).toBe(3);
    // An optional quest on a training day doesn't count.
    const training = { ...days, '2026-10-31': { focus: 'full' as const, optional: { easy: { ex: 'air-squat', accepted: 1, done: 1, xp: 8 } } } };
    expect(streak(training, '2026-11-02')).toBe(1);
    // A missed training day before the rest day ends it.
    expect(streak({ '2026-10-30': dailyDay(), '2026-11-01': {}, '2026-11-02': dailyDay() }, '2026-11-02')).toBe(1);
  });

  it('show on the dashboard summary as safe, with nothing at risk', () => {
    const s = exerciseSummary({ '2026-10-31': dailyDay(60), '2026-11-01': { focus: 'rest' } }, { startDate: '2026-10-31', settledThrough: '2026-10-31' },
      DEFAULT_TARGETS, '2026-11-01', 'u1');
    expect(s).toMatchObject({ rest: true, safe: true, atRisk: 0, doneCount: 0, streak: 1 });
  });
});

describe('streak bonus', () => {
  it('+10% from 7 days, +20% from 14, +30% from 30, rounded up', () => {
    expect([0, 6, 7, 13, 14, 29, 30, 400].map(streakBonusPct)).toEqual([0, 0, 10, 10, 20, 20, 30, 30]);
    expect(streakBonusXp(5, 10)).toBe(1);
    expect(streakBonusXp(20, 30)).toBe(6);
    expect(streakBonusXp(0, 30)).toBe(0);
    expect(streakBonusXp(8, 0)).toBe(0);
  });

  it('counts today as done, and the bonus is part of the day’s XP', () => {
    const days: DaysMap = Object.fromEntries(Array.from({ length: 6 }, (_, i) => ['2026-10-' + (20 + i), dailyDay()]));
    expect(streakWithToday(days, '2026-10-26')).toBe(7);
    expect(totalXp({ '2026-10-26': { daily: { q0: { ...done(5), bonus: 1 } } } })).toBe(6);
    expect(normalizeDays({ '2026-10-26': { daily: { q0: { ...done(5), bonus: 1 } }, challengeXp: 44 } })['2026-10-26']).toMatchObject({
      daily: { q0: { bonus: 1 } }, challengeXp: 44,
    });
  });
});

describe('weekly challenge', () => {
  it('picks a bodyweight, two-sided exercise the daily quests could use, for 5 days of reps', () => {
    for (const level of [0, 12, 30, 80]) {
      for (let i = 0; i < 20; i++) {
        const c = generateChallenge(level, 'u1:week' + i);
        const ex = CATALOG_BY_ID[c.ex];
        expect(ex.equipment).toBe('none');
        expect(ex.perSide).toBe(false);
        expect(['easy', 'medium', 'hard', 'elite'].indexOf(ex.difficulty)).toBeLessThanOrEqual(['easy', 'medium', 'hard', 'elite'].indexOf(maxDailyDifficulty(level)));
        expect(c.target).toBeGreaterThanOrEqual(questAmount(ex, level, 'daily') * CHALLENGE_DAYS);
        expect(c.target % (ex.measure === 'seconds' ? 30 : 5)).toBe(0);
        expect(c.reward).toBe(challengeReward(level));
      }
    }
    expect(generateChallenge(3, 'same')).toEqual(generateChallenge(3, 'same'));
    expect(challengeReward(0)).toBe(40);
    expect(challengeReward(25)).toBe(44);
  });

  it('pays full XP for camera reps and half for the rest', () => {
    expect(challengeXp({ ex: 'x', target: 100, reward: 40, cam: 100 })).toBe(40);
    expect(challengeXp({ ex: 'x', target: 100, reward: 40, man: 100 })).toBe(20);
    expect(challengeXp({ ex: 'x', target: 100, reward: 40, cam: 50, man: 50 })).toBe(30);
    expect(normalizeWeeks({ '2026-10-26': { challenge: { ex: 'x', target: 100, reward: 40, cam: 5, junk: 1 } }, bad: {} }))
      .toEqual({ '2026-10-26': { challenge: { ex: 'x', target: 100, reward: 40, cam: 5 } } });
  });
});

describe('achievements', () => {
  it('each has 10 rising levels, and the 10 level colours are all different', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.thresholds).toHaveLength(ACHIEVEMENT_LEVELS);
      for (let i = 1; i < a.thresholds.length; i++) expect(a.thresholds[i]).toBeGreaterThan(a.thresholds[i - 1]);
      expect(a.glyph).toMatch(/^[-]$/);
    }
    expect(ACHIEVEMENTS.find(a => a.id === 'streak')!.thresholds.slice(0, 6)).toEqual([7, 14, 30, 50, 100, 500]); // the owner's example
    expect(LEVEL_COLORS).toHaveLength(ACHIEVEMENT_LEVELS);
    expect(new Set(LEVEL_COLORS.map(c => c.stops.join()))).toHaveProperty('size', ACHIEVEMENT_LEVELS);
    expect(ACHIEVEMENTS.find(a => a.id === 'explorer')!.thresholds.at(-1)).toBeLessThanOrEqual(CATALOG.length);
  });

  it('are worked out from the history', () => {
    const days: DaysMap = {
      '2026-10-26': { focus: 'legs', daily: { q0: done(5, 'air-squat', 10), q1: done(5, 'glute-bridge', 12), q2: { ...done(5, 'forearm-plank', 30), manual: true } } },
      '2026-10-27': { focus: 'upper', daily: { q0: done(5, 'pushup', 8) }, optional: { hard: { ex: 'pistol-squat', accepted: 1, done: 1, amount: 3, xp: 30 } } },
      '2026-10-28': { penalty: 5 },
      '2026-11-01': { focus: 'rest', optional: { easy: { ex: 'air-squat', accepted: 1, done: 1, amount: 10, xp: 8 } } },
    };
    const weeks = { '2026-10-26': { challenge: { ex: 'air-squat', target: 50, reward: 40, cam: 50, done: 1, xp: 40 } } };
    const st = achievementStats(days, weeks, CATALOG_BY_ID, DEFAULT_TARGETS, '2026-11-01');
    const pistol = CATALOG_BY_ID['pistol-squat'];
    expect(st).toMatchObject({
      quests: 6, camera: 5, optional: 2, daredevil: 1, perfect: 1, active: 3, nodaysoff: 1, challenger: 1,
      xp: 15 + 35 + 8, hold: 30,
      legs: 10 + 12 + 3 * (pistol.perSide ? 2 : 1) + 10 + 50, push: 8,
      explorer: 5, // air squat, glute bridge, plank, push-up, pistol squat
      streak: 2, // 26th, 27th; the 28th was missed
    });
    expect(st.reps).toBe(st.legs + st.push + st.pull + st.core);
    expect(st.climber).toBe(3); // peak 50 XP → Level 3
    const levels = achievementLevels(days, weeks, CATALOG_BY_ID, DEFAULT_TARGETS, '2026-11-01');
    expect(levels).toMatchObject({ quests: 1, streak: 0, challenger: 1, daredevil: 1, nodaysoff: 1, perfect: 1 });
  });

  it('levels and progress toward the next one', () => {
    const def = ACHIEVEMENTS.find(a => a.id === 'streak')!;
    expect([0, 6, 7, 13, 14, 2000, 9999].map(v => levelFor(def, v))).toEqual([0, 0, 1, 1, 2, 10, 10]);
    const p = achievementProgress({ streak: 10 }).find(a => a.def.id === 'streak')!;
    expect(p).toMatchObject({ level: 1, next: 14 });
    expect(p.pct).toBeCloseTo(3 / 7);
    expect(achievementProgress({ streak: 5000 }).find(a => a.def.id === 'streak')).toMatchObject({ level: 10, next: null, pct: 1 });
    expect([45, 60, 600, 5400, 7200].map(v => fmtValue(v, 'seconds'))).toEqual(['45 s', '1 min', '10 min', '1.5 h', '2 h']);
    expect(fmtValue(25000)).toBe('25,000');
  });
});
