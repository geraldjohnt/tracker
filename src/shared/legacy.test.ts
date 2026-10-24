import { describe, expect, it } from 'vitest';
import { MemoryBackend } from './backend';
import { importLegacyData, LEGACY_OWNER } from './legacy';
import { sampleTree } from './sampleData';

// The seed keeps null fields, which Firebase (and a write to MemoryBackend) never stores.
const noNulls = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (x === null ? undefined : x)));
const owner = { uid: 'u_owner', username: LEGACY_OWNER };

describe('importLegacyData (sample data only)', () => {
  it('copies the root-level data into the owner account once and leaves the original untouched', async () => {
    const backend = new MemoryBackend(sampleTree('2026-10-24'));
    const before = JSON.stringify([backend.get('weightTracker'), backend.get('spendingTracker')]);

    expect(await importLegacyData(backend, owner)).toBe('imported');
    expect(backend.get('users/u_owner/weightTracker')).toEqual(noNulls(backend.get('weightTracker')));
    expect(backend.get('users/u_owner/spendingTracker')).toEqual(backend.get('spendingTracker'));
    expect(typeof backend.get('users/u_owner/meta/legacyImported')).toBe('number');
    expect(JSON.stringify([backend.get('weightTracker'), backend.get('spendingTracker')])).toBe(before);

    // Data deleted after the import must not come back on the next sign-in.
    await backend.remove('users/u_owner/spendingTracker/expenses');
    expect(await importLegacyData(backend, owner)).toBe('skipped');
    expect(backend.get('users/u_owner/spendingTracker/expenses')).toBeNull();
  });

  it('keeps anything the owner account already has', async () => {
    const backend = new MemoryBackend({
      ...sampleTree('2026-10-24'),
      users: { u_owner: { spendingTracker: { expenses: { e_new: { date: '2026-10-24', item: 'New', price: 1, createdAt: 1 } } } } },
    });
    await importLegacyData(backend, owner);
    expect(backend.get('users/u_owner/spendingTracker/expenses/e_new')).toMatchObject({ item: 'New' });
    expect(Object.keys(backend.get('users/u_owner/spendingTracker/expenses') as object).length).toBeGreaterThan(20);
  });

  it('gives other accounts nothing', async () => {
    const backend = new MemoryBackend(sampleTree('2026-10-24'));
    expect(await importLegacyData(backend, { uid: 'u_x', username: 'someone' })).toBe('skipped');
    expect(backend.get('users')).toBeNull();
  });
});
