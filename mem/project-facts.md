# Project facts & gotchas

- **Currency is ₱ (peso)**, hardcoded in `fmtMoney`. The old CLAUDE.md said `$`, which was wrong.
- **Weights are always stored in kg.** The kg/lb toggle only changes display/input (`cw`,
  `unitToKg`, `inputValue` in legacy `weight.html`). Note that README's "Notes" section claims the
  toggle doesn't convert, which is outdated.
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
