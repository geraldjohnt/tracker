import { useEffect, useState } from 'react';
import type { ConnState } from './backend';
import { getBackend } from './store';

export interface Live<T> {
  value: T;
  ready: boolean;     // first snapshot (or error) arrived
  error: Error | null;
}

/** Live value at a database path. `fallback` is used until the first snapshot and whenever the node is empty. */
export function useLiveValue<T>(path: string, fallback: T): Live<T> {
  const [live, setLive] = useState<Live<T>>({ value: fallback, ready: false, error: null });
  useEffect(() => {
    const b = getBackend();
    if (!b) { setLive(l => ({ ...l, ready: true, error: new Error('Database unavailable') })); return; }
    return b.on(
      path,
      v => setLive({ value: (v ?? fallback) as T, ready: true, error: null }),
      err => { console.error(err); setLive(l => ({ ...l, ready: true, error: err })); },
    );
    // fallback is intentionally not a dependency: it only seeds the initial state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return live;
}

export type ConnStatus = ConnState | 'unavailable';

export function useConnection(): ConnStatus | null {
  const [state, setState] = useState<ConnStatus | null>(null);
  useEffect(() => {
    const b = getBackend();
    if (!b) { setState('unavailable'); return; }
    return b.onConnection(setState);
  }, []);
  return state;
}
