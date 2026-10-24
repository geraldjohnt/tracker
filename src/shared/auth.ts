// Sign-in abstraction. Two implementations share one interface, like backend.ts:
//   - FirebaseAuthService: Firebase Authentication (production builds only).
//   - MemoryAuth:          accounts kept in this browser's localStorage, used by
//                          `npm run dev`, `?sample=1` and tests. Never talks to Firebase.
//
// People sign in with a username, not an email. Firebase's email/password provider
// needs an email, so a username maps to `<username>@<USER_EMAIL_DOMAIN>`. Nothing is
// ever sent to that address. Because Firebase keeps emails unique, usernames are unique too.
import type { Unsubscribe } from './backend';

export interface AuthUser {
  uid: string;
  username: string;
}

export interface AuthService {
  readonly kind: 'firebase' | 'memory';
  /** Fires (asynchronously) with the signed-in user, or null, and again on every change. */
  onChange(cb: (user: AuthUser | null) => void): Unsubscribe;
  signIn(username: string, password: string): Promise<AuthUser>;
  register(username: string, password: string): Promise<AuthUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
}

/** An error whose message is safe to show to the user as-is. */
export class AuthError extends Error {}

export const USER_EMAIL_DOMAIN = 'tracker-8dcc0.firebaseapp.com';
export const MIN_PASSWORD = 6; // Firebase's minimum
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const usernameToEmail = (u: string) => normalizeUsername(u) + '@' + USER_EMAIL_DOMAIN;
export const emailToUsername = (email: string | null) => (email || '').split('@')[0];

/** Problem with a username for registration, or null if it's fine. */
export function usernameProblem(u: string): string | null {
  return USERNAME_RE.test(normalizeUsername(u))
    ? null
    : 'Usernames are 3–30 characters: letters, numbers, dots, dashes or underscores';
}

export function passwordProblem(p: string): string | null {
  return p.length >= MIN_PASSWORD ? null : 'Passwords need at least ' + MIN_PASSWORD + ' characters';
}

/* ---------- sample-mode accounts ---------- */

interface MemoryAccounts {
  // Sample mode only: these are throwaway local accounts, so passwords are kept as-is.
  users: Record<string, { uid: string; password: string }>;
  current: string | null; // username
}

export class MemoryAuth implements AuthService {
  readonly kind = 'memory' as const;
  private data: MemoryAccounts = { users: {}, current: null };
  private listeners = new Set<(u: AuthUser | null) => void>();

  constructor(private persistKey?: string) {
    if (!persistKey) return;
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) this.data = JSON.parse(raw);
    } catch { /* storage unavailable — start signed out */ }
  }

  private user(): AuthUser | null {
    const name = this.data.current;
    const rec = name ? this.data.users[name] : undefined;
    return name && rec ? { uid: rec.uid, username: name } : null;
  }

  private changed() {
    if (this.persistKey) {
      try { localStorage.setItem(this.persistKey, JSON.stringify(this.data)); } catch { /* ignore */ }
    }
    const u = this.user();
    for (const l of [...this.listeners]) l(u);
  }

  onChange(cb: (user: AuthUser | null) => void): Unsubscribe {
    this.listeners.add(cb);
    queueMicrotask(() => { if (this.listeners.has(cb)) cb(this.user()); });
    return () => { this.listeners.delete(cb); };
  }

  async signIn(username: string, password: string): Promise<AuthUser> {
    const name = normalizeUsername(username);
    const rec = this.data.users[name];
    if (!rec || rec.password !== password) throw new AuthError('Wrong username or password');
    this.data.current = name;
    this.changed();
    return this.user()!;
  }

  async register(username: string, password: string): Promise<AuthUser> {
    const problem = usernameProblem(username) ?? passwordProblem(password);
    if (problem) throw new AuthError(problem);
    const name = normalizeUsername(username);
    if (this.data.users[name]) throw new AuthError('That username is already taken');
    this.data.users[name] = { uid: 'u_' + Math.random().toString(36).slice(2, 12), password };
    this.data.current = name;
    this.changed();
    return this.user()!;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const name = this.data.current;
    const rec = name ? this.data.users[name] : undefined;
    if (!rec) throw new AuthError('Please sign in again');
    if (rec.password !== currentPassword) throw new AuthError('Current password is incorrect');
    const problem = passwordProblem(newPassword);
    if (problem) throw new AuthError(problem);
    rec.password = newPassword;
    this.changed();
  }

  async signOut(): Promise<void> {
    this.data.current = null;
    this.changed();
  }
}
