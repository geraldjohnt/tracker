// WeighIn state + persistence, outside React (exposed through useSyncExternalStore).
//
// Mirrors legacy weight.html:
//   - the database is the source of truth when reachable (live `weeks` listener);
//   - every change is mirrored to localStorage so the app opens offline;
//   - if the backend can't initialize or a read is denied → local-only mode;
//   - pending-edit reconciliation: typed-but-unconfirmed field edits are
//     re-applied on top of every incoming snapshot until their debounced (450ms)
//     write resolves, so a snapshot arriving mid-keystroke can't clobber input.
import type { Backend } from '../shared/backend';
import { uid } from '../shared/format';
import { getBackend, isSampleMode } from '../shared/store';
import { toast } from '../shared/toast';
import { WEIGHT_ROOT, type Participant, type Unit, type Week } from '../shared/types';
import { normalizeWeeks, sortedWeeks, type WeeksMap } from './derive';

const ROOT = WEIGHT_ROOT; // change to run a second, separate tracker
// Sample mode gets its own cache key so sample data never overwrites the real offline cache.
const LS_KEY = 'weighin.cache.v1' + (isSampleMode() ? '.sample' : '');
const SAVE_DEBOUNCE_MS = 450;
const OFFLINE_FALLBACK_MS = 4000;

export type EditableField = 'name' | 'startWeight' | 'endWeight';

export interface WeightState {
  weeks: WeeksMap;
  unit: Unit;
  ready: boolean;
  usingLocal: boolean;
}

interface PendingEdit { weekId: string; pid: string; field: EditableField; value: string | number | null }

export class WeightStore {
  private state: WeightState = { weeks: {}, unit: 'kg', ready: false, usingLocal: false };
  private listeners = new Set<() => void>();
  private backend: Backend | null = null;
  private pending: Record<string, PendingEdit> = {};
  private saveTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private started = false;

  constructor(private getBackendFn: () => Backend | null = getBackend, private lsKey = LS_KEY) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;

  private set(patch: Partial<WeightState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  /* ---------- persistence ---------- */

  private cacheLocal() {
    try { localStorage.setItem(this.lsKey, JSON.stringify({ weeks: this.state.weeks, unit: this.state.unit })); } catch { /* ignore */ }
  }
  private readLocal(): { weeks?: WeeksMap; unit?: Unit } | null {
    try { const raw = localStorage.getItem(this.lsKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  start() {
    if (this.started) return;
    this.started = true;
    const cached = this.readLocal();
    if (cached) this.set({ weeks: normalizeWeeks(cached.weeks || {}), unit: cached.unit || 'kg' });

    this.backend = this.getBackendFn();
    if (!this.backend) {
      this.set({ usingLocal: true, ready: true });
      toast('Firebase unavailable — saving to this device only', true);
      return;
    }

    this.backend.on(ROOT + '/weeks', v => {
      this.state = { ...this.state, weeks: normalizeWeeks(v as Record<string, Week> | null), ready: true };
      this.applyPending(); // keep un-flushed local edits on top of the incoming snapshot
      this.cacheLocal();
      this.set({});
    }, err => {
      console.error(err);
      this.set({ usingLocal: true, ready: true });
      toast('Database read denied — check your rules', true);
    });

    this.backend.on(ROOT + '/settings/unit', v => {
      if ((v === 'kg' || v === 'lb') && v !== this.state.unit) { this.set({ unit: v }); this.cacheLocal(); }
    });

    setTimeout(() => { if (!this.state.ready) this.set({ ready: true }); }, OFFLINE_FALLBACK_MS);
  }

  private online() { return this.state.usingLocal ? null : this.backend; }

  private write(path: string, value: unknown) {
    this.cacheLocal();
    return this.online()?.set(ROOT + '/' + path, value).catch(err => { console.error(err); toast('Could not save to server', true); }) ?? Promise.resolve();
  }
  private update(path: string, patch: Record<string, unknown>) {
    this.cacheLocal();
    return this.online()?.update(ROOT + '/' + path, patch).catch(err => { console.error(err); toast('Could not save to server', true); }) ?? Promise.resolve();
  }
  private remove(path: string) {
    this.cacheLocal();
    return this.online()?.remove(ROOT + '/' + path).catch(err => { console.error(err); toast('Could not delete on server', true); }) ?? Promise.resolve();
  }

  /* ---------- pending-edit reconciliation ---------- */

  private applyPending() {
    let weeks = this.state.weeks;
    for (const [key, e] of Object.entries(this.pending)) {
      const p = weeks[e.weekId]?.participants?.[e.pid];
      if (!p) { delete this.pending[key]; continue; }
      weeks = withParticipant(weeks, e.weekId, e.pid, { ...p, [e.field]: e.value });
    }
    this.state = { ...this.state, weeks };
  }

  private queueSave(e: PendingEdit) {
    const key = e.weekId + '/' + e.pid + '/' + e.field;
    this.pending[key] = e;
    const t = this.saveTimers[key];
    if (t) clearTimeout(t);
    this.saveTimers[key] = setTimeout(() => {
      this.saveTimers[key] = null;
      this.commit(key, e);
    }, SAVE_DEBOUNCE_MS);
  }

  private commit(key: string, e: PendingEdit) {
    this.update('weeks/' + e.weekId + '/participants/' + e.pid, { [e.field]: e.value }).then(() => {
      if (this.pending[key] && this.pending[key].value === e.value) delete this.pending[key];
    });
  }

  /** Write any debounced edits immediately (called when an input loses focus). */
  flushSaves = () => {
    for (const key of Object.keys(this.saveTimers)) {
      const t = this.saveTimers[key];
      if (!t) continue;
      clearTimeout(t);
      this.saveTimers[key] = null;
      const e = this.pending[key];
      if (e) this.commit(key, e);
    }
  };

  /* ---------- mutations ---------- */

  setField(weekId: string, pid: string, field: EditableField, value: string | number | null) {
    const p = this.state.weeks[weekId]?.participants?.[pid];
    if (!p) return;
    this.set({ weeks: withParticipant(this.state.weeks, weekId, pid, { ...p, [field]: value }) });
    this.cacheLocal();
    this.queueSave({ weekId, pid, field, value });
  }

  /** Returns the new participant id, or null if the name was blank. */
  addParticipant(weekId: string, name: string): string | null {
    const w = this.state.weeks[weekId];
    if (!w) return null;
    const clean = String(name || '').trim();
    if (!clean) { toast('Enter a name first', true); return null; }
    const id = uid('p');
    const order = Object.values(w.participants || {}).reduce((m, p) => Math.max(m, p.order || 0), 0) + 1;
    const rec: Participant = { name: clean, startWeight: null, endWeight: null, order };
    this.set({ weeks: withParticipant(this.state.weeks, weekId, id, rec) });
    this.update('weeks/' + weekId + '/participants/' + id, rec as unknown as Record<string, unknown>);
    toast(clean + ' added');
    return id;
  }

  removeParticipant(weekId: string, pid: string) {
    const w = this.state.weeks[weekId];
    if (!w) return;
    const participants = { ...w.participants };
    delete participants[pid];
    this.set({ weeks: { ...this.state.weeks, [weekId]: { ...w, participants } } });
    this.remove('weeks/' + weekId + '/participants/' + pid);
    toast('Removed');
  }

  createWeek(startDate: string, endDate: string, people: Array<{ name: string; startWeight: number | null }>): string {
    const participants: Week['participants'] = {};
    let order = 0;
    for (const p of people) {
      const name = p.name.trim();
      if (!name) continue;
      participants[uid('p')] = { name, startWeight: p.startWeight, endWeight: null, order: order++ };
    }
    const id = uid('w');
    const week: Week = { id, startDate, endDate, createdAt: Date.now(), participants };
    this.set({ weeks: { ...this.state.weeks, [id]: week } });
    this.write('weeks/' + id, week);
    toast('Week created');
    return id;
  }

  updateWeekDates(weekId: string, startDate: string, endDate: string) {
    const w = this.state.weeks[weekId];
    if (!w) return;
    this.set({ weeks: { ...this.state.weeks, [weekId]: { ...w, startDate, endDate } } });
    this.update('weeks/' + weekId, { startDate, endDate });
    toast('Dates updated');
  }

  deleteWeek(weekId: string) {
    const weeks = { ...this.state.weeks };
    delete weeks[weekId];
    this.set({ weeks });
    this.remove('weeks/' + weekId);
    toast('Week deleted');
  }

  toggleUnit() {
    const unit: Unit = this.state.unit === 'kg' ? 'lb' : 'kg';
    this.set({ unit });
    this.cacheLocal();
    this.online()?.set(ROOT + '/settings/unit', unit).catch(console.error);
    toast('Unit set to ' + unit);
  }

  latestWeek(): Week | undefined { return sortedWeeks(this.state.weeks)[0]; }
}

function withParticipant(weeks: WeeksMap, weekId: string, pid: string, p: Participant): WeeksMap {
  const w = weeks[weekId];
  return { ...weeks, [weekId]: { ...w, participants: { ...w.participants, [pid]: p } } };
}

export const weightStore = new WeightStore();
