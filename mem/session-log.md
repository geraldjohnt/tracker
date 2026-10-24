# Session log

Newest first. Keep each entry short.

## 2026-10-24 — LevelUp phase 2: ranking board + equipment rule
- Phase 1 merged (geraldjohnt/tracker#8).
- Ranking tab: opt-in board at `leaderboard/<uid>` with join/leave confirm dialogs; sample mode seeds
  4 sample players (`sampleShared()`). Daily quests now bodyweight-only; L-sit is the floor version.
- 67 tests. Owner rule added: PR + merge after each phase, then stop and wait.
- **Owner to do:** re-publish the rules (adds `leaderboard/`).

## 2026-10-24 — LevelUp (Exercise) part 1
- New page `exercise.html` (`src/exercise/`): 48-exercise catalog with beginner how-tos, gender
  recommendation and an SVG body map; levels (20 XP, +10%/level), ranks (5 levels each), 3 daily
  quests, 4 optional quests (accept → complete), missed-day penalties, streak, history, library.
- Rules: new `exercises/` (shared, owner-written) and `users/$uid/exerciseTracker`. **Owner must
  re-publish the rules**, then open the page as geraldjohnt to publish the catalog.
- `MemoryBackend.update()` is now atomic (one notification per multi-path update, like Firebase).
- 64 tests. Checked in the browser (sample mode, desktop + mobile, light + dark) with Playwright.
- Next: see the roadmap in `mem/exercise.md` (camera form check, dashboard card, …).

## 2026-10-24 — Mobile bottom nav
- Below 768px the sidebar and menu button are hidden; `AppShell` renders a bottom tab bar (Home / Weight / Spendly).
  Each page passes `page=`. Toasts sit above the bar.
- WeighIn: This Week / All Weeks merged into one tab with a segmented toggle at the top (mobile only).
- Home (dashboard) is in the bar too, since the sidebar was the only way back to it on mobile.

## 2026-10-24 — Accounts (log in, register, change password, per-user data)
- Added `AuthService` (Firebase email/password | sample `MemoryAuth`), `AuthGate` on every page, `AccountMenu` with
  Change password / Sign out. Data now lives under `users/<uid>/…`; rules lock each account to its own subtree.
- `legacy.ts` copies the pre-login root data into `geraldjohnt`'s account on its first sign-in; the root nodes stay
  untouched and read-only. 42 tests. Checked end to end in sample mode with Playwright.
- The owner's account couldn't be created from the session (sign-up API call was blocked). **Owner to do:** enable
  Email/Password auth → merge/deploy → register `geraldjohnt` → publish `database.rules.json` → reload.

## 2026-10-24 — Phase 5 (cleanup) — migration complete
- CLAUDE.md and README rewritten for React/TS/Vite (removed the "single-file, no build" guidance; fixed the ₱ and kg/lb notes).
- Added `src/shared/rules.test.ts`: a CRUD pass on both stores must only write keys allowed by `database.rules.json`. 35 tests.
- Possible follow-ups (not started): lock the DB down with auth; add an ESLint config; e2e tests in CI using the
  sample backend (Playwright is available locally, not in CI).

## 2026-10-24 — Phase 4 (spending.html)
- Phase 3 merged (geraldjohnt/tracker#3).
- Spendly ported: `src/spending/` (store, views.tsx with Day/Calendar/Week/Month/Year, BarChart, period summaries in derive.ts).
- Added date helpers to `src/shared/dates.ts` (fmtRangeShort, monthLabel, daysInMonth, daysInYear, shiftMonth, weekdayShort).
- 34 unit tests, including the "current period averages over elapsed days" rule.
- Next: Phase 5 cleanup (rewrite README + CLAUDE.md for the new architecture, final mem refresh).

## 2026-10-24 — Phase 3 (weight.html)
- Phase 2 merged (geraldjohnt/tracker#2).
- WeighIn ported: `src/weight/` (store with pending-edit reconciliation, WeekView, AllWeeksPage, WeekModal, units, derive).
- Shared additions: Toasts, ConfirmModal, useBsModal, DraftInput, SidebarLink/SidebarDivider (each page now passes its own `nav`).
- MemoryBackend now strips nulls inside written objects (as Firebase does). 27 unit tests.
- Vendor chunk splitting added.
- Next: Phase 4 (spending.html), then Phase 5 cleanup (README, CLAUDE.md rewrite).

## 2026-10-24 — Phase 2 (dashboard)
- Phase 1 merged to main (geraldjohnt/tracker#1); the Pages deploy runs from Actions.
- Dashboard ported to React (`src/dashboard/`). Visual parity checked against legacy with identical sample data (see migration.md).
- Fixed in the shared AppShell: the sidebar collapsed preference is saved only on a desktop toggle (legacy behavior).
- Next: Phase 3 (weight.html), the largest page. Consider vendor chunk splitting (`manualChunks`) once two pages share React/Firebase.

## 2026-10-24 — migration kickoff
- Assessed conversion. Python ruled out for GitHub Pages; owner chose React + TypeScript + Vite, built by
  Actions, phased.
- Phase 1: scaffold, shared modules, MemoryBackend/sample data, 14 unit tests, workflow, `mem/`.
- Owner rule added: never touch existing Firebase data; CRUD tests on sample data only.
- Next: Phase 2 (dashboard).
