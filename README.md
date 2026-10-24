# Tracker: WeighIn + Spendly

Two trackers plus a dashboard that share one Firebase Realtime Database project and update live
across devices. Built with **React + TypeScript + Vite** and deployed to **GitHub Pages** by
GitHub Actions.

| Page | What it is |
|---|---|
| `index.html` | Dashboard: an overview of both trackers |
| `weight.html` | **WeighIn**: a weekly weight-challenge tracker |
| `spending.html` | **Spendly**: a daily spending tracker |

## Develop

Requires Node 20.19+ (CI uses Node 22).

```bash
npm ci
npm run dev        # http://localhost:5173/ — uses built-in SAMPLE DATA, never your real database
npm test           # unit tests
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build; add ?sample=1 to use sample data
```

`npm run dev` and any page opened with `?sample=1` run on an in-memory sample database (saved in
your browser's localStorage), so you can add, edit and delete freely without touching real data.
To reset the sample data, clear the `tracker.sample.v1` key in localStorage.

The built site needs to be served over HTTP. Opening `dist/*.html` straight from disk doesn't work.

## Hosting on GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Push to `main`. `.github/workflows/static.yml` runs typecheck, tests and build, then deploys
   `dist/`. Pull requests run the same checks without deploying.
3. Visit `https://<user>.github.io/<repo>/` (dashboard), `.../weight.html`, or `.../spending.html`.

Asset URLs are relative (`base: './'`), so the site works under any repo name.

## Firebase setup

The project config lives in `src/shared/firebaseBackend.ts`.

1. Firebase console → **Realtime Database**: make sure the `asia-southeast1` instance exists.
2. **Rules** tab → paste the contents of `database.rules.json` → **Publish**.
3. **Authentication is not used**, so the rules are open read/write. That's fine for a private
   group tracker, but anyone with the URL can edit. To lock it down, enable Anonymous or Google
   sign-in and change `.read`/`.write` to `"auth != null"`.

Each tracker lives under its own root node (`weightTracker`, `spendingTracker`), so they share one
project without colliding. Change `ROOT` in `src/weight/store.ts` or `src/spending/store.ts` to run
a further independent tracker off the same project.

### Data shape

```
weightTracker/
  settings/ unit: "kg"|"lb", theme, template, palette
  weeks/
    w_abc123/  { id, startDate: "2026-08-19", endDate: "2026-08-26", createdAt: 1755...,
                 participants/ p_xyz789/ { name, startWeight, endWeight, order } }

spendingTracker/
  settings/ theme, template, palette
  expenses/
    e_abc123/  { date: "2026-08-19", item: "Coffee", price: 4.5, createdAt: 1755... }
```

## How it works

### WeighIn
- **New week**: the start date defaults to the previous week's end date, and the end date
  auto-fills to **+7 days** but stays editable. You can carry participants over from the last
  week, with each person's final weight becoming their new starting weight.
- **Weigh-ins**: edit names and start/final weights inline. The view updates as you type, and
  changes are saved to Firebase after a short pause, or as soon as you leave the field.
- **Change column**: <span style="color:#dc2626">gain is red</span>,
  <span style="color:#059669">loss is green</span>, shown in absolute units and in percent.
- **Progress**: "This week" ranks everyone by weight lost. "All time" combines every week by name
  (case-insensitive) into weeks joined, first/latest weight, best week and net change.
- **All Weeks** page: every week with each participant's start weight, final weight and change.
- **kg / lb**: the toggle converts everything shown, including CSV export. Stored values are
  always kg.
- **Export**: the download button saves a CSV of every week and participant.

### Spendly
- **Day** (default view): add an expense (item + price) for the selected day, and edit or delete
  it inline. Totals update as you type.
- **Calendar**: a month grid showing each day's total. Click a day to open it.
- **Week / Month / Year**: totals, averages, highest day or days tracked, and a bar chart.
  Averages for the *current* period divide by the days or months elapsed so far. Click a day (in
  Week) or a month (in Year) to drill in.
- Prices are shown in pesos (₱).

### Everywhere
- **Offline**: the last synced data is cached in localStorage, so pages open and render without a
  connection. The header pill shows Synced / Offline / Local only (or "Sample data").
- **Appearance**: the palette button switches light/dark mode, a design template and a color
  palette. The trackers sync this across devices; the dashboard keeps its own per-device choice.

## Project memory

`mem/` holds the project's portable working memory: owner rules, decisions, migration history and
gotchas. `CLAUDE.md` loads it automatically for Claude Code; other assistants should start at
`mem/MEMORY.md`.
