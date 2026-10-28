import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../shared/backend';
import { CATALOG, CATALOG_VERSION } from './catalog';
import { DEFAULT_TARGETS, levelInfo, questAmount } from './derive';
import { BOARD_PATH, CATALOG_OWNER, ExerciseStore } from './store';

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const ROOT = 'users/u1/exerciseTracker';

describe('ExerciseStore (sample data only)', () => {
  let backend: MemoryBackend;
  let today: string;
  const make = (username = 'someone') => {
    const s = new ExerciseStore(() => backend, 'test.ex', () => today);
    s.start('u1', username);
    return s;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    backend = new MemoryBackend({});
    today = '2026-10-24';
  });
  afterEach(() => { vi.useRealTimers(); });

  it('starts the first day with 3 daily quests and 4 optional ones', async () => {
    const s = make();
    await flush();
    expect(backend.get(ROOT + '/profile')).toEqual({ startDate: '2026-10-24', settledThrough: '2026-10-23' });
    const day = s.getState().days['2026-10-24'];
    expect(Object.keys(day.daily!)).toHaveLength(3);
    expect(Object.keys(day.optional!)).toEqual(['easy', 'medium', 'hard', 'elite']);
    expect(levelInfo(s.xp()).level).toBe(0);
  });

  it('completes daily quests, levels up, and supports undo', async () => {
    const s = make();
    await flush();
    s.completeDaily('q0');
    s.completeDaily('q0'); // twice does nothing
    await flush();
    const q0 = backend.get(ROOT + '/days/2026-10-24/daily/q0') as Record<string, number>;
    expect(q0.xp).toBe(5);
    expect(q0.amount).toBe(questAmount(s.getState().byId[q0.ex as unknown as string], 0, 'daily'));
    s.completeDaily('q1'); s.completeDaily('q2');
    expect(s.xp()).toBe(15);
    s.undoDaily('q2');
    await flush();
    expect(s.xp()).toBe(10);
    expect(backend.get(ROOT + '/days/2026-10-24/daily/q2/done')).toBeNull();
  });

  it('completing without the camera gives half the XP, rounded down, and undo clears it', async () => {
    const s = make();
    await flush();
    s.completeDaily('q0', false);
    await flush();
    const q0 = backend.get(ROOT + '/days/2026-10-24/daily/q0') as Record<string, unknown>;
    expect(q0.xp).toBe(2); // 5 XP → 2.5 → 2
    expect(q0.manual).toBe(true);
    s.completeDaily('q1'); // with the camera: full XP, no flag
    await flush();
    expect(backend.get(ROOT + '/days/2026-10-24/daily/q1/manual')).toBeNull();
    expect(s.xp()).toBe(7);
    s.acceptOptional('hard');
    s.completeOptional('hard', false);
    expect(s.xp()).toBe(7 + 15); // hard optional 30 → 15
    s.undoDaily('q0');
    await flush();
    expect(backend.get(ROOT + '/days/2026-10-24/daily/q0/manual')).toBeNull();
    expect(s.getState().days['2026-10-24'].daily!.q0!.manual).toBeUndefined();
  });

  it('optional quests must be accepted before they can be completed', async () => {
    const s = make();
    await flush();
    s.completeOptional('hard');
    expect(s.xp()).toBe(0);
    s.acceptOptional('hard');
    s.completeOptional('hard');
    await flush();
    expect(s.xp()).toBe(30);
    expect(levelInfo(s.xp()).level).toBe(2) // 15 XP per level in Rookie 1;
    s.acceptOptional('easy');
    s.abandonOptional('easy');
    await flush();
    expect(backend.get(ROOT + '/days/2026-10-24/optional/easy/accepted')).toBeNull();
  });

  it('deducts XP for missed days on the next visit, but not for a day with one daily done', async () => {
    let s = make();
    await flush();
    s.acceptOptional('elite'); s.completeOptional('elite'); // 50 XP
    s.completeDaily('q0'); // 55
    await flush();
    expect(s.xp()).toBe(55);

    today = '2026-10-27'; // 26th missed; 24th was fine; the 25th is a Sunday, a rest day by default
    s = make();
    await flush();
    const st = s.getState();
    expect(st.lastSettlement?.missedDays).toBe(1);
    expect(backend.get(ROOT + '/days/2026-10-24/penalty')).toBeNull();
    expect(backend.get(ROOT + '/days/2026-10-25/penalty')).toBeNull();
    expect(backend.get(ROOT + '/days/2026-10-26/penalty')).toBeGreaterThan(0);
    expect(backend.get(ROOT + '/profile/settledThrough')).toBe('2026-10-26');
    expect(s.xp()).toBe(55 - st.lastSettlement!.xpLost);
    expect(st.days['2026-10-27'].daily).toBeTruthy();
  });

  it('picks today’s daily quests for the day’s target, and re-picks them when today’s target changes', async () => {
    const s = make(); // 2026-10-24 is a Saturday: full body by default
    await flush();
    const exs = () => Object.values(s.getState().days[today].daily!).map(q => s.getState().byId[q!.ex]);
    expect(backend.get(ROOT + '/days/2026-10-24/focus')).toBe('full');
    expect(exs().map(e => e.category)[0]).toBe('legs');

    s.setTarget('sat', 'legs');
    await flush();
    expect(backend.get(ROOT + '/settings/targets/sat')).toBe('legs');
    expect(s.getState().targets.sat).toBe('legs');
    expect(backend.get(ROOT + '/days/2026-10-24/focus')).toBe('legs');
    expect(exs().every(e => ['legs', 'full'].includes(e.category))).toBe(true);

    s.completeDaily('q0');
    const after = s.getState().days[today].daily;
    s.setTarget('sat', 'upper'); // a daily quest is done: today's quests stay
    s.setTarget('mon', 'core');
    await flush();
    expect(s.getState().days[today].daily).toEqual(after);
    expect(backend.get(ROOT + '/settings/targets')).toEqual({ sat: 'upper', mon: 'core' });

    s.resetTargets();
    await flush();
    expect(s.getState().targets).toEqual(DEFAULT_TARGETS);

    today = '2026-10-26'; // Monday: legs by default
    const next = make();
    await flush();
    expect(backend.get(ROOT + '/days/2026-10-26/focus')).toBe('legs');
    expect(next.getState().targets).toEqual(DEFAULT_TARGETS);
  });

  it('shows the bundled catalog, and only the owner publishes it to the database', async () => {
    const s = make();
    await flush();
    expect(s.getState().catalog).toBe(CATALOG);
    expect(backend.get('exercises')).toBeNull();

    const owner = new ExerciseStore(() => backend, 'test.ex2', () => today);
    owner.start('u2', CATALOG_OWNER);
    await flush();
    expect(backend.get('exercises/version')).toBe(CATALOG_VERSION);
    expect(s.getState().catalog).toEqual(CATALOG); // now read from the database
    expect(s.getState().catalog).not.toBe(CATALOG);
  });

  it('works local-only without a backend', () => {
    const s = new ExerciseStore(() => null, 'test.ex', () => today);
    s.start('u1');
    expect(s.getState().usingLocal).toBe(true);
    expect(s.getState().days['2026-10-24'].daily).toBeTruthy();
  });

  it('is not on the ranking board until it joins; then level and XP stay in sync; leaving removes it', async () => {
    await backend.set(BOARD_PATH + '/other', { username: 'other', level: 2, xp: 45, joinedAt: 1 });
    const s = make('me');
    await flush();
    expect(backend.get(BOARD_PATH + '/u1')).toBeNull();
    expect(s.getState().board.map(e => e.username)).toEqual(['other']);
    s.acceptOptional('hard'); s.completeOptional('hard'); // 30 XP, not joined: nothing published
    await flush();
    expect(backend.get(BOARD_PATH + '/u1')).toBeNull();

    await s.joinBoard();
    expect(backend.get(BOARD_PATH + '/u1')).toMatchObject({ username: 'me', level: 2, xp: 30 });
    s.completeDaily('q0');
    await flush();
    expect(backend.get(BOARD_PATH + '/u1')).toMatchObject({ level: 2, xp: 35 });

    await s.leaveBoard();
    expect(backend.get(BOARD_PATH + '/u1')).toBeNull();
    s.completeDaily('q1');
    await flush();
    expect(backend.get(BOARD_PATH + '/u1')).toBeNull();
  });

  it('a rest day stores its focus and optional quests only, is never re-created, and caps rest days at 3', async () => {
    today = '2026-11-01'; // Sunday: the default rest day
    const s = make();
    await flush();
    expect(backend.get(ROOT + '/days/2026-11-01/focus')).toBe('rest');
    expect(backend.get(ROOT + '/days/2026-11-01/daily')).toBeNull();
    expect(Object.keys(backend.get(ROOT + '/days/2026-11-01/optional') as object)).toHaveLength(4);
    const before = JSON.stringify(backend.get(ROOT + '/days'));
    s.tick();
    await flush();
    expect(JSON.stringify(backend.get(ROOT + '/days'))).toBe(before);

    // Training on a rest day: change today's target and the daily quests appear.
    s.setTarget('sun', 'legs');
    await flush();
    expect(Object.keys(backend.get(ROOT + '/days/2026-11-01/daily') as object)).toHaveLength(3);
    s.setTarget('sun', 'rest');
    await flush();
    expect(backend.get(ROOT + '/days/2026-11-01/daily')).toBeNull();
    expect(backend.get(ROOT + '/days/2026-11-01/focus')).toBe('rest');

    s.setTarget('mon', 'rest'); s.setTarget('tue', 'rest');
    s.setTarget('wed', 'rest'); // a 4th: refused
    await flush();
    expect(s.getState().targets).toMatchObject({ mon: 'rest', tue: 'rest', wed: 'core', sun: 'rest' });
  });

  it('adds the streak bonus to daily quests from a 7-day streak, and undo clears it', async () => {
    const week = Object.fromEntries(Array.from({ length: 6 }, (_, i) => ['2026-10-' + (18 + i),
      { focus: 'legs', daily: { q0: { ex: 'air-squat', done: 1, amount: 10, xp: 5 } } }]));
    await backend.set(ROOT, { profile: { startDate: '2026-10-18', settledThrough: '2026-10-23' }, days: week });
    const s = make();
    await flush();
    s.completeDaily('q0'); // the 7th day in a row
    s.acceptOptional('easy'); s.completeOptional('easy'); // optional quests get no streak bonus
    await flush();
    const q0 = backend.get(ROOT + '/days/2026-10-24/daily/q0') as Record<string, number>;
    expect(q0.bonus).toBe(Math.ceil(q0.xp * 0.1));
    expect(backend.get(ROOT + '/days/2026-10-24/optional/easy/bonus')).toBeNull();
    expect(s.xp()).toBe(30 + q0.xp + q0.bonus + 8);
    s.undoDaily('q0');
    await flush();
    expect(backend.get(ROOT + '/days/2026-10-24/daily/q0/bonus')).toBeNull();
  });

  it('picks one challenge per week; camera and manual reps add up; finishing pays XP today, once', async () => {
    const s = make();
    await flush();
    const c = s.challenge()!;
    expect(backend.get(ROOT + '/weeks/2026-10-19/challenge')).toMatchObject({ ex: c.ex, target: c.target, reward: 40 }); // Monday of the 24th's week
    s.logChallenge(10, true);
    s.logChallenge(0, true); // nothing
    await flush();
    expect(s.challenge()).toMatchObject({ cam: 10 });
    expect(s.xp()).toBe(0);
    s.logChallenge(c.target, false); // more than needed: capped at the rest
    await flush();
    const after = s.challenge()!;
    expect(after).toMatchObject({ cam: 10, man: c.target - 10 });
    expect(after.done).toBeGreaterThan(0);
    const xp = Math.floor((40 * (10 + (c.target - 10) / 2)) / c.target);
    expect(after.xp).toBe(xp);
    expect(backend.get(ROOT + '/days/2026-10-24/challengeXp')).toBe(xp);
    s.logChallenge(5, true); // already done
    await flush();
    expect(s.challenge()).toEqual(after);

    today = '2026-10-26'; // next Monday: a new challenge
    const next = make();
    await flush();
    expect(backend.get(ROOT + '/weeks/2026-10-26/challenge/target')).toBeGreaterThan(0);
    expect(next.challenge()!.done).toBeUndefined();
  });

  it('queues a celebration for a new rank tier and for each new achievement level', async () => {
    await backend.set(ROOT, { profile: { startDate: '2026-10-23', settledThrough: '2026-10-23' }, days: { '2026-10-23': { optional: { elite: { ex: 'air-squat', accepted: 1, done: 1, xp: 70 } } } } });
    const s = make(); // 70 XP: Level 4, one level below Rookie 2
    await flush();
    expect(s.getState().celebrations).toEqual([]);
    s.completeDaily('q0'); // 75 XP → Level 5, Rookie 2
    const kinds = s.getState().celebrations.map(c => (c.kind === 'rank' ? 'rank:' + c.rank.label : c.id + ':' + c.level));
    expect(kinds[0]).toBe('rank:Rookie 2');
    expect(kinds).toContain('climber:2'); // peak Level 5
    s.dismissCelebration();
    expect(s.getState().celebrations.length).toBe(kinds.length - 1);
  });
});
