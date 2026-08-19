# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two single-file, no-build trackers that share one Firebase project: `weight.html` ("WeighIn", a
weekly weight-challenge tracker) and `spending.html` ("Spendly", a daily spending tracker). Both
are meant to be opened directly from disk or hosted as a static site on GitHub Pages. There is no
package.json, no build tool, and no test suite — each app is one HTML file.

## Files

- `weight.html` — the weight tracker. All markup, CSS, and JS are inline in this one file. The
  only external requests are CDN `<script>`/`<link>` tags (Bootstrap 5.3, Bootstrap Icons, Inter
  font, Firebase compat SDK) — these cannot be inlined but require no build step either.
- `spending.html` — the spending tracker. Same single-file, no-build shape as `weight.html`, reusing
  its CSS design tokens and persistence pattern; adds Chart.js from a CDN for the week/month/year
  bar charts. Do not split either file apart or introduce a bundler; the no-build, single-file
  constraint is intentional so they can be hosted as-is on GitHub Pages.
- `database.rules.json` — Firebase Realtime Database security rules for both apps' root nodes
  (`weightTracker` and `spendingTracker`); paste into the Firebase console (Realtime Database →
  Rules) when either schema changes.
- `README.md` — hosting steps, Firebase setup, and the data shape reference for both apps.

## Running / testing changes

There is no build or lint command. To verify changes:
- Open `weight.html` or `spending.html` directly in a browser (works from `file://`), or serve the
  folder with any static file server.
- Quick syntax check for a file's inline `<script>` block without a browser:
  `node -e "new Function(require('fs').readFileSync('weight.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"`
  (swap the filename for `spending.html`)
- There is no automated test suite.

## Architecture

### `weight.html`

Everything lives in `weight.html` inside one `<script>` block, structured top-to-bottom as:

1. **Firebase config + `ROOT` constant** — all data is written under a single
   `weightTracker` root node in Realtime Database. To run a second, independent tracker off the
   same Firebase project, change `ROOT`.
2. **`state` object** — in-memory source of truth: `weeks` (keyed by id), `currentId`, `unit`,
   `tab`. Rendering always reads from `state`, never directly from Firebase snapshots.
3. **Persistence layer** (`initStore`, `write`/`update`/`remove`, `cacheLocal`/`readLocal`) —
   Firebase Realtime DB is the source of truth when reachable (`db.ref(ROOT + '/weeks').on('value', ...)`
   for live sync), mirrored into `localStorage` on every change so the app still opens and renders
   offline. If Firebase fails to initialize or a read is denied, the app falls back to
   `usingLocal = true` and works local-only. The header connection pill reflects
   Synced / Offline / Local only.
4. **Pending-edit reconciliation** (`pending`, `applyPending`, `queueSave`, `flushSaves`) — because
   Firebase snapshots can arrive mid-keystroke and would otherwise clobber `state.weeks` wholesale,
   every field edit is tracked in `pending` and re-applied on top of incoming snapshots until the
   debounced write (450ms) confirms. `flushSaves` forces an immediate write on blur. Preserve this
   pattern when touching participant-field editing — removing it reintroduces data loss on
   concurrent edits.
5. **Derived data** (`sortedWeeks`, `currentWeek`, `peopleOf`, `delta`, `weekStatus`) — pure
   functions computed from `state` on each render; nothing is cached beyond `state` itself.
6. **Render functions** (`render`, `renderHero`, `renderStats`, `renderPeople`, `renderProgress`,
   `renderLeaderboard`, `renderAllTime`) — full re-render from `state`, except `refreshRow` which
   patches a single participant row's delta live while typing without a full re-render.
   `requestRender` defers a re-render if the user is actively focused on an input inside `#pList`
   (`isEditing`), flushing once focus leaves, so a background sync never yanks focus/cursor away
   mid-edit.
7. **Modals** (week create/edit, delete confirmation) — plain Bootstrap 5 `bootstrap.Modal`
   instances, no framework.

### Data shape (Realtime Database)

```
weightTracker/
  settings/unit: "kg" | "lb"
  settings/theme: "dark" | "light"
  weeks/
    w_<id>/
      id, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", createdAt: <ms epoch>
      participants/
        p_<id>/ { name, startWeight, endWeight, order }

spendingTracker/
  settings/theme: "dark" | "light"
  expenses/
    e_<id>/ { date: "YYYY-MM-DD", item, price, createdAt: <ms epoch> }
```

`database.rules.json` enforces this shape (date regex, field types, rejects unknown keys via
`$other: { ".validate": false }`). Keep the rules file in sync with any schema change in
`weight.html`, and re-publish it in the Firebase console.

### `spending.html`

Same structure and persistence pattern as `weight.html`, under its own `ROOT = 'spendingTracker'`
and `LS_KEY = 'spendly.cache.v1'`:

1. **`state` object** — `expenses` (flat map, keyed by id, each `{ date, item, price, createdAt }`),
   plus the current `view` (`day` | `calendar` | `week` | `month` | `year`) and one anchor date per
   view (`dayDate`, `calMonth`, `weekAnchor`, `monthAnchor`, `yearAnchor`) so switching views and
   switching back preserves where you were.
2. **Persistence layer** — identical shape to `weight.html`'s (`initStore`, `write`/`update`/`remove`,
   `cacheLocal`/`readLocal`), listening on `db.ref(ROOT + '/expenses')`. Expenses are a flat list
   rather than nested under a parent record, so all day/week/month/year/calendar aggregation is
   done by filtering `state.expenses` on `date` in derived-data functions (`expensesOnDate`,
   `expensesInRange`, `dayTotal`, `totalOf`) rather than by reading a pre-grouped tree.
3. **Pending-edit reconciliation** (`pending`, `applyPending`, `queueSave`, `flushSaves`) — same
   pattern as `weight.html`'s participant-field editing, scoped to inline item/price inputs inside
   `#dayList` in the Day view; `isEditing`/`requestRender` guard against a background sync stealing
   focus mid-keystroke there. Other views have no live-editable inputs and just call `render()`
   directly.
4. **Render** — `render()` shows the active view's `.page` section and dispatches to `renderDay`,
   `renderCalendar`, `renderWeek`, `renderMonth`, or `renderYear`. `refreshDayTotals` patches the Day
   view's total/count/average without a full re-render while a price input is focused (mirrors
   `weight.html`'s `refreshRow`). Week/Month/Year charts are Chart.js bar charts drawn by the shared
   `renderBarChart(canvasId, labels, data)` helper, which reads `--accent`/`--muted`/`--border` off
   `:root` so chart colors follow the current theme; charts are destroyed and recreated on every
   render (`charts` keyed by canvas id) rather than updated in place.
5. **Averages** — for the period containing today, averages divide by days/months *elapsed so far*
   (e.g. this month's avg/day divides by today's day-of-month, not the full month length); for past
   periods they divide by the full period length. See the avg calculations in `renderCalendar`,
   `renderWeek`, `renderMonth`, `renderYear`.
6. **Weeks** are Monday-start (`startOfWeek`), independent of any locale setting.

### Key domain logic

- **New week dates**: start date defaults to the previous week's end date; end date auto-fills to
  exactly start + 7 days but remains independently editable (`addDays`, the `mStart`/`mEnd` change
  handlers, `endTouched` flag).
- **Carry-over**: creating a new week can copy participants from the previous week, using each
  person's `endWeight` (falling back to `startWeight`) as the new week's `startWeight`
  (`fillCarry`).
- **Delta/gain-loss**: `delta(p)` computes `endWeight - startWeight`; positive (gain) renders red
  (`.delta.gain`), negative (loss) renders green (`.delta.loss`), styled via CSS custom properties
  (`--good`/`--bad`) that flip values for dark mode.
- **All-time aggregation**: `renderAllTime` aggregates participants across all weeks by
  case-insensitive name match, not by participant id — renaming a person creates a new identity in
  the all-time table.

### Theming

Dark/light mode is driven by CSS custom properties redefined under `[data-bs-theme="dark"]`, toggled
via `applyTheme`/`themeBtn`, persisted to `localStorage` (`weighin.theme`) for instant flash-free
load, and defaulting to `prefers-color-scheme` on first load. The chosen theme is also mirrored to
Firebase at `settings/theme` (same pattern as `settings/unit`), so toggling the theme on one device
syncs it to others; the Firebase listener in `initStore` only calls `applyTheme` when the incoming
value differs from the current DOM state, to avoid redundant re-renders.

## Notes

- No authentication: `database.rules.json` is open read/write for both root nodes. Anyone with the
  Firebase project's config embedded in `weight.html`/`spending.html` can read/write data. See
  README.md for how to lock this down with anonymous/Google auth if needed.
- Firebase Analytics is intentionally omitted from both apps — it needs no configuration here and
  errors when the page is opened via `file://`.
- The kg/lb unit toggle in `weight.html` only changes the displayed label; it does not convert
  stored numeric values. `spending.html` has no currency toggle — all prices are plain numbers
  displayed with a hardcoded `$` prefix.
