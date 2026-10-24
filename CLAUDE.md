# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Portable memory — read first

@mem/MEMORY.md

The `mem/` folder is the project memory and travels with the repo. Read it at session start,
follow `mem/rules.md` (hard rules, including **never touch the existing Firebase data**), and
update `mem/` (decisions, facts, session log) before you finish.

## What this is

Two trackers plus a dashboard that share one Firebase Realtime Database project, hosted on GitHub
Pages:

- `index.html`: the dashboard, a read-only overview of both trackers
- `weight.html`: **WeighIn**, a weekly weight-challenge tracker
- `spending.html`: **Spendly**, a daily spending tracker

Each page is a React 19 + TypeScript app built by **Vite 7** as a multi-page build. The three HTML
files at the repo root are thin entries (`<div id="root">` + one module script); the URLs stay the
same as the original single-file versions. GitHub Actions builds the site and deploys `dist/`.
The built site does **not** open from `file://`; use `npm run dev` or `npm run preview`.

## Commands

```
npm ci              # install
npm run dev         # dev server — ALWAYS sample data, never Firebase
npm test            # Vitest unit tests (jsdom)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + vite build → dist/
npm run preview     # serve dist/; add ?sample=1 to any page to use sample data
```

CI (`.github/workflows/static.yml`) runs typecheck, tests and build on every PR and push; it deploys
to Pages only from `main`. Pages source must be set to **GitHub Actions**.

## Layout

```
index.html / weight.html / spending.html   Vite entries (same URLs as before)
database.rules.json                        Realtime DB rules (paste into the Firebase console)
src/
  styles/        shared CSS: tokens, templates, palettes, base, appearance menu, sidebar shell
  shared/        types, dates, format, backend (Firebase | in-memory sample), store selection,
                 appearance + useAppearance, toast, hooks, sampleData
    components/  AppShell (+SidebarLink/SidebarDivider), AppearanceMenu, ConnPill, ChartCanvas,
                 DraftInput, ConfirmModal, useBsModal, Toasts
  dashboard/     Dashboard, WeightCard, SpendCard, dashboard.css
  weight/        store, derive, units, WeightApp, WeekView, AllWeeksPage, WeekModal, weight.css
  spending/      store, derive, SpendingApp, views (Day/Calendar/Week/Month/Year), BarChart, spending.css
mem/             portable project memory (see above)
```

## Architecture

### Storage backend (`src/shared/backend.ts`, `store.ts`)
A `Backend` interface (`on`, `onConnection`, `set`, `update`, `remove`) has two implementations:
- `FirebaseBackend`: the modular Firebase SDK, used by production builds.
- `MemoryBackend`: an in-memory JSON tree seeded from `sampleData.ts` and persisted to
  `localStorage['tracker.sample.v1']`. It mimics Firebase's quirks: async first value, nulls
  stripped on write, empty parents pruned.

`getBackend()` picks `MemoryBackend` for `npm run dev` (always) and for `?sample=1`, so development
can never touch real data. Tests construct `MemoryBackend` directly. `getBackend()` returns `null`
if Firebase fails to initialize, and the stores then fall back to local-only mode.

### Tracker stores (`src/weight/store.ts`, `src/spending/store.ts`)
Plain classes outside React, read with `useSyncExternalStore` and started from `main.tsx`. Each one:
- listens to `<ROOT>/weeks` or `<ROOT>/expenses` and normalizes snapshots (`derive.ts`);
- mirrors state to localStorage (`weighin.cache.v1` / `spendly.cache.v1`, plus a `.sample` suffix
  in sample mode) so the app opens offline;
- switches to `usingLocal` (header pill "Local only") if the backend is missing or a read is denied;
- **pending-edit reconciliation**: each inline field edit is recorded in `pending`, written after a
  450ms debounce (`flushSaves` on blur), and re-applied on top of every incoming snapshot until
  its write resolves. Preserve this; removing it reintroduces data loss on concurrent edits.

Inline inputs use `DraftInput`: it owns its text while focused and accepts prop updates only when
unfocused or on blur. This is the React form of the old `isEditing`/`requestRender` guard, and it
keeps snapshots and lb rounding from rewriting what the user is typing.

### Derived data
Pure, unit-tested functions in `src/weight/derive.ts` and `src/spending/derive.ts`, recomputed on
every render; nothing is cached beyond store state. Key rules:
- **Delta** = `endWeight − startWeight`. Loss (negative) renders green (`.loss`), gain renders red
  (`.gain`), via `--good`/`--bad`.
- **All-time** aggregation matches people by trimmed, case-insensitive name, not id, so renaming
  someone creates a new identity.
- **Spending averages**: the period containing today divides by days/months elapsed so far; past
  periods divide by the full period length.
- **Weeks start on Monday** (`startOfWeek`), independent of locale. Dates are always parsed as
  local dates (`src/shared/dates.ts`), never `new Date('YYYY-MM-DD')`.
- **New week**: the start defaults to the previous week's end, and the end auto-fills to start + 7
  but stays editable (`endTouched`). Carry-over copies participants and uses each person's
  `endWeight ?? startWeight` as the new `startWeight`.

### Units and currency
All weights are stored in **kg**. The kg/lb toggle (`settings/unit`) only changes display and the
interpretation of typed values (`src/weight/units.ts`: `cw`, `unitToKg`, `inputValue`). Prices are
plain numbers shown with a hardcoded **₱**; there is no currency toggle.

### Appearance
`data-bs-theme` (light/dark), `data-template` (`default`/`neomorphism`/`glassmorphism`/
`claymorphism`/`minimalism`/`liquidglass`/`spatial`) and `data-palette` (`indigo`/`rose`/`emerald`/
`amber`/`ocean`/`violet`/`slate`/`sunset`) on `<html>`, defined in `src/shared/appearance.ts`.
Each page's `main.tsx` applies the saved choice before first paint.
- Per-page localStorage prefixes: `weighin.*`, `spendly.*`, `dashboard.*`.
- `useAppearance(prefix, syncRoot)` also mirrors the choice to `<root>/settings/{theme,template,palette}`
  for the trackers. The dashboard passes no `syncRoot` and stays device-local.
- Templates only redefine *shape* tokens; palettes only redefine *accent* tokens. `default`/`indigo`
  intentionally have **no** CSS rules: never add `[data-template="default"]` or
  `[data-palette="indigo"]`. Palette colors are curated pairs, and there is no free color picker.
- Each page's CSS (`src/<page>/<page>.css`) starts with its own "surfaces that pick up a template's
  blur" selector list, because it names that page's own surface classes.
- Charts read `--accent`/`--muted`/`--border` from `:root` and are recreated whenever the
  appearance changes (`ChartCanvas` deps).

### Data shape (Realtime Database)

```
weightTracker/
  settings/ unit: "kg"|"lb", theme, template, palette
  weeks/
    w_<id>/ { id, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", createdAt: <ms>,
              participants/ p_<id>/ { name, startWeight?, endWeight?, order } }

spendingTracker/
  settings/ theme, template, palette
  expenses/
    e_<id>/ { date: "YYYY-MM-DD", item, price, createdAt: <ms> }   (no `id` field: rules reject it)
```

`database.rules.json` enforces this shape and rejects unknown keys. `src/shared/rules.test.ts`
fails if any store write isn't allowed by the rules. Types live in `src/shared/types.ts`. After a
schema change, update types, rules and tests together, and have the owner re-publish the rules in
the Firebase console.

## Notes

- No authentication: the rules are open read/write. See README.md for how to lock this down.
- Firebase Analytics is intentionally omitted.
- Visual parity with the original single-file pages was verified by screenshot diffing against the
  pre-migration HTML (`git show fe581ba:weight.html`). The method is in `mem/migration.md`.
