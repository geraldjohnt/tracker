// Picks the storage backend once per page load.
// (In sample mode the tree holds the legacy-root sample data plus shared nodes like the ranking board.)
//
// Production builds talk to Firebase. Everything else uses the in-memory
// sample-data backend, so development can never read or write real data:
//   - `npm run dev`            → sample data (always)
//   - any page with ?sample=1  → sample data (handy for checking a production build)
//   - tests                    → construct MemoryBackend directly
import { MemoryAuth, type AuthService } from './auth';
import { MemoryBackend, type Backend } from './backend';
import { FirebaseAuthService } from './firebaseAuth';
import { FirebaseBackend } from './firebaseBackend';
import { sampleShared, sampleTree } from './sampleData';

export const SAMPLE_STORAGE_KEY = 'tracker.sample.v1';
export const SAMPLE_AUTH_KEY = 'tracker.sample.auth.v1';

export function isSampleMode(): boolean {
  if (import.meta.env.DEV) return true;
  try { return new URLSearchParams(location.search).has('sample'); } catch { return false; }
}

let backend: Backend | null | undefined;

/** The shared backend, or null if Firebase failed to initialize. */
export function getBackend(): Backend | null {
  if (backend !== undefined) return backend;
  if (isSampleMode()) {
    backend = new MemoryBackend({ ...sampleTree(), ...sampleShared() }, SAMPLE_STORAGE_KEY);
  } else {
    try { backend = new FirebaseBackend(); }
    catch (e) { console.error(e); backend = null; }
  }
  return backend;
}

let auth: AuthService | null | undefined;

/** The shared sign-in service (sample accounts in sample mode), or null if Firebase failed to initialize. */
export function getAuthService(): AuthService | null {
  if (auth !== undefined) return auth;
  if (isSampleMode()) {
    auth = new MemoryAuth(SAMPLE_AUTH_KEY);
  } else {
    try { auth = new FirebaseAuthService(); }
    catch (e) { console.error(e); auth = null; }
  }
  return auth;
}
