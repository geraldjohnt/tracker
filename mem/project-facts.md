# Project facts & gotchas

- **Currency is ₱ (peso)**, hardcoded in `fmtMoney`. The pre-migration CLAUDE.md said `$`, which was wrong; fixed in Phase 5.
- **Weights are always stored in kg.** The kg/lb toggle only changes display/input
  (`src/weight/units.ts`). The pre-migration README wrongly said it didn't convert; fixed in Phase 5.
- **Dates are local**, never `new Date('YYYY-MM-DD')` (that's UTC). Use `src/shared/dates.ts`.
  Weeks start on Monday (`startOfWeek`).
- **Pending-edit reconciliation** (`pending`/`applyPending`/`queueSave`/`flushSaves`, 450ms
  debounce) in weight/spending stops Firebase snapshots from clobbering in-progress keystrokes.
  Any React port must preserve this behavior.
- **All-time aggregation** matches people by trimmed, case-insensitive name, not id.
- **Firebase never stores empty objects.** `MemoryBackend` prunes them too, so sample-mode reads
  match production.
- `database.rules.json` rejects unknown keys (`$other: false`). A new field means a rules update,
  pasted into the Firebase console by the owner.
- localStorage keys: `weighin.cache.v1`, `weighin.{theme,template,palette}`, `spendly.cache.v1`,
  `spendly.*`, `dashboard.{theme,template,palette,sidebar}`, and `tracker.sample.v1` (sample mode).
- `default` template / `indigo` palette intentionally have **no** CSS rules. Never add
  `[data-template="default"]` or `[data-palette="indigo"]`.
- Each page has its own "surfaces that pick up a template's blur" selector list (page-specific
  classes). It lives in the page's CSS, not in `src/styles/`.
- `.claude/settings.local.json` holds Windows paths from the owner's other machine. It's harmless;
  leave it alone.
- **React text-node gotcha:** JSX like `<label>{label} ({unit})</label>` renders four text nodes, which kerns
  sub-pixel differently from the legacy single string and fails pixel parity. Concatenate into one string expression
  when matching legacy output.
- **Editable inputs use `DraftInput`** (`src/shared/components/DraftInput.tsx`): it owns its text while focused and
  syncs from props only when unfocused or on blur. This is the React form of legacy `isEditing`/`requestRender`, and
  stops lb display rounding ("180" → "180.0") or live snapshots from rewriting what the user is typing.
- **Sample mode uses separate cache keys** (`weighin.cache.v1.sample`, and `spendly.cache.v1.sample` once ported),
  so sample data never overwrites the real offline cache.
- `MemoryBackend` mimics Firebase quirks: async first value, null fields stripped on write, empty parents pruned.
  Keep it faithful; store tests depend on it.
- Trackers' stores (`src/<tracker>/store.ts`) live outside React and are read with `useSyncExternalStore`;
  `store.start()` is called from `main.tsx`. Tests construct a store with an injected `MemoryBackend`.
- Build output chunks: `vendor-{react,firebase,chart,bootstrap}`, `app-shared` (src/shared, src/styles, */derive.ts),
  plus one chunk per page.
- **Expense records must not contain `id`** (the rules reject unknown keys). Stores add `id` only in memory/local
  cache; `rules.test.ts` catches regressions.
