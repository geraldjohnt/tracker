import { describe, expect, it } from 'vitest';
import { MemoryBackend } from './backend';
import { sampleTree } from './sampleData';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('MemoryBackend (sample-data CRUD, never Firebase)', () => {
  it('supports set / update with nested paths / remove and notifies listeners', async () => {
    const b = new MemoryBackend(sampleTree('2026-10-24'));
    const seen: unknown[] = [];
    b.on('spendingTracker/expenses/e_test', v => seen.push(v));
    await flush();
    expect(seen).toEqual([null]);

    await b.set('spendingTracker/expenses/e_test', { date: '2026-10-24', item: 'Tea', price: 50, createdAt: 1 });
    await b.update('spendingTracker/expenses/e_test', { price: 60 });
    expect(b.get('spendingTracker/expenses/e_test')).toMatchObject({ item: 'Tea', price: 60 });

    await b.remove('spendingTracker/expenses/e_test');
    expect(b.get('spendingTracker/expenses/e_test')).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it('prunes empty parents like Firebase does', async () => {
    const b = new MemoryBackend({});
    await b.update('weightTracker/weeks/w1', { 'participants/p1/name': 'X' });
    await b.remove('weightTracker/weeks/w1/participants/p1');
    expect(b.get('weightTracker')).toBeNull();
  });

  it('seeds sample weeks and expenses only (no real names)', () => {
    const t = sampleTree('2026-10-24') as any;
    expect(Object.keys(t.weightTracker.weeks)).toHaveLength(4);
    expect(Object.keys(t.spendingTracker.expenses).length).toBeGreaterThan(20);
  });
});
