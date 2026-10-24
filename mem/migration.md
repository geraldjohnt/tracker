# React + TypeScript migration

| Phase | Scope | Status |
|---|---|---|
| 1 | Vite/React/TS scaffold, shared modules (`src/shared`, `src/styles`), backend abstraction + sample data, unit tests, Actions build/deploy, `mem/` | ✅ done |
| 2 | Dashboard (`index.html`) → React | ✅ done (pixel-identical to legacy except the "Sample data" pill) |
| 3 | WeighIn (`weight.html`) → React (modals, pending-edit reconciliation, kg/lb, CSV export, All Weeks page) | ✅ done: pixel-identical at every step of a scripted flow (light/dark/mobile); CRUD verified on sample data |
| 4 | Spendly (`spending.html`) → React (day/calendar/week/month/year views, charts) | ✅ done: pixel-identical across a 10-step flow (light/dark/mobile); CRUD verified on sample data |
| 5 | Cleanup: drop legacy inline code, refresh README/CLAUDE.md, final docs | ⏳ |

## Porting checklist (per page)
- [ ] HTML entry keeps the same filename, has only `<head>` meta/font links + `<div id="root">` + module script
- [ ] Visual parity in light + dark, every template/palette (compare with the legacy file via `git show <commit>:<page>.html`)
- [ ] Same localStorage keys and the same Firebase paths
- [ ] Offline/local-only behavior (localStorage cache) preserved
- [ ] Verified in the browser with sample data (`npm run dev`), never against production
- [ ] `npm run typecheck && npm test && npm run build` clean

## How parity was verified (reuse for phases 3–4)
1. Extract the legacy page: `git show <pre-port commit>:weight.html > <scratch>/legacy/weight.html` (plus `logo.png`, `favicon.ico`).
2. Replace its two Firebase `<script>` tags with a fake compat SDK. Bundle `src/shared/sampleData.ts` with
   `node_modules/.bin/esbuild --bundle --format=iife --global-name=SD`, then add a tiny `window.firebase = { initializeApp, database(){ return { ref } } }`
   whose `ref(path).on('value', cb)` serves `SD.sampleTree()`. The legacy page then renders **the same sample data** as the React page.
3. Serve legacy with `python3 -m http.server`, and the React build with `npx vite preview` + `?sample=1`.
4. In Playwright, route CDN URLs (jsdelivr bootstrap/icons/chart.js) to `node_modules` files, abort Google Fonts, and
   **abort `firebaseio.com|firebasedatabase.app|gstatic.com/firebasejs`** as a safety net. Screenshot both in light and dark, then pixel-diff.
5. Drive interactions (appearance menu, sidebar, mobile drawer) and check `localStorage` keys.
6. Run the same scripted flow on both pages (type values, switch tabs, toggle the unit, open modals, change pages) and
   pixel-diff each step. Expected difference: the fake legacy SDK doesn't echo writes back, so legacy chrome that only
   re-renders on a snapshot (week select, status chip) stays stale until the next full render. Production Firebase
   does echo writes, so React's live update is the correct reference.
7. Chart.js animates for ~1s: wait ≥1.6s before a screenshot. On mobile, a `fullPage` screenshot resizes the
   viewport and triggers a chart redraw mid-capture. Compare canvas pixels (`getImageData`) instead.
