// Exercise (quests) state + persistence, outside React (exposed through useSyncExternalStore).
// Live-syncs users/<uid>/exerciseTracker/{profile,days,weeks,settings/targets}, mirrors it to localStorage, and
// falls back to local-only mode like the other trackers. On load (and when the date
// changes) it settles missed days and creates the day's quests and the week's challenge. It also reads the shared
// catalog at `exercises/`, and the owner's account publishes the bundled catalog there
// when it's newer. Accounts that opt in to the ranking board keep their entry at
// `leaderboard/<uid>` up to date with their level and XP.
import type { Backend } from '../shared/backend';
import { addDays, startOfWeek, todayISO } from '../shared/dates';
import { LEGACY_OWNER } from '../shared/legacy';
import { getBackend, isSampleMode } from '../shared/store';
import { toast } from '../shared/toast';
import { EXERCISE_ROOT, userRoot, type ISODate } from '../shared/types';
import { achievementLevels, ACHIEVEMENTS } from './achievements';
import { CATALOG, CATALOG_VERSION, type Difficulty, type Exercise } from './catalog';
import {
  catalogRecord, challengeProgress, challengeXp, DEFAULT_TARGETS, manualXp, MAX_REST_DAYS, daySeed, focusOn, generateChallenge, generateDaily,
  generateDay, levelInfo, normalizeBoard, normalizeCatalog, normalizeDays, normalizeProfile, normalizeTargets, normalizeWeeks, questAmount, questXp,
  rankOf, restDays, settle, streakBonusPct, streakBonusXp, streakWithToday, totalXp, weekdayOf, type BoardEntry, type DailySlot, type DaysMap,
  type Focus, type Profile, type QuestKind, type Rank, type Targets, type Weekday, type WeeksMap,
} from './derive';

const LS_KEY = 'exercise.cache.v1' + (isSampleMode() ? '.sample' : '');
export const CATALOG_PATH = 'exercises';
export const BOARD_PATH = 'leaderboard';
/** The account that publishes the shared catalog (the same owner as the legacy data). */
export const CATALOG_OWNER = LEGACY_OWNER;
const DATE_CHECK_MS = 60_000;

/** A full-screen moment after a quest: a new rank tier, or a new achievement level. */
export type Celebration =
  | { kind: 'rank'; rank: Rank; level: number }
  | { kind: 'achievement'; id: string; level: number };

export interface ExerciseState {
  profile: Profile;
  days: DaysMap;
  /** Per week (keyed by its Monday): the weekly challenge. */
  weeks: WeeksMap;
  /** The weekly plan: what each weekday's daily quests train. */
  targets: Targets;
  catalog: Exercise[];
  byId: Record<string, Exercise>;
  today: ISODate;
  ready: boolean;
  usingLocal: boolean;
  /** Everyone on the ranking board (readable by any signed-in account). */
  board: BoardEntry[];
  /** The ranking board has answered at least once (or can't be reached). */
  boardReady: boolean;
  /** Set when opening the app settled missed days; shown once as a banner. */
  lastSettlement: { missedDays: number; xpLost: number } | null;
  /** Rank-ups and achievements waiting to be shown, oldest first. */
  celebrations: Celebration[];
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
    profile: {}, days: {}, weeks: {}, targets: DEFAULT_TARGETS, catalog: CATALOG, byId: byIdOf(CATALOG), today: '', ready: false, usingLocal: false,
    lastSettlement: null, board: [], boardReady: false, celebrations: [],
  };
  private listeners = new Set<() => void>();
  private backend: Backend | null = null;
  private raw: Obj = {};
  private started = false;
  private accountId = '';
  private root = '';
  private username = '';

  constructor(private getBackendFn: () => Backend | null = getBackend, private lsKeyBase = LS_KEY, private todayFn: () => ISODate = todayISO) {}

  private get lsKey() { return this.lsKeyBase + '.' + this.accountId; }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;

  private set(patch: Partial<ExerciseState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  private syncFromRaw() {
    this.set({
      profile: normalizeProfile(this.raw.profile), days: normalizeDays(this.raw.days), weeks: normalizeWeeks(this.raw.weeks),
      targets: normalizeTargets(this.raw.targets),
    });
  }

  private cacheLocal() {
    try {
      const { profile = null, days = null, weeks = null, targets = null } = this.raw;
      localStorage.setItem(this.lsKey, JSON.stringify({ profile, days, weeks, targets }));
    } catch { /* ignore */ }
  }
  private readLocal(): Obj | null {
    try { const raw = localStorage.getItem(this.lsKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  /** Loads and live-syncs the signed-in account's data. `username` decides who publishes the catalog. */
  start(accountId: string, username = '') {
    if (this.started) return;
    this.started = true;
    this.accountId = accountId;
    this.username = username;
    this.root = userRoot(accountId, EXERCISE_ROOT);
    this.state = { ...this.state, today: this.todayFn() };
    const cached = this.readLocal();
    if (cached) { this.raw = { profile: cached.profile, days: cached.days, weeks: cached.weeks, targets: cached.targets }; this.syncFromRaw(); }

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
    this.backend.on(BOARD_PATH, v => {
      this.set({ board: normalizeBoard(v), boardReady: true });
      this.syncBoard();
    }, err => { console.error(err); this.set({ boardReady: true }); });
    this.backend.on(this.root, v => {
      this.raw = isObj(v) ? { profile: v.profile, days: v.days, weeks: v.weeks, targets: isObj(v.settings) ? v.settings.targets : undefined } : {};
      this.cacheLocal();
      const first = !this.state.ready;
      this.syncFromRaw();
      if (first) { this.set({ ready: true }); this.tick(); }
      this.syncBoard();
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
    // raw keeps settings/targets at the top level as `targets`.
    applyPatch(this.raw, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.replace(/^settings\/targets/, 'targets'), v])));
    this.cacheLocal();
    this.syncFromRaw();
    queueMicrotask(() => this.syncBoard());
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
    const { profile, days, catalog, targets } = this.state;
    if (!profile.startDate) {
      patch['profile/startDate'] = today;
      patch['profile/settledThrough'] = addDays(today, -1);
    } else {
      const s = settle(days, profile, today, this.accountId, catalog, targets);
      if (s.patch) Object.assign(patch, s.patch);
      if (s.missedDays) lastSettlement = { missedDays: s.missedDays, xpLost: s.xpLost };
    }
    // Today's quests and this week's challenge are picked once, at the level after settling.
    const after: DaysMap = JSON.parse(JSON.stringify(days));
    for (const [k, v] of Object.entries(patch)) {
      const m = /^days\/([^/]+)\/penalty$/.exec(k);
      if (m) after[m[1]] = { ...after[m[1]], penalty: v as number };
    }
    const level = levelInfo(totalXp(after)).level;
    // A rest day has no daily quests to store, so its stored focus marks it as created.
    if (!days[today]?.daily && days[today]?.focus !== 'rest') {
      const { focus, daily, optional } = generateDay(level, daySeed(this.accountId, today), catalog, focusOn(targets, today));
      patch['days/' + today + '/focus'] = focus;
      if (Object.keys(daily).length) patch['days/' + today + '/daily'] = daily;
      if (!days[today]?.optional) patch['days/' + today + '/optional'] = optional;
    }
    const monday = startOfWeek(today);
    if (!this.state.weeks[monday]?.challenge) patch['weeks/' + monday + '/challenge'] = generateChallenge(level, daySeed(this.accountId, monday), catalog);
    this.state = { ...this.state, today, lastSettlement };
    if (Object.keys(patch).length) this.write(patch);
    else this.set({});
    this.syncBoard();
  }

  /* ---------- ranking board (opt-in) ---------- */

  /** This account's board entry, if it has joined. */
  myEntry() { return this.state.board.find(e => e.uid === this.accountId) ?? null; }

  /** Adds this account to the ranking board. Only called after the user confirms. */
  joinBoard() {
    const b = this.online();
    if (!b || this.myEntry()) return Promise.resolve();
    const { level } = levelInfo(this.xp());
    const entry = { username: this.username, level, xp: this.xp(), joinedAt: Date.now(), updatedAt: Date.now() };
    this.set({ board: [...this.state.board, { uid: this.accountId, ...entry }] });
    return b.set(BOARD_PATH + '/' + this.accountId, entry)
      .then(() => toast('You joined the ranking board'))
      .catch(err => { console.error(err); toast('Could not join the ranking board', true); });
  }

  /** Removes this account from the ranking board. */
  leaveBoard() {
    const b = this.online();
    if (!b || !this.myEntry()) return Promise.resolve();
    this.set({ board: this.state.board.filter(e => e.uid !== this.accountId) });
    return b.remove(BOARD_PATH + '/' + this.accountId)
      .then(() => toast('You left the ranking board'))
      .catch(err => { console.error(err); toast('Could not leave the ranking board', true); });
  }

  /** Keeps a joined account's level and XP on the board current. Never adds an account that hasn't joined. */
  private syncBoard() {
    const b = this.online();
    const mine = this.myEntry();
    if (!b || !mine || !this.state.ready) return;
    const xp = this.xp();
    const { level } = levelInfo(xp);
    if (mine.level === level && mine.xp === xp && mine.username === this.username) return;
    const patch = { username: this.username, level, xp, updatedAt: Date.now() };
    this.state = { ...this.state, board: this.state.board.map(e => (e.uid === this.accountId ? { ...e, ...patch } : e)) };
    b.update(BOARD_PATH + '/' + this.accountId, patch).catch(err => console.error(err));
  }

  /* ---------- weekly targets ---------- */

  /**
   * Sets what a weekday's daily quests train. If it's today's weekday and no daily quest
   * is done yet, today's daily quests are picked again for the new target.
   */
  setTarget(day: Weekday, focus: Focus) {
    const { today, days, targets, catalog } = this.state;
    if (targets[day] === focus) return;
    if (focus === 'rest' && restDays(targets) >= MAX_REST_DAYS) { toast('At most ' + MAX_REST_DAYS + ' rest days a week', true); return; }
    const patch: Obj = { ['settings/targets/' + day]: focus };
    const todays = days[today];
    if (weekdayOf(today) === day && !Object.values(todays?.daily ?? {}).some(q => q?.done)) {
      const daily = generateDaily(levelInfo(this.xp()).level, daySeed(this.accountId, today), focus, catalog);
      patch['days/' + today + '/focus'] = focus;
      patch['days/' + today + '/daily'] = Object.keys(daily).length ? daily : null;
    }
    this.write(patch);
  }

  /** Puts every weekday back to the default plan (today's quests follow if none is done yet). */
  resetTargets() {
    // Training days first, so the rest-day limit never blocks a default rest day.
    const entries = Object.entries(DEFAULT_TARGETS) as Array<[Weekday, Focus]>;
    for (const [day, focus] of [...entries.filter(e => e[1] !== 'rest'), ...entries.filter(e => e[1] === 'rest')]) this.setTarget(day, focus);
  }

  /** Today's daily quests can still follow a change of target (none of them is done). */
  canRetargetToday() {
    return !Object.values(this.state.days[this.state.today]?.daily ?? {}).some(q => q?.done);
  }

  dismissSettlement() { this.set({ lastSettlement: null }); }

  /* ---------- celebrations ---------- */

  dismissCelebration() { this.set({ celebrations: this.state.celebrations.slice(1) }); }

  private achievementLevels() {
    const { days, weeks, byId, targets, today } = this.state;
    return achievementLevels(days, weeks, byId, targets, today);
  }

  /** Runs a change and queues a celebration for a new rank tier and each new achievement level. */
  private celebrate(change: () => void) {
    const before = levelInfo(this.xp()).level;
    const had = this.achievementLevels();
    change();
    const after = levelInfo(this.xp()).level;
    const now = this.achievementLevels();
    const queue: Celebration[] = [];
    if (after > before && rankOf(after).label !== rankOf(before).label) queue.push({ kind: 'rank', rank: rankOf(after), level: after });
    for (const a of ACHIEVEMENTS) if ((now[a.id] ?? 0) > (had[a.id] ?? 0)) queue.push({ kind: 'achievement', id: a.id, level: now[a.id] });
    if (queue.length) this.set({ celebrations: [...this.state.celebrations, ...queue] });
    return { before, after, rankUp: queue[0]?.kind === 'rank' };
  }

  /* ---------- quests ---------- */

  /**
   * Completes one of today's quests. `camera` says the camera form check counted it; without
   * it (no camera, or access denied) the quest is worth half its XP, rounded down.
   */
  private complete(kind: QuestKind, key: string, camera: boolean) {
    const { today, days, byId, targets } = this.state;
    const slot = kind === 'daily' ? days[today]?.daily?.[key as DailySlot] : days[today]?.optional?.[key as Difficulty];
    const ex = slot && byId[slot.ex];
    if (!slot || !ex || slot.done || (kind === 'optional' && !slot.accepted)) return;
    const level = levelInfo(this.xp()).level;
    const amount = questAmount(ex, level, kind);
    const full = questXp(ex.difficulty, level, kind);
    const xp = camera ? full : manualXp(full);
    const bonus = kind === 'daily' ? streakBonusXp(xp, streakBonusPct(streakWithToday(days, today, targets))) : 0;
    const base = 'days/' + today + '/' + kind + '/' + key + '/';
    const { before, after, rankUp } = this.celebrate(() => this.write({
      [base + 'done']: Date.now(), [base + 'amount']: amount, [base + 'xp']: xp, [base + 'manual']: camera ? null : true, [base + 'bonus']: bonus || null,
    }));
    if (after > before && !rankUp) toast('Level up! Level ' + after + ' · ' + rankOf(after).label);
    else if (after <= before) {
      const notes = [bonus ? 'streak bonus +' + bonus : '', camera ? '' : 'half XP, no camera'].filter(Boolean);
      toast('+' + (xp + bonus) + ' XP · ' + ex.name + (notes.length ? ' (' + notes.join(', ') + ')' : ''));
    }
  }

  private undo(kind: QuestKind, key: string) {
    const base = 'days/' + this.state.today + '/' + kind + '/' + key + '/';
    this.write({ [base + 'done']: null, [base + 'amount']: null, [base + 'xp']: null, [base + 'manual']: null, [base + 'bonus']: null });
  }

  completeDaily(slot: DailySlot, camera = true) { this.complete('daily', slot, camera); }
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
  completeOptional(d: Difficulty, camera = true) { this.complete('optional', d, camera); }
  undoOptional(d: Difficulty) { this.undo('optional', d); }

  /* ---------- weekly challenge ---------- */

  /** This week's challenge (keyed by the week's Monday), if it has been picked. */
  challenge() { return this.state.weeks[startOfWeek(this.state.today)]?.challenge ?? null; }

  /**
   * Adds reps (or seconds) to this week's challenge: counted by the camera, or logged without it
   * (those count half toward the XP). Reaching the target completes it and pays its XP today.
   */
  logChallenge(count: number, camera: boolean) {
    const c = this.challenge();
    const n = Math.floor(count);
    if (!c || c.done || n <= 0) return;
    const ex = this.state.byId[c.ex];
    const base = 'weeks/' + startOfWeek(this.state.today) + '/challenge/';
    const next = { ...c, [camera ? 'cam' : 'man']: (camera ? c.cam ?? 0 : c.man ?? 0) + Math.min(n, c.target - challengeProgress(c)) };
    const patch: Obj = { [base + (camera ? 'cam' : 'man')]: next[camera ? 'cam' : 'man'] };
    const finished = challengeProgress(next) >= c.target;
    if (finished) {
      const xp = challengeXp(next);
      Object.assign(patch, { [base + 'done']: Date.now(), [base + 'xp']: xp, ['days/' + this.state.today + '/challengeXp']: xp });
      this.celebrate(() => this.write(patch));
      toast('Weekly challenge complete! +' + xp + ' XP');
    } else {
      this.write(patch);
      toast('+' + n + (ex?.measure === 'seconds' ? ' s' : ' reps') + ' toward the weekly challenge');
    }
  }
}

export const exerciseStore = new ExerciseStore();
