// One-time import of the pre-login data into its owner's account.
//
// Before sign-in existed, both trackers lived at the database root
// (weightTracker/, spendingTracker/). That data belongs to LEGACY_OWNER. The first
// time that account signs in, it's copied, in one atomic multi-path update, to
// users/<uid>/… and users/<uid>/meta/legacyImported is set so it never runs again.
// The legacy nodes themselves are never written or deleted: the rules make them
// read-only and readable only by LEGACY_OWNER, so they stay as a backup.
import type { AuthUser } from './auth';
import { once, type Backend } from './backend';
import { SPEND_ROOT, USERS_ROOT, WEIGHT_ROOT } from './types';

export const LEGACY_OWNER = 'geraldjohnt';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object';
const pick = (o: Obj, keys: string[]) => {
  const out: Obj = {};
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
  return out;
};

const SETTINGS = { [WEIGHT_ROOT]: ['unit', 'theme', 'template', 'palette'], [SPEND_ROOT]: ['theme', 'template', 'palette'] };

/**
 * The update() patch (relative to users/<uid>) that copies the legacy trees, keeping
 * only the fields the rules allow. Each record is its own key, so nothing already in
 * the account is replaced wholesale.
 */
export function legacyPatch(weight: unknown, spending: unknown, importedAt: number): Obj {
  const patch: Obj = {};
  if (isObj(weight)) {
    for (const [id, w] of Object.entries(isObj(weight.weeks) ? weight.weeks : {})) {
      if (!isObj(w)) continue;
      const participants: Obj = {};
      for (const [pid, p] of Object.entries(isObj(w.participants) ? w.participants : {})) {
        if (isObj(p)) participants[pid] = pick(p, ['name', 'startWeight', 'endWeight', 'order']);
      }
      patch[WEIGHT_ROOT + '/weeks/' + id] = { ...pick(w, ['id', 'startDate', 'endDate', 'createdAt']), participants };
    }
  }
  if (isObj(spending)) {
    for (const [id, e] of Object.entries(isObj(spending.expenses) ? spending.expenses : {})) {
      if (isObj(e)) patch[SPEND_ROOT + '/expenses/' + id] = pick(e, ['date', 'item', 'price', 'createdAt']);
    }
  }
  for (const [root, keys] of Object.entries(SETTINGS)) {
    const tree = root === WEIGHT_ROOT ? weight : spending;
    const settings = isObj(tree) && isObj(tree.settings) ? tree.settings : {};
    for (const [k, v] of Object.entries(pick(settings, keys))) patch[root + '/settings/' + k] = v;
  }
  patch['meta/legacyImported'] = importedAt;
  return patch;
}

/** Copies the legacy data into LEGACY_OWNER's account once. Other accounts are left alone. */
export async function importLegacyData(backend: Backend, user: AuthUser): Promise<'imported' | 'skipped'> {
  if (user.username !== LEGACY_OWNER) return 'skipped';
  const base = USERS_ROOT + '/' + user.uid;
  if (await once(backend, base + '/meta/legacyImported')) return 'skipped';
  const [weight, spending] = await Promise.all([once(backend, WEIGHT_ROOT), once(backend, SPEND_ROOT)]);
  await backend.update(base, legacyPatch(weight, spending, Date.now()));
  return 'imported';
}
