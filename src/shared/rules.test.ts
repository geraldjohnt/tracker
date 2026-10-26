// Guards the "keep database.rules.json in sync with src/shared/types.ts" rule: every
// key the stores write (after a full CRUD pass on sample data) must be allowed by the
// rules, which reject unknown keys via `$other: { ".validate": false }`.
import { describe, expect, it, vi } from 'vitest';
import rules from '../../database.rules.json';
import { CATALOG_OWNER, ExerciseStore } from '../exercise/store';
import { SpendingStore } from '../spending/store';
import { WeightStore } from '../weight/store';
import { USER_EMAIL_DOMAIN, usernameToEmail } from './auth';
import { MemoryBackend } from './backend';
import { importLegacyData, LEGACY_OWNER } from './legacy';
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
    const backend = new MemoryBackend({ users: { u1: sampleTree('2026-10-24') } });

    const w = new WeightStore(() => backend, 'rules.w');
    w.start('u1'); await flush();
    const wid = w.createWeek('2026-10-26', '2026-11-02', [{ name: 'A', startWeight: 70 }]);
    const pid = w.addParticipant(wid, 'B')!;
    w.setField(wid, pid, 'endWeight', 69);
    w.updateWeekDates(wid, '2026-10-27', '2026-11-03');
    w.toggleUnit();

    const s = new SpendingStore(() => backend, 'rules.s');
    s.start('u1'); await flush();
    const eid = s.addExpense('2026-10-24', 'Tea', 45);
    s.setField(eid, 'item', 'Milk tea');

    const x = new ExerciseStore(() => backend, 'rules.x', () => '2026-10-24');
    x.start('u1'); await flush();
    x.setTarget('mon', 'upper'); x.setTarget('sat', 'legs'); x.completeDaily('q0'); x.completeDaily('q1', false); x.acceptOptional('easy'); x.completeOptional('easy'); x.acceptOptional('hard'); await flush();
    const later = new ExerciseStore(() => backend, 'rules.x2', () => '2026-10-28'); // settles missed days
    later.start('u1'); await flush();
    expect(backend.get('users/u1/exerciseTracker/days/2026-10-25/penalty')).toBeGreaterThan(0);

    vi.advanceTimersByTime(1000); await flush();
    const userRule = ((rules.rules as unknown as RuleNode).users as RuleNode).$uid as RuleNode;
    expect(disallowed(backend.get('users/u1'), userRule, 'users/$uid')).toEqual([]);
    vi.useRealTimers();
  });

  it('the shared exercise catalog the owner publishes, and only the owner may write it', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend({});
    new ExerciseStore(() => backend, 'rules.c', () => '2026-10-24').start('u1', CATALOG_OWNER);
    await flush();
    const catalogRule = (rules.rules as unknown as RuleNode).exercises as RuleNode;
    expect(backend.get('exercises/version')).toBeTruthy();
    expect(disallowed(backend.get('exercises'), catalogRule, 'exercises')).toEqual([]);
    expect(rules.rules.exercises['.write']).toContain("auth.token.email === '" + usernameToEmail(CATALOG_OWNER) + "'");
    expect(rules.rules.exercises['.read']).toBe('auth != null');
    vi.useRealTimers();
  });

  it('ranking board entries: only allowed keys, own entry only, username tied to the account', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend({});
    const x = new ExerciseStore(() => backend, 'rules.b', () => '2026-10-24');
    x.start('u1', 'someone'); await flush();
    await x.joinBoard();
    x.completeDaily('q0'); await flush();
    const boardRule = (rules.rules as unknown as RuleNode).leaderboard as RuleNode;
    expect(disallowed(backend.get('leaderboard'), boardRule, 'leaderboard')).toEqual([]);
    const entry = rules.rules.leaderboard.$uid;
    expect(entry['.write']).toBe('auth != null && auth.uid === $uid');
    expect(entry['.validate']).toContain("newData.child('username').val() + '@" + USER_EMAIL_DOMAIN + "' === auth.token.email");
    vi.useRealTimers();
  });

  it('the legacy import writes only allowed keys, and the owner rule names the owner account', async () => {
    const backend = new MemoryBackend(sampleTree('2026-10-24'));
    await backend.update('weightTracker/weeks/w_sample0', { stray: 1 }); // unknown keys are dropped, not copied
    await importLegacyData(backend, { uid: 'u1', username: LEGACY_OWNER });
    const userRule = ((rules.rules as unknown as RuleNode).users as RuleNode).$uid as RuleNode;
    expect(disallowed(backend.get('users/u1'), userRule, 'users/$uid')).toEqual([]);

    const owner = "auth.token.email === '" + usernameToEmail(LEGACY_OWNER) + "'";
    expect(rules.rules.weightTracker['.read']).toContain(owner);
    expect(rules.rules.spendingTracker['.read']).toContain(owner);
  });
});
