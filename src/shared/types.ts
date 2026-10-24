// Data shapes stored in Firebase Realtime Database, per account under users/<uid>/. Must stay in sync with
// database.rules.json — the rules reject unknown keys, so adding a field here
// without adding it there makes every write fail.

export type ISODate = string; // "YYYY-MM-DD", always interpreted as a LOCAL date

export interface Participant {
  name: string;
  startWeight: number | null; // kg — always stored in kg regardless of the unit toggle
  endWeight: number | null;   // kg
  order: number;
}

export interface Week {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  createdAt: number; // ms epoch
  participants: Record<string, Participant>;
}

export interface Expense {
  id?: string; // filled from the key after a snapshot; not stored
  date: ISODate;
  item: string;
  price: number | null;
  createdAt: number;
}

export type Theme = 'light' | 'dark';
export type Unit = 'kg' | 'lb';

export const WEIGHT_ROOT = 'weightTracker';
export const SPEND_ROOT = 'spendingTracker';

// Every account's data lives under users/<uid>/<tracker root>. The top-level
// weightTracker / spendingTracker nodes are the pre-login data, kept read-only
// as a backup and copied into the owner's account on first sign-in (legacy.ts).
export const USERS_ROOT = 'users';
export const userRoot = (uid: string, root: string) => USERS_ROOT + '/' + uid + '/' + root;
