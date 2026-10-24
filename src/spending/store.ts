// Spendly state + persistence, outside React (exposed through useSyncExternalStore).
// Same semantics as legacy spending.html (and src/weight/store.ts): live
// `expenses` listener, localStorage mirror, local-only fallback, and pending-edit
// reconciliation for the Day view's inline item/price inputs.
import type { Backend } from '../shared/backend';
import { uid } from '../shared/format';
import { getBackend, isSampleMode } from '../shared/store';
import { toast } from '../shared/toast';
import { SPEND_ROOT, type Expense } from '../shared/types';
import { normalizeExpenses, type ExpensesMap } from './derive';

const ROOT = SPEND_ROOT; // change to run a second, separate tracker
// Sample mode gets its own cache key so sample data never overwrites the real offline cache.
const LS_KEY = 'spendly.cache.v1' + (isSampleMode() ? '.sample' : '');
const SAVE_DEBOUNCE_MS = 450;

export type ExpenseField = 'item' | 'price';

export interface SpendingState {
  expenses: ExpensesMap;
  ready: boolean;
  usingLocal: boolean;
}

interface PendingEdit { id: string; field: ExpenseField; value: string | number }

export class SpendingStore {
  private state: SpendingState = { expenses: {}, ready: false, usingLocal: false };
  private listeners = new Set<() => void>();
  private backend: Backend | null = null;
  private pending: Record<string, PendingEdit> = {};
  private saveTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private started = false;

  constructor(private getBackendFn: () => Backend | null = getBackend, private lsKey = LS_KEY) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;

  private set(patch: Partial<SpendingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  private cacheLocal() {
    try { localStorage.setItem(this.lsKey, JSON.stringify({ expenses: this.state.expenses })); } catch { /* ignore */ }
  }
  private readLocal(): { expenses?: ExpensesMap } | null {
    try { const raw = localStorage.getItem(this.lsKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  start() {
    if (this.started) return;
    this.started = true;
    const cached = this.readLocal();
    if (cached) this.set({ expenses: normalizeExpenses(cached.expenses || {}) });

    this.backend = this.getBackendFn();
    if (!this.backend) {
      this.set({ usingLocal: true, ready: true });
      toast('Firebase unavailable — saving to this device only', true);
      return;
    }
    this.backend.on(ROOT + '/expenses', v => {
      this.state = { ...this.state, expenses: normalizeExpenses(v as Record<string, Expense> | null), ready: true };
      this.applyPending();
      this.cacheLocal();
      this.set({});
    }, err => {
      console.error(err);
      this.set({ usingLocal: true, ready: true });
      toast('Database read denied — check your rules', true);
    });
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
    let expenses = this.state.expenses;
    for (const [key, e] of Object.entries(this.pending)) {
      const exp = expenses[e.id];
      if (!exp) { delete this.pending[key]; continue; }
      expenses = { ...expenses, [e.id]: { ...exp, [e.field]: e.value } };
    }
    this.state = { ...this.state, expenses };
  }

  private commit(key: string, e: PendingEdit) {
    this.update('expenses/' + e.id, { [e.field]: e.value }).then(() => {
      if (this.pending[key] && this.pending[key].value === e.value) delete this.pending[key];
    });
  }

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

  setField(id: string, field: ExpenseField, value: string | number) {
    const exp = this.state.expenses[id];
    if (!exp) return;
    this.set({ expenses: { ...this.state.expenses, [id]: { ...exp, [field]: value } } });
    const key = id + '/' + field;
    const e = { id, field, value };
    this.pending[key] = e;
    const t = this.saveTimers[key];
    if (t) clearTimeout(t);
    this.saveTimers[key] = setTimeout(() => { this.saveTimers[key] = null; this.commit(key, e); }, SAVE_DEBOUNCE_MS);
  }

  addExpense(date: string, item: string, price: number) {
    const id = uid('e');
    const exp: Expense = { date, item, price, createdAt: Date.now() };
    this.set({ expenses: { ...this.state.expenses, [id]: { ...exp, id } } });
    this.write('expenses/' + id, exp);
    toast('Expense added');
    return id;
  }

  deleteExpense(id: string) {
    const expenses = { ...this.state.expenses };
    delete expenses[id];
    this.set({ expenses });
    this.remove('expenses/' + id);
    toast('Expense deleted');
  }
}

export const spendingStore = new SpendingStore();
