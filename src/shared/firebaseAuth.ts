import {
  EmailAuthProvider, createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword,
  type Auth, type User,
} from 'firebase/auth';
import {
  AuthError, emailToUsername, passwordProblem, usernameProblem, usernameToEmail,
  type AuthService, type AuthUser,
} from './auth';
import type { Unsubscribe } from './backend';
import { firebaseApp } from './firebaseBackend';

const toUser = (u: User): AuthUser => ({ uid: u.uid, username: emailToUsername(u.email) });

/** Firebase error codes → messages for people; anything unexpected is logged and generalized. */
function friendly(err: unknown, wrongPassword = 'Wrong username or password'): AuthError {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new AuthError(wrongPassword);
    case 'auth/email-already-in-use': return new AuthError('That username is already taken');
    case 'auth/weak-password': return new AuthError(passwordProblem('')!);
    case 'auth/too-many-requests': return new AuthError('Too many attempts. Try again in a few minutes');
    case 'auth/network-request-failed': return new AuthError('No connection. Check your internet and try again');
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired': return new AuthError('Please sign out and sign in again');
    case 'auth/operation-not-allowed':
      return new AuthError('Username sign-in is not enabled for this Firebase project yet');
  }
  console.error(err);
  return new AuthError('Something went wrong. Please try again');
}

export class FirebaseAuthService implements AuthService {
  readonly kind = 'firebase' as const;
  private auth: Auth;

  constructor() {
    this.auth = getAuth(firebaseApp());
  }

  onChange(cb: (user: AuthUser | null) => void): Unsubscribe {
    return onAuthStateChanged(this.auth, u => cb(u ? toUser(u) : null));
  }

  async signIn(username: string, password: string): Promise<AuthUser> {
    try { return toUser((await signInWithEmailAndPassword(this.auth, usernameToEmail(username), password)).user); }
    catch (e) { throw friendly(e); }
  }

  async register(username: string, password: string): Promise<AuthUser> {
    const problem = usernameProblem(username) ?? passwordProblem(password);
    if (problem) throw new AuthError(problem);
    try { return toUser((await createUserWithEmailAndPassword(this.auth, usernameToEmail(username), password)).user); }
    catch (e) { throw friendly(e); }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const u = this.auth.currentUser;
    if (!u?.email) throw new AuthError('Please sign in again');
    const problem = passwordProblem(newPassword);
    if (problem) throw new AuthError(problem);
    // Firebase requires a recent sign-in to change a password; re-checking the current one does that.
    try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword)); }
    catch (e) { throw friendly(e, 'Current password is incorrect'); }
    try { await updatePassword(u, newPassword); }
    catch (e) { throw friendly(e); }
  }

  signOut() { return signOut(this.auth); }
}
