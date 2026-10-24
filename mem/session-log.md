# Session log

Newest first. Keep each entry short.

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
