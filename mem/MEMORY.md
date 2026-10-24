# Project memory — read first

Two trackers + a dashboard sharing one Firebase Realtime Database project, hosted on GitHub Pages:
`index.html` (dashboard), `weight.html` (WeighIn), `spending.html` (Spendly).

**Status:** being converted from three self-contained HTML files to **React + TypeScript + Vite**,
built by GitHub Actions and deployed from `dist/`. Phased; see [migration.md](migration.md) for
what's ported. Pages not yet ported are still the legacy self-contained HTML (Vite passes them
through unchanged).

## Hard rules (details: [rules.md](rules.md))
1. **Never touch the existing Firebase data.** No reads/writes against production for testing.
   Test CRUD only with sample data (`npm run dev` / `?sample=1` / `MemoryBackend` in tests).
2. Ask the owner when a decision is genuinely theirs, always with a recommendation.
3. Keep the URLs `index.html` / `weight.html` / `spending.html` working on GitHub Pages.

## Where things are
- `src/shared/` — types, dates, format, backend (Firebase vs in-memory sample), appearance, shell components
- `src/styles/` — shared CSS (tokens, templates, palettes, base, appearance menu, sidebar shell)
- `src/<page>/` — per-page React code (`dashboard/`, `weight/`, `spending/`)
- `database.rules.json` — must match `src/shared/types.ts`

## Commands
`npm ci` · `npm run dev` (sample data only) · `npm test` · `npm run typecheck` · `npm run build`

## More
- [decisions.md](decisions.md) — why things are the way they are
- [project-facts.md](project-facts.md) — gotchas
- [session-log.md](session-log.md) — history and next steps
