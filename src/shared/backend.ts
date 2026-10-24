// Storage backend abstraction. Two implementations share one interface:
//   - FirebaseBackend: the real Realtime Database (production builds only).
//   - MemoryBackend:   an in-memory JSON tree seeded with sample data, used by
//                      `npm run dev` and every test. It never talks to Firebase,
//                      so local development and CRUD testing can't touch real data.
// Paths are slash-separated and relative to the database root, e.g. "weightTracker/weeks".

export type Unsubscribe = () => void;
export type ConnState = 'online' | 'offline' | 'local';

export interface Backend {
  readonly kind: 'firebase' | 'memory';
  on(path: string, cb: (value: unknown) => void, onError?: (err: Error) => void): Unsubscribe;
  onConnection(cb: (state: ConnState) => void): Unsubscribe;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, patch: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
}

const split = (path: string) => path.split('/').filter(Boolean);
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

type Tree = Record<string, unknown>;

export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const;
  private tree: Tree;
  private listeners = new Set<{ path: string; cb: (v: unknown) => void }>();

  constructor(seed: Tree = {}, private persistKey?: string) {
    let initial: Tree | null = null;
    if (persistKey) {
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw) initial = JSON.parse(raw);
      } catch { /* storage unavailable — fall back to the seed */ }
    }
    this.tree = initial ?? clone(seed);
  }

  /** Current value at a path (a deep copy, like a Firebase snapshot). */
  get(path: string): unknown {
    let node: unknown = this.tree;
    for (const k of split(path)) {
      if (node === null || typeof node !== 'object') return null;
      node = (node as Tree)[k];
    }
    return node === undefined ? null : clone(node);
  }

  on(path: string, cb: (value: unknown) => void): Unsubscribe {
    const l = { path, cb };
    this.listeners.add(l);
    // Firebase fires value listeners asynchronously with the current value; mirror that.
    queueMicrotask(() => { if (this.listeners.has(l)) cb(this.get(path)); });
    return () => { this.listeners.delete(l); };
  }

  onConnection(cb: (state: ConnState) => void): Unsubscribe {
    queueMicrotask(() => cb('local'));
    return () => {};
  }

  async set(path: string, value: unknown): Promise<void> {
    const keys = split(path);
    if (!keys.length) { this.tree = (clone(value) as Tree) ?? {}; this.changed(); return; }
    let node = this.tree;
    for (const k of keys.slice(0, -1)) {
      if (node[k] === null || typeof node[k] !== 'object') node[k] = {};
      node = node[k] as Tree;
    }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = clone(value);
    this.prune();
    this.changed();
  }

  async update(path: string, patch: Record<string, unknown>): Promise<void> {
    // Firebase update(): each key may itself be a relative path ("participants/p_1/name").
    for (const [k, v] of Object.entries(patch)) await this.set(path + '/' + k, v);
  }

  async remove(path: string): Promise<void> {
    await this.set(path, null);
  }

  /** Firebase never stores empty objects; drop them so reads match production. */
  private prune(node: Tree = this.tree): boolean {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v !== null && typeof v === 'object' && this.prune(v as Tree)) delete node[k];
    }
    return Object.keys(node).length === 0;
  }

  private changed() {
    if (this.persistKey) {
      try { localStorage.setItem(this.persistKey, JSON.stringify(this.tree)); } catch { /* ignore */ }
    }
    for (const l of [...this.listeners]) l.cb(this.get(l.path));
  }
}
