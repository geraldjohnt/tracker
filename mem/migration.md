# React + TypeScript migration

| Phase | Scope | Status |
|---|---|---|
| 1 | Vite/React/TS scaffold, shared modules (`src/shared`, `src/styles`), backend abstraction + sample data, unit tests, Actions build/deploy, `mem/` | ✅ done |
| 2 | Dashboard (`index.html`) → React | ⏳ |
| 3 | WeighIn (`weight.html`) → React (modals, pending-edit reconciliation, kg/lb, CSV export, All Weeks page) | ⏳ |
| 4 | Spendly (`spending.html`) → React (day/calendar/week/month/year views, charts) | ⏳ |
| 5 | Cleanup: drop legacy inline code, refresh README/CLAUDE.md, final docs | ⏳ |

## Porting checklist (per page)
- [ ] HTML entry keeps the same filename, has only `<head>` meta/font links + `<div id="root">` + module script
- [ ] Visual parity in light + dark, every template/palette (compare with the legacy file via `git show <commit>:<page>.html`)
- [ ] Same localStorage keys and the same Firebase paths
- [ ] Offline/local-only behavior (localStorage cache) preserved
- [ ] Verified in the browser with sample data (`npm run dev`), never against production
- [ ] `npm run typecheck && npm test && npm run build` clean
