import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../shared/backend';
import { CATALOG, CATALOG_VERSION } from './catalog';
import { levelInfo, questAmount } from './derive';
import { CATALOG_OWNER, ExerciseStore } from './store';

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

  it('optional quests must be accepted before they can be completed', async () => {
    const s = make();
    await flush();
    s.completeOptional('hard');
    expect(s.xp()).toBe(0);
    s.acceptOptional('hard');
    s.completeOptional('hard');
    await flush();
    expect(s.xp()).toBe(30);
    expect(levelInfo(s.xp()).level).toBe(1);
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

    today = '2026-10-27'; // 25th (opened? no) and 26th missed; 24th was fine
    s = make();
    await flush();
    const st = s.getState();
    expect(st.lastSettlement?.missedDays).toBe(2);
    expect(backend.get(ROOT + '/days/2026-10-24/penalty')).toBeNull();
    expect(backend.get(ROOT + '/days/2026-10-25/penalty')).toBeGreaterThan(0);
    expect(backend.get(ROOT + '/days/2026-10-26/penalty')).toBeGreaterThan(0);
    expect(backend.get(ROOT + '/profile/settledThrough')).toBe('2026-10-26');
    expect(s.xp()).toBe(55 - st.lastSettlement!.xpLost);
    expect(st.days['2026-10-27'].daily).toBeTruthy();
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
});
