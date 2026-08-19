# WeighIn — Weekly Weight Tracker

Two single-file, no-build trackers that share one Firebase project. Open either HTML file
directly, or host the folder on GitHub Pages. Data syncs live through Firebase Realtime Database.

## Files

| File | Purpose |
|---|---|
| `weight.html` | Weekly weight-challenge tracker — markup, CSS and JS are all inline. Only Bootstrap 5.3, Bootstrap Icons, Inter and the Firebase SDK come from CDNs. |
| `spending.html` | Daily spending tracker — same single-file approach, plus Chart.js from a CDN for the week/month/year charts. |
| `database.rules.json` | Realtime Database security rules to paste into the Firebase console (covers both `weightTracker` and `spendingTracker` roots). |

## Hosting on GitHub Pages

1. Push this folder to a repo.
2. **Settings → Pages → Source: Deploy from branch**, pick your branch and `/ (root)`.
3. Visit `https://<user>.github.io/<repo>/weight.html` or `.../spending.html`.

Rename either file to `index.html` if you'd rather it be served at the repo root URL (only one can
own that name — pick whichever tracker is primary).

## Firebase setup

The config is already embedded near the top of the `<script>` block in `weight.html`.

1. Firebase console → **Realtime Database** → make sure the instance in
   `asia-southeast1` exists.
2. **Rules** tab → paste the contents of `database.rules.json` → **Publish**.
3. **Authentication is not used**, so the rules above are open read/write. That is fine for a
   private group tracker, but anyone with the URL can edit. To lock it down, enable Anonymous or
   Google sign-in and change `.read`/`.write` to `"auth != null"`.

Each tracker lives under its own root node — `weightTracker` for `weight.html`,
`spendingTracker` for `spending.html` — so they share one Firebase project without colliding.
Change the `ROOT` constant in either file to run a further independent tracker off the same
project.

### Data shape

```
weightTracker/
  settings/unit: "kg" | "lb"
  settings/theme: "dark" | "light"
  weeks/
    w_abc123/
      id, startDate: "2026-08-19", endDate: "2026-08-26", createdAt: 1755...
      participants/
        p_xyz789/  { name, startWeight, endWeight, order }

spendingTracker/
  settings/theme: "dark" | "light"
  expenses/
    e_abc123/  { date: "2026-08-19", item: "Coffee", price: 4.5, createdAt: 1755... }
```

## How it works

- **New week** — start date defaults to the previous week's end date; the end date auto-fills to
  exactly **+7 days** and stays editable. Participants can be carried over from the last week, with
  each person's final weight becoming the new starting weight.
- **Weigh-ins** — edit names and start/final weights inline. Every keystroke updates the local view
  instantly and is written to Firebase after a short debounce.
- **Change column** — <span style="color:#dc2626">gain is red</span>,
  <span style="color:#059669">loss is green</span>, shown in both absolute units and percent.
- **Progress** — "This week" ranks everyone by weight lost; "All time" aggregates every week by name
  (case-insensitive) into weeks joined, first/latest weight, best week, and net change.
- **Export** — the download button writes a CSV of every week and participant.
- **Offline** — the last synced snapshot is cached in `localStorage`, so the app still opens and
  renders without a connection. The status pill in the header shows Synced / Offline / Local only.

### `spending.html`

- **Day** (default view) — add an expense (item + price) for the currently selected day; the list
  and running total update live as you type. Navigate with the prev/next arrows or jump back to
  today.
- **Calendar** — a month grid; each day shows its total if it has any expenses, click a day to jump
  to it in Day view.
- **Week / Month / Year** — each shows a total, an average (per day, or per day and per month for
  Year), a highest-day/days-tracked stat where relevant, and a Chart.js bar chart of the breakdown.
  Averages for the *current* period divide by days/months elapsed so far, not the full period.
  Clicking a day row in Week or a month row in Year jumps to the corresponding Day/Month view.

## Notes

- The `kg` / `lb` toggle in `weight.html` changes the displayed unit label only; it does not
  convert stored numbers.
- Analytics is intentionally left out of both apps — it needs no configuration here and would fail
  when the page is opened straight from disk.
