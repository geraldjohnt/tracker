// Exercise (quests) state + persistence, outside React (exposed through useSyncExternalStore).
// Live-syncs users/<uid>/exerciseTracker/{profile,days}, mirrors it to localStorage, and
// falls back to local-only mode like the other trackers. On load (and when the date
// changes) it settles missed days and creates the day's quests. It also reads the shared
// catalog at `exercises/`, and the owner's account publishes the bundled catalog there
// when it's newer.
import type { Backend } from '../shared/backend';
import { addDays, todayISO } from '../shared/dates';
import { LEGACY_OWNER } from '../shared/legacy';
import { getBackend, isSampleMode } from '../shared/store';
import { toast } from '../shared/toast';
import { EXERCISE_ROOT, userRoot, type ISODate } from '../shared/types';
import { CATALOG, CATALOG_VERSION, type Difficulty, type Exercise } from './catalog';
import {
  catalogRecord, daySeed, generateDay, levelInfo, normalizeCatalog, normalizeDays, normalizeProfile, questAmount, questXp,
  rankOf, settle, totalXp, type DailySlot, type DaysMap, type Profile, type QuestKind,
} from './derive';

const LS_KEY = 'exercise.cache.v1' + (isSampleMode() ? '.sample' : '');
export const CATALOG_PATH = 'exercises';
/** The account that publishes the shared catalog (the same owner as the legacy data). */
export const CATALOG_OWNER = LEGACY_OWNER;
const DATE_CHECK_MS = 60_000;

export interface ExerciseState {
  profile: Profile;
  days: DaysMap;
  catalog: Exercise[];
  byId: Record<string, Exercise>;
  today: ISODate;
  ready: boolean;
  usingLocal: boolean;
  /** Set when opening the app settled missed days; shown once as a banner. */
  lastSettlement: { missedDays: number; xpLost: number } | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object';

/** Applies an update() patch (slash paths, null deletes) to a plain tree, in place. */
function applyPatch(tree: Obj, patch: Obj) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('/');
    let node = tree;
    for (const k of keys.slice(0, -1)) { if (!isObj(node[k])) node[k] = {}; node = node[k] as Obj; }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = JSON.parse(JSON.stringify(value));
  }
}

const byIdOf = (c: Exercise[]) => Object.fromEntries(c.map(e => [e.id, e]));

export class ExerciseStore {
  private state: ExerciseState = {
    profile: {}, days: {}, catalog: CATALOG, byId: byIdOf(CATALOG), today: '', ready: false, usingLocal: false, lastSettlement: null,
  };
  private listeners = new Set<() => void>();
  private backend: Backend | null = null;
  private raw: Obj = {};
  private started = false;
  private accountId = '';
  private root = '';

  constructor(private getBackendFn: () => Backend | null = getBackend, private lsKeyBase = LS_KEY, private todayFn: () => ISODate = todayISO) {}

  private get lsKey() { return this.lsKeyBase + '.' + this.accountId; }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;

  private set(patch: Partial<ExerciseState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  private syncFromRaw() {
    this.set({ profile: normalizeProfile(this.raw.profile), days: normalizeDays(this.raw.days) });
  }

  private cacheLocal() {
    try { localStorage.setItem(this.lsKey, JSON.stringify({ profile: this.raw.profile ?? null, days: this.raw.days ?? null })); } catch { /* ignore */ }
  }
  private readLocal(): Obj | null {
    try { const raw = localStorage.getItem(this.lsKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  /** Loads and live-syncs the signed-in account's data. `username` decides who publishes the catalog. */
  start(accountId: string, username = '') {
    if (this.started) return;
    this.started = true;
    this.accountId = accountId;
    this.root = userRoot(accountId, EXERCISE_ROOT);
    this.state = { ...this.state, today: this.todayFn() };
    const cached = this.readLocal();
    if (cached) { this.raw = { profile: cached.profile, days: cached.days }; this.syncFromRaw(); }

    this.backend = this.getBackendFn();
    if (!this.backend) {
      this.set({ usingLocal: true, ready: true });
      toast('Firebase unavailable — saving to this device only', true);
      this.tick();
      return;
    }
    this.backend.on(CATALOG_PATH, v => {
      const stored = normalizeCatalog(v);
      if (stored && stored.version >= CATALOG_VERSION && stored.items.length) this.set({ catalog: stored.items, byId: byIdOf(stored.items) });
      if (username === CATALOG_OWNER && (!stored || stored.version < CATALOG_VERSION)) this.publishCatalog();
    }, err => console.error(err)); // unreadable catalog: keep the bundled one
    this.backend.on(this.root, v => {
      this.raw = isObj(v) ? { profile: v.profile, days: v.days } : {};
      this.cacheLocal();
      const first = !this.state.ready;
      this.syncFromRaw();
      if (first) { this.set({ ready: true }); this.tick(); }
    }, err => {
      console.error(err);
      this.set({ usingLocal: true, ready: true });
      toast('Database read denied — check your rules', true);
      this.tick();
    });
    if (typeof window !== 'undefined') setInterval(() => { if (this.todayFn() !== this.state.today) this.tick(); }, DATE_CHECK_MS);
  }

  /** Writes the bundled catalog to `exercises/` (owner account only; the rules reject everyone else). */
  publishCatalog() {
    return this.backend?.set(CATALOG_PATH, catalogRecord(CATALOG_VERSION, CATALOG))
      .then(() => toast('Exercise list published for everyone'))
      .catch(err => console.error(err));
  }

  private online() { return this.state.usingLocal ? null : this.backend; }

  private write(patch: Obj) {
    applyPatch(this.raw, patch);
    this.cacheLocal();
    this.syncFromRaw();
    return this.online()?.update(this.root, patch).catch(err => { console.error(err); toast('Could not save to server', true); }) ?? Promise.resolve();
  }

  /** Current total XP and level. */
  xp() { return totalXp(this.state.days); }

  /**
   * Starts the account's first day, settles finished days (missed-day penalties) and
   * creates today's quests. Safe to call any time; it writes only what's missing.
   */
  tick() {
    const today = this.todayFn();
    const patch: Obj = {};
    let lastSettlement = this.state.lastSettlement;
    const { profile, days, catalog } = this.state;
    if (!profile.startDate) {
      patch['profile/startDate'] = today;
      patch['profile/settledThrough'] = addDays(today, -1);
    } else {
      const s = settle(days, profile, today, this.accountId, catalog);
      if (s.patch) Object.assign(patch, s.patch);
      if (s.missedDays) lastSettlement = { missedDays: s.missedDays, xpLost: s.xpLost };
    }
    // Today's quests are picked once, at the level after settling.
    if (!days[today]?.daily) {
      const after: DaysMap = JSON.parse(JSON.stringify(days));
      for (const [k, v] of Object.entries(patch)) {
        const m = /^days\/([^/]+)\/penalty$/.exec(k);
        if (m) after[m[1]] = { ...after[m[1]], penalty: v as number };
      }
      const level = levelInfo(totalXp(after)).level;
      const { daily, optional } = generateDay(level, daySeed(this.accountId, today), catalog);
      patch['days/' + today + '/daily'] = daily;
      if (!days[today]?.optional) patch['days/' + today + '/optional'] = optional;
    }
    this.state = { ...this.state, today, lastSettlement };
    if (Object.keys(patch).length) this.write(patch);
    else this.set({});
  }

  dismissSettlement() { this.set({ lastSettlement: null }); }

  /* ---------- quests ---------- */

  private complete(kind: QuestKind, key: string) {
    const { today, days, byId } = this.state;
    const slot = kind === 'daily' ? days[today]?.daily?.[key as DailySlot] : days[today]?.optional?.[key as Difficulty];
    const ex = slot && byId[slot.ex];
    if (!slot || !ex || slot.done || (kind === 'optional' && !slot.accepted)) return;
    const before = levelInfo(this.xp()).level;
    const amount = questAmount(ex, before, kind);
    const xp = questXp(ex.difficulty, before, kind);
    const base = 'days/' + today + '/' + kind + '/' + key + '/';
    this.write({ [base + 'done']: Date.now(), [base + 'amount']: amount, [base + 'xp']: xp });
    const after = levelInfo(this.xp()).level;
    if (after > before) toast('Level up! Level ' + after + ' · ' + rankOf(after).label);
    else toast('+' + xp + ' XP · ' + ex.name);
  }

  private undo(kind: QuestKind, key: string) {
    const base = 'days/' + this.state.today + '/' + kind + '/' + key + '/';
    this.write({ [base + 'done']: null, [base + 'amount']: null, [base + 'xp']: null });
  }

  completeDaily(slot: DailySlot) { this.complete('daily', slot); }
  undoDaily(slot: DailySlot) { this.undo('daily', slot); }

  acceptOptional(d: Difficulty) {
    const q = this.state.days[this.state.today]?.optional?.[d];
    if (!q || q.accepted) return;
    this.write({ ['days/' + this.state.today + '/optional/' + d + '/accepted']: Date.now() });
    toast('Quest accepted');
  }
  abandonOptional(d: Difficulty) {
    const q = this.state.days[this.state.today]?.optional?.[d];
    if (!q || q.done) return;
    this.write({ ['days/' + this.state.today + '/optional/' + d + '/accepted']: null });
  }
  completeOptional(d: Difficulty) { this.complete('optional', d); }
  undoOptional(d: Difficulty) { this.undo('optional', d); }
}

export const exerciseStore = new ExerciseStore();
