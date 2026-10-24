# Session log

Newest first. Keep each entry short.

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
