// Picks the storage backend once per page load.
//
// Production builds talk to Firebase. Everything else uses the in-memory
// sample-data backend, so development can never read or write real data:
//   - `npm run dev`            → sample data (always)
//   - any page with ?sample=1  → sample data (handy for checking a production build)
//   - tests                    → construct MemoryBackend directly
import { MemoryBackend, type Backend } from './backend';
import { FirebaseBackend } from './firebaseBackend';
import { sampleTree } from './sampleData';

export const SAMPLE_STORAGE_KEY = 'tracker.sample.v1';

export function isSampleMode(): boolean {
  if (import.meta.env.DEV) return true;
  try { return new URLSearchParams(location.search).has('sample'); } catch { return false; }
}

let backend: Backend | null | undefined;

/** The shared backend, or null if Firebase failed to initialize. */
export function getBackend(): Backend | null {
  if (backend !== undefined) return backend;
  if (isSampleMode()) {
    backend = new MemoryBackend(sampleTree(), SAMPLE_STORAGE_KEY);
  } else {
    try { backend = new FirebaseBackend(); }
    catch (e) { console.error(e); backend = null; }
  }
  return backend;
}
