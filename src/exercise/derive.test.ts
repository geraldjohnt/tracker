import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_BY_ID, DIFFICULTIES, MUSCLES } from './catalog';
import {
  catalogRecord, dailyDone, dailyXpTotal, DAILY_SLOTS, DEFAULT_TARGETS, FOCUSES, generateDay, levelInfo, maxDailyDifficulty, nextRank,
  normalizeCatalog, normalizeDays, normalizeBoard, normalizeTargets, questAmount, questXp, rankBoard, rankLevel, rankOf, settle, streak,
  totalXp, weekdayOf, xpForLevel, xpToNext, type DaysMap,
} from './derive';

const done = (xp: number) => ({ ex: 'air-squat', done: 1, amount: 10, xp });

describe('levels', () => {
  it('needs 20 XP for level 1, then +10% per level, rounded up', () => {
    expect(xpToNext(0)).toBe(20);
    expect(xpToNext(1)).toBe(22);
    expect(xpToNext(2)).toBe(25); // 24.2 → 25
    expect(xpToNext(3)).toBe(28); // 27.5 → 28
    for (let l = 1; l < 60; l++) expect(xpToNext(l)).toBe(Math.ceil((xpToNext(l - 1) * 11) / 10));
  });

  it('turns total XP into level + progress', () => {
    expect(levelInfo(0)).toEqual({ level: 0, into: 0, need: 20, total: 0 });
    expect(levelInfo(19).level).toBe(0);
    expect(levelInfo(20)).toEqual({ level: 1, into: 0, need: 22, total: 20 });
    expect(levelInfo(42)).toEqual({ level: 2, into: 0, need: 25, total: 42 });
    expect(levelInfo(50)).toMatchObject({ level: 2, into: 8 });
    expect(levelInfo(-5).level).toBe(0);
  });

  it('a new tier every 5 levels, a new rank every 25', () => {
    expect(rankOf(0).label).toBe('Rookie 1');
    expect(rankOf(4).label).toBe('Rookie 1');
    expect(rankOf(5).label).toBe('Rookie 2');
    expect(rankOf(10).label).toBe('Rookie 3');
    expect(rankOf(15).label).toBe('Rookie 4');
    expect(rankOf(24).label).toBe('Rookie 5');
    expect(rankOf(25).label).toBe('Mover 1');
    expect(rankOf(30).label).toBe('Mover 2');
    expect(rankOf(249).label).toBe('Legend 5');
    expect(rankOf(250).label).toBe('Legend 6'); // the last rank keeps counting
    expect(rankLevel(1, 1)).toBe(25);
    expect(rankLevel(0, 3)).toBe(10);
    expect(nextRank(12)).toEqual({ level: 15, rank: rankOf(15) });
    expect(nextRank(24).rank.label).toBe('Mover 1');
  });

  it('knows the total XP needed for any level', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(20);
    expect(xpForLevel(3)).toBe(20 + 22 + 25);
    for (const l of [5, 25, 60]) expect(levelInfo(xpForLevel(l))).toMatchObject({ level: l, into: 0 });
  });
});

describe('quests', () => {
  const squat = CATALOG_BY_ID['air-squat'];
  it('daily reps grow with level (squats: 10 at level 0, +2 per level)', () => {
    expect(questAmount(squat, 0, 'daily')).toBe(10);
    expect(questAmount(squat, 1, 'daily')).toBe(12);
    expect(questAmount(squat, 5, 'daily')).toBe(20);
  });

  it('harder optional quests need more reps and give more XP', () => {
    const pushup = CATALOG_BY_ID['pushup'];
    expect(questAmount(pushup, 0, 'optional')).toBe(Math.ceil(10 * 1.25));
    const xp = DIFFICULTIES.map(d => questXp(d, 0, 'optional'));
    expect([...xp].sort((a, b) => a - b)).toEqual(xp);
    expect(questXp('easy', 0, 'optional')).toBeGreaterThan(questXp('easy', 0, 'daily'));
    expect(questXp('easy', 5, 'daily')).toBeGreaterThan(questXp('easy', 0, 'daily')); // +10% per rank
  });

  it('generates 3 daily (legs, upper, core) and one optional per difficulty, the same on every device', () => {
    const a = generateDay(0, 'u1:2026-10-24');
    expect(generateDay(0, 'u1:2026-10-24')).toEqual(a);
    expect(Object.keys(a.daily)).toEqual([...DAILY_SLOTS]);
    expect(Object.keys(a.optional)).toEqual([...DIFFICULTIES]);
    for (const d of DIFFICULTIES) expect(CATALOG_BY_ID[a.optional[d]!.ex].difficulty).toBe(d);
    // Level 0 daily quests are easy; daily quests never need equipment, at any level.
    for (let i = 0; i < 30; i++) {
      for (const level of [10, 25, 45]) {
        const hard = generateDay(level, 'u1:seed' + i);
        expect(DAILY_SLOTS.every(s => CATALOG_BY_ID[hard.daily[s]!.ex].equipment === 'none')).toBe(true);
      }
      const day = generateDay(0, 'u1:seed' + i);
      const cats = DAILY_SLOTS.map(s => CATALOG_BY_ID[day.daily[s]!.ex]);
      expect(cats.every(e => e.difficulty === 'easy' && e.equipment === 'none')).toBe(true);
      expect(cats[0].category).toBe('legs');
      expect(['push', 'pull']).toContain(cats[1].category);
      expect(['core', 'full']).toContain(cats[2].category);
    }
    expect(maxDailyDifficulty(0)).toBe('easy');
    expect(maxDailyDifficulty(10)).toBe('medium');
    expect(maxDailyDifficulty(45)).toBe('elite');
  });
});

describe('weekly targets', () => {
  it('maps dates to weekdays (Monday first) and fills in the default plan', () => {
    expect(weekdayOf('2026-10-26')).toBe('mon');
    expect(weekdayOf('2026-10-24')).toBe('sat');
    expect(weekdayOf('2026-11-01')).toBe('sun');
    expect(normalizeTargets(null)).toEqual(DEFAULT_TARGETS);
    expect(normalizeTargets({ mon: 'core', tue: 'nope', xyz: 'legs' })).toEqual({ ...DEFAULT_TARGETS, mon: 'core' });
  });

  it('daily quests follow the day’s focus, bodyweight only, no repeats', () => {
    const cats = { legs: [['legs'], ['legs'], ['legs', 'full']], upper: [['push'], ['pull'], ['push', 'pull']], core: [['core'], ['core'], ['core', 'full']], full: [['legs'], ['push', 'pull'], ['core', 'full']] };
    for (const focus of FOCUSES) {
      for (const level of [0, 12, 30, 60]) {
        for (let i = 0; i < 20; i++) {
          const day = generateDay(level, 'u1:seed' + i, undefined, focus);
          expect(day.focus).toBe(focus);
          const exs = DAILY_SLOTS.map(s => CATALOG_BY_ID[day.daily[s]!.ex]);
          exs.forEach((e, k) => expect(cats[focus][k]).toContain(e.category));
          expect(exs.every(e => e.equipment === 'none')).toBe(true);
          expect(new Set(exs.map(e => e.id)).size).toBe(3);
          const max = DIFFICULTIES.indexOf(maxDailyDifficulty(level));
          expect(exs.every(e => DIFFICULTIES.indexOf(e.difficulty) <= max)).toBe(true);
        }
      }
    }
  });
});

describe('XP ledger and missed days', () => {
  it('sums gains and penalties in date order, never below 0', () => {
    const days: DaysMap = {
      '2026-10-01': { daily: { q0: done(5), q1: done(5) } },
      '2026-10-02': { penalty: 15 },
      '2026-10-03': { daily: { q0: done(5) }, optional: { easy: { ex: 'x', accepted: 1, done: 1, xp: 8 } } },
    };
    expect(totalXp(days)).toBe(13);
    expect(totalXp(days, '2026-10-03')).toBe(0);
  });

  it('one completed daily quest is enough; optional quests do not count', () => {
    expect(dailyDone({ daily: { q0: { ex: 'a' }, q1: done(5) } })).toBe(true);
    expect(dailyDone({ daily: { q0: { ex: 'a' } }, optional: { easy: { ex: 'b', accepted: 1, done: 1, xp: 8 } } })).toBe(false);
  });

  it('deducts each missed day’s daily XP, capped at what you have', () => {
    const days: DaysMap = {
      '2026-10-20': { daily: { q0: done(20), q1: done(5) } }, // 25 XP, level 1
      '2026-10-21': { daily: { q0: { ex: 'air-squat' }, q1: { ex: 'knee-pushup' }, q2: { ex: 'crunch' } } }, // opened, nothing done
      // 10-22 never opened
    };
    const s = settle(days, { startDate: '2026-10-20', settledThrough: '2026-10-19' }, '2026-10-23', 'u1');
    expect(s.missedDays).toBe(2);
    expect(s.patch!['days/2026-10-21/penalty']).toBe(15); // 3 easy quests × 5 XP
    expect(s.patch!['days/2026-10-22/penalty']).toBe(10); // only 10 XP left
    expect(s.patch!['profile/settledThrough']).toBe('2026-10-22');
    expect(s.xpLost).toBe(25);
  });

  it('nothing is deducted at Level 0 with 0 XP, and settled days are not settled again', () => {
    const s = settle({}, { startDate: '2026-10-20', settledThrough: '2026-10-19' }, '2026-10-24', 'u1');
    expect(s.missedDays).toBe(4);
    expect(s.xpLost).toBe(0);
    expect(Object.keys(s.patch!)).toEqual(['profile/settledThrough']);
    expect(settle({}, { startDate: '2026-10-20', settledThrough: '2026-10-23' }, '2026-10-24', 'u1').patch).toBeNull();
    expect(settle({}, { startDate: '2026-10-24' }, '2026-10-24', 'u1').patch).toBeNull();
  });

  it('a missed day costs the XP of the quests it would have had at that level', () => {
    const byId = CATALOG_BY_ID;
    expect(dailyXpTotal(undefined, 0, byId)).toBe(15);
    expect(dailyXpTotal({ daily: { q0: { ex: 'pistol-squat' }, q1: { ex: 'pushup' }, q2: { ex: 'crunch' } } }, 0, byId)).toBe(20 + 8 + 5);
  });

  it('counts the daily streak', () => {
    const days: DaysMap = { '2026-10-22': { daily: { q0: done(5) } }, '2026-10-23': { daily: { q1: done(5) } } };
    expect(streak(days, '2026-10-24')).toBe(2);
    expect(streak({ ...days, '2026-10-24': { daily: { q2: done(5) } } }, '2026-10-24')).toBe(3);
    expect(streak(days, '2026-10-25')).toBe(0);
  });
});

describe('catalog', () => {
  it('every exercise is complete enough for a beginner', () => {
    const ids = new Set<string>();
    for (const e of CATALOG) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.steps.length).toBeGreaterThanOrEqual(3);
      expect(e.form.length).toBeGreaterThan(0);
      expect(e.mistakes.length).toBeGreaterThan(0);
      expect(e.primary.length).toBeGreaterThan(0);
      expect([...e.primary, ...e.secondary].every(m => (MUSCLES as readonly string[]).includes(m))).toBe(true);
      expect(e.variant && e.summary && e.easier).toBeTruthy();
      // Length limits from database.rules.json (exercises/items/$id).
      expect(e.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(e.name.length).toBeLessThanOrEqual(60);
      expect(e.variant.length).toBeLessThanOrEqual(200);
      expect(Math.max(e.summary.length, e.easier.length, ...e.steps.map(x => x.length))).toBeLessThanOrEqual(300);
      expect(Math.max(...e.form.map(x => x.length), ...e.mistakes.map(x => x.length))).toBeLessThanOrEqual(200);
    }
  });

  it('round-trips through the database shape (arrays may come back as objects)', () => {
    const rec = JSON.parse(JSON.stringify(catalogRecord(1, CATALOG)));
    const squat = rec.items['air-squat'];
    squat.steps = Object.fromEntries(squat.steps.map((s: string, i: number) => [String(i), s]));
    const back = normalizeCatalog(rec)!;
    expect(back.version).toBe(1);
    expect(back.items).toEqual(CATALOG);
    expect(normalizeCatalog(null)).toBeNull();
  });

  it('normalizes day snapshots, dropping junk', () => {
    const days = normalizeDays({ '2026-10-24': { focus: 'legs', daily: { q0: { ex: 'a', done: 5, xp: 5 }, q9: { ex: 'b' } }, penalty: 0 }, '2026-10-25': { focus: 'arms' }, junk: {} });
    expect(days).toEqual({ '2026-10-24': { focus: 'legs', daily: { q0: { ex: 'a', done: 5, xp: 5 } } }, '2026-10-25': {} });
  });
});

describe('ranking board', () => {
  it('ranks by level, then XP, then who joined first; equal level and XP share a place', () => {
    const board = normalizeBoard({
      a: { username: 'ana', level: 3, xp: 80, joinedAt: 5 },
      b: { username: 'ben', level: 5, xp: 130, joinedAt: 9 },
      c: { username: 'cy', level: 3, xp: 90, joinedAt: 7 },
      d: { username: 'dee', level: 3, xp: 80, joinedAt: 1 },
      junk: { level: 99 },
    });
    expect(board).toHaveLength(4);
    expect(rankBoard(board).map(e => [e.username, e.place])).toEqual([['ben', 1], ['cy', 2], ['dee', 3], ['ana', 3]]);
  });
});
