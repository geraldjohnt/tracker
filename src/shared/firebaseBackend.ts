import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, remove, set, update, type Database } from 'firebase/database';
import type { Backend, ConnState, Unsubscribe } from './backend';

// Same project for every tracker; each one writes under its own root node.
// Analytics (measurementId) is intentionally unused.
export const firebaseConfig = {
  apiKey: 'AIzaSyDjgrtAtTbnsiqlkQasi2GD7xBufE2AUSY',
  authDomain: 'tracker-8dcc0.firebaseapp.com',
  databaseURL: 'https://tracker-8dcc0-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'tracker-8dcc0',
  storageBucket: 'tracker-8dcc0.firebasestorage.app',
  messagingSenderId: '686440896820',
  appId: '1:686440896820:web:e4a2b3b18f4b7d94cb2d61',
};

export class FirebaseBackend implements Backend {
  readonly kind = 'firebase' as const;
  private db: Database;

  constructor() {
    this.db = getDatabase(initializeApp(firebaseConfig));
  }

  on(path: string, cb: (value: unknown) => void, onError?: (err: Error) => void): Unsubscribe {
    return onValue(ref(this.db, path), snap => cb(snap.val()), err => onError?.(err));
  }

  onConnection(cb: (state: ConnState) => void): Unsubscribe {
    return onValue(ref(this.db, '.info/connected'), snap => cb(snap.val() === true ? 'online' : 'offline'));
  }

  set(path: string, value: unknown) { return set(ref(this.db, path), value); }
  update(path: string, patch: Record<string, unknown>) { return update(ref(this.db, path), patch); }
  remove(path: string) { return remove(ref(this.db, path)); }
}
