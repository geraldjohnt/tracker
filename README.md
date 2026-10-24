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

## Accounts

Every page asks you to **sign in** or **register** with a username and password. Anyone can
register, and each account only ever sees its own weeks, expenses and settings. The header's
account button (person icon) has **Change password** and **Sign out**.

Usernames are 3–30 characters (letters, numbers, `.`, `_`, `-`) and aren't case-sensitive.
Behind the scenes a username is a Firebase email/password account with the email
`<username>@tracker-8dcc0.firebaseapp.com`. Nothing is ever emailed, so there's no "forgot
password" email. To reset a forgotten password, delete that user in the Firebase console
(Authentication → Users) and register again with the same username.

**Data from before accounts existed** belongs to `geraldjohnt`. The first time that account signs
in, the app copies it into the account (`users/<uid>/…`). The original root-level nodes are never
changed or deleted. The rules make them read-only and readable by `geraldjohnt` alone, so they stay
as a backup.

In sample mode (`npm run dev`, `?sample=1`), accounts live in your browser's localStorage
(`tracker.sample.auth.v1`). Register `geraldjohnt` with any password to receive the sample data;
any other username starts empty.

## Firebase setup

The project config lives in `src/shared/firebaseBackend.ts`. Do these in order:

1. Firebase console → **Authentication** → Sign-in method → enable **Email/Password**.
2. **Realtime Database**: make sure the `asia-southeast1` instance exists.
3. Deploy the site (merge to `main`).
4. Right away, open the site and **Register** `geraldjohnt`, so nobody else can take that username.
   Until the new rules are published you'll see "Could not move your existing data yet"; that's
   expected.
5. **Realtime Database → Rules** → paste the contents of `database.rules.json` → **Publish**.
   From then on the old, pre-login version of the site can no longer read or write.
6. Reload the site. The existing data moves into the `geraldjohnt` account.

### Data shape

```
users/
  <uid>/
    weightTracker/
      settings/ unit: "kg"|"lb", theme, template, palette
      weeks/
        w_abc123/  { id, startDate: "2026-08-19", endDate: "2026-08-26", createdAt: 1755...,
                     participants/ p_xyz789/ { name, startWeight, endWeight, order } }
    spendingTracker/
      settings/ theme, template, palette
      expenses/
        e_abc123/  { date: "2026-08-19", item: "Coffee", price: 4.5, createdAt: 1755... }
    meta/ legacyImported: <ms>   (set once the pre-login data was copied in)

weightTracker/, spendingTracker/   pre-login data, same shape; read-only backup
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
