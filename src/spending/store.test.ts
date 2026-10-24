import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../shared/backend';
import { sampleTree } from '../shared/sampleData';
import { SpendingStore } from './store';

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('SpendingStore (sample data only)', () => {
  let backend: MemoryBackend;
  let store: SpendingStore;
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    backend = new MemoryBackend({ users: { u1: sampleTree('2026-10-24') } });
    store = new SpendingStore(() => backend, 'test.spend');
    store.start('u1');
    await flush();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('adds, edits (debounced, survives snapshots) and deletes expenses', async () => {
    const id = store.addExpense('2026-10-24', 'Tea', 45);
    await flush();
    expect(backend.get('users/u1/spendingTracker/expenses/' + id)).toMatchObject({ date: '2026-10-24', item: 'Tea', price: 45 });
    expect((backend.get('users/u1/spendingTracker/expenses/' + id) as object)).not.toHaveProperty('id');

    store.setField(id, 'price', 50);
    await backend.set('users/u1/spendingTracker/expenses/e_other', { date: '2026-10-24', item: 'X', price: 1, createdAt: 1 });
    await flush();
    expect(store.getState().expenses[id].price).toBe(50);
    expect(backend.get('users/u1/spendingTracker/expenses/' + id + '/price')).toBe(45);
    vi.advanceTimersByTime(450);
    await flush();
    expect(backend.get('users/u1/spendingTracker/expenses/' + id + '/price')).toBe(50);

    store.deleteExpense(id);
    await flush();
    expect(backend.get('users/u1/spendingTracker/expenses/' + id)).toBeNull();
  });

  it('caches locally and falls back to local-only', () => {
    const local = new SpendingStore(() => null, 'test.spend');
    local.start('u1');
    expect(local.getState().usingLocal).toBe(true);
    expect(Object.keys(local.getState().expenses).length).toBeGreaterThan(20);
  });
});
