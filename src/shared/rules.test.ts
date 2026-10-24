// Guards the "keep database.rules.json in sync with src/shared/types.ts" rule: every
// key the stores write (after a full CRUD pass on sample data) must be allowed by the
// rules, which reject unknown keys via `$other: { ".validate": false }`.
import { describe, expect, it, vi } from 'vitest';
import rules from '../../database.rules.json';
import { SpendingStore } from '../spending/store';
import { WeightStore } from '../weight/store';
import { MemoryBackend } from './backend';
import { sampleTree } from './sampleData';

type RuleNode = { [k: string]: RuleNode | string | boolean };

/** Paths (with $wildcards) in `data` that the rules tree doesn't allow. */
function disallowed(data: unknown, rule: RuleNode, path = ''): string[] {
  if (data === null || typeof data !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const named = rule[k] as RuleNode | undefined;
    const wildcard = Object.keys(rule).find(r => r.startsWith('$') && r !== '$other');
    const child = named ?? (wildcard ? (rule[wildcard] as RuleNode) : undefined);
    if (!child) { out.push(path + '/' + k); continue; }
    out.push(...disallowed(v, child, path + '/' + (named ? k : wildcard)));
  }
  return out;
}

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('database.rules.json accepts everything the app writes', () => {
  it('sample data and a full CRUD pass on both trackers', async () => {
    vi.useFakeTimers();
    localStorage.clear();
    const backend = new MemoryBackend(sampleTree('2026-10-24'));

    const w = new WeightStore(() => backend, 'rules.w');
    w.start(); await flush();
    const wid = w.createWeek('2026-10-26', '2026-11-02', [{ name: 'A', startWeight: 70 }]);
    const pid = w.addParticipant(wid, 'B')!;
    w.setField(wid, pid, 'endWeight', 69);
    w.updateWeekDates(wid, '2026-10-27', '2026-11-03');
    w.toggleUnit();

    const s = new SpendingStore(() => backend, 'rules.s');
    s.start(); await flush();
    const eid = s.addExpense('2026-10-24', 'Tea', 45);
    s.setField(eid, 'item', 'Milk tea');

    vi.advanceTimersByTime(1000); await flush();
    for (const root of ['weightTracker', 'spendingTracker'] as const) {
      expect(disallowed(backend.get(root), (rules.rules as unknown as RuleNode)[root] as RuleNode, root)).toEqual([]);
    }
    vi.useRealTimers();
  });
});
