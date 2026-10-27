# Project memory — read first

Three trackers + a dashboard sharing one Firebase Realtime Database project, hosted on GitHub Pages:
`index.html` (dashboard), `weight.html` (WeighIn), `spending.html` (Spendly), `exercise.html` (LevelUp).

**In progress:** LevelUp (calisthenics quests), a 9-phase plan; phases 1–6 are done. **Next: phase 7,
LevelUp dashboard card** (wait for the owner to say continue). The phase plan, spec, owner decisions
and known issues are in [exercise.md](exercise.md). Read it before touching `src/exercise/`.

**After phases 7–9:** revisit the calisthenics programme proposal (progression ladders on top of the level system;
recommendations saved in [exercise.md](exercise.md) → "Programme proposal"). Owner deferred it on 2026-10-26.

**Status:** fully migrated (Oct 2026) from three self-contained HTML files to **React 19 +
TypeScript + Vite 7**, built by GitHub Actions and deployed from `dist/`. History and the
parity-testing method are in [migration.md](migration.md). The pre-migration code is at commit
`fe581ba`. Since then every page requires sign-in and data is per account under `users/<uid>/`
(see CLAUDE.md → Accounts).

## Hard rules (details: [rules.md](rules.md))
1. **Never touch the existing Firebase data.** No reads/writes against production for testing.
   Test CRUD only with sample data (`npm run dev` / `?sample=1` / `MemoryBackend` in tests).
2. Ask the owner when a decision is genuinely theirs, always with a recommendation.
3. Phased work: PR + merge to `main` after every phase, then stop until the owner says continue.
4. Keep the URLs `index.html` / `weight.html` / `spending.html` / `exercise.html` working on GitHub Pages.

## Where things are
- `src/shared/` — types, dates, format, backend (Firebase vs in-memory sample), appearance, shell components
- `src/styles/` — shared CSS (tokens, templates, palettes, base, appearance menu, sidebar shell)
- `src/<page>/` — per-page React code (`dashboard/`, `weight/`, `spending/`), each with `store.ts` (trackers), `derive.ts` (pure, tested)
- `database.rules.json` — must match `src/shared/types.ts`; `src/shared/rules.test.ts` enforces it

## Commands
`npm ci` · `npm run dev` (sample data only) · `npm test` · `npm run typecheck` · `npm run build`

## More
- [exercise.md](exercise.md) — LevelUp spec, decisions, roadmap
- [decisions.md](decisions.md) — why things are the way they are
- [project-facts.md](project-facts.md) — gotchas
- [session-log.md](session-log.md) — history and next steps
