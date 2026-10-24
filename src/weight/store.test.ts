import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../shared/backend';
import { sampleTree } from '../shared/sampleData';
import { WeightStore } from './store';

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('WeightStore (sample data only)', () => {
  let backend: MemoryBackend;
  let store: WeightStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    backend = new MemoryBackend(sampleTree('2026-10-24'));
    store = new WeightStore(() => backend, 'test.cache');
    store.start();
    await flush();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('loads weeks from the backend and mirrors them to localStorage', () => {
    expect(store.getState().ready).toBe(true);
    expect(Object.keys(store.getState().weeks)).toHaveLength(4);
    expect(JSON.parse(localStorage.getItem('test.cache')!).weeks.w_sample0).toBeTruthy();
  });

  it('keeps an unsaved edit on top of a snapshot that arrives mid-typing, then saves it', async () => {
    store.setField('w_sample3', 'p_sample0', 'endWeight', 80.1);
    // Another device writes something else before our debounce fires → full snapshot arrives.
    await backend.set('weightTracker/weeks/w_sample3/participants/p_sample1/endWeight', 63);
    await flush();
    const ps = store.getState().weeks.w_sample3.participants;
    expect(ps.p_sample0.endWeight).toBe(80.1); // not clobbered
    expect(ps.p_sample1.endWeight).toBe(63);   // remote change applied
    expect(backend.get('weightTracker/weeks/w_sample3/participants/p_sample0/endWeight')).toBeNull();

    vi.advanceTimersByTime(450);
    await flush();
    expect(backend.get('weightTracker/weeks/w_sample3/participants/p_sample0/endWeight')).toBe(80.1);
  });

  it('flushSaves writes immediately', async () => {
    store.setField('w_sample3', 'p_sample0', 'name', 'Renamed');
    store.flushSaves();
    await flush();
    expect(backend.get('weightTracker/weeks/w_sample3/participants/p_sample0/name')).toBe('Renamed');
  });

  it('creates, edits dates, adds/removes participants and deletes weeks', async () => {
    const id = store.createWeek('2026-10-26', '2026-11-02', [{ name: 'New One', startWeight: 70 }, { name: '  ', startWeight: null }]);
    await flush();
    const w = backend.get('weightTracker/weeks/' + id) as any;
    expect(Object.values(w.participants)).toEqual([{ name: 'New One', startWeight: 70, order: 0 }]);

    store.updateWeekDates(id, '2026-10-27', '2026-11-03');
    const pid = store.addParticipant(id, ' Extra ')!;
    await flush();
    expect(backend.get('weightTracker/weeks/' + id + '/startDate')).toBe('2026-10-27');
    expect(backend.get('weightTracker/weeks/' + id + '/participants/' + pid)).toEqual({ name: 'Extra', order: 1 });

    store.removeParticipant(id, pid);
    store.deleteWeek(id);
    await flush();
    expect(backend.get('weightTracker/weeks/' + id)).toBeNull();
  });

  it('toggles and syncs the unit', async () => {
    store.toggleUnit();
    await flush();
    expect(store.getState().unit).toBe('lb');
    expect(backend.get('weightTracker/settings/unit')).toBe('lb');
  });

  it('falls back to local-only when no backend is available', () => {
    const local = new WeightStore(() => null, 'test.cache');
    local.start();
    expect(local.getState()).toMatchObject({ usingLocal: true, ready: true });
    expect(Object.keys(local.getState().weeks)).toHaveLength(4); // from the offline cache
  });
});
