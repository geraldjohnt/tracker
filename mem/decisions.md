# Decision log

Append new entries at the top. Format: date · decision · why · rejected alternatives.

## 2026-10-24 · LevelUp: shared catalog node + XP as a per-day ledger
- **Decision:** The exercise catalog lives at a new root node `exercises/` (read: any signed-in
  account; write: owner email only), published by the owner's own session from the bundled copy.
  Per-user progress lives under `users/<uid>/exerciseTracker/days/<date>`, and total XP is derived
  by folding the days (gains − penalty, floored at 0) instead of storing a counter.
- **Why:** the owner asked for the list "saved to the database, accessible by all users". Writing
  it from the app keeps it in sync with the code without manual console imports. A ledger can't
  lose increments when two devices write at once, and it makes the floor-at-0 rule exact.
- **Not "touching existing data":** `exercises/` and `exerciseTracker/` are new nodes; nothing
  existing is read or written.
- **Rejected:** a manual JSON import in the Firebase console (drifts from the code); catalog only in
  code (owner chose the database); a stored `xp` counter (races, harder floor rule).
- Owner answers to the design questions are in `mem/exercise.md`.

## 2026-10-24 · Accounts: username + password, data per user
- **Decision:** Firebase email/password auth with usernames mapped to
  `<username>@tracker-8dcc0.firebaseapp.com`. Open registration. All data moves under
  `users/<uid>/{weightTracker,spendingTracker}`, and the rules allow only `auth.uid === $uid`.
- **Why:** The owner asked for log in + register + change password, with each user seeing only
  their own data, and usernames (not emails).
- **Legacy data:** copied (not moved) into `geraldjohnt`'s account on its first sign-in. The root
  nodes are never written, which keeps the "never touch existing data" rule. The rules make them
  read-only, readable only by that account, as a backup.
- **The owner's account isn't created from a Claude session:** calling Firebase's sign-up API from
  the container was blocked. The owner registers `geraldjohnt` in the app, right after deploying
  and before publishing the rules, so no one else can take the username first.
- **Rejected:** a `users/<uid>` field tag on each record (needs per-record rules and queries,
  and anyone could still list everything); moving and deleting the legacy nodes (violates the
  data-safety rule, and leaves no backup); Google sign-in (the owner asked for username/password).

## 2026-10-24 · Convert to React + TypeScript, no Python
- **Decision:** Rewrite the three pages as a React 19 + TypeScript app built with Vite 7.
  Python is not used at all.
- **Why:** The owner asked for "Python and React". GitHub Pages only serves static files, so Python
  can't run there. When offered Python as tooling only, PyScript, or a separate backend, the owner
  chose TypeScript instead ("if it can't be built using GitHub Pages, then we'll use JavaScript").
  It can be built: GitHub Actions runs `npm run build` and deploys `dist/`.
- **Rejected:** PyScript/Pyodide (10MB+, slow, poor React fit); a FastAPI backend (needs non-Pages
  hosting); no-build CDN React + htm (no JSX/TS).

## 2026-10-24 · Vite multi-page, same URLs, built by Actions
- **Decision:** One Vite project with three HTML entries at the repo root (`index.html`,
  `weight.html`, `spending.html`) and `base: './'`, so existing links/bookmarks keep working
  under `https://<user>.github.io/<repo>/`.
- **Consequence (accepted):** The built site no longer works from `file://` (ES modules). Use
  `npm run dev` or `npm run preview`. This replaces the old "no build step / open from disk" rule
  in CLAUDE.md.
- Pages source must be **GitHub Actions** (Settings → Pages). The workflow runs typecheck, tests and
  build on every PR, and deploys only from `main`.

## 2026-10-24 · Phased migration
- **Decision:** Phase 1 scaffold + shared modules; Phase 2 dashboard; Phase 3 weight; Phase 4
  spending. Each phase is a separate commit that works on its own; unported pages stay legacy HTML.

## 2026-10-24 · Storage backend abstraction with sample data
- **Decision:** `Backend` interface with `FirebaseBackend` (production) and `MemoryBackend`
  (dev/tests/`?sample=1`). Dev can't reach Firebase at all.
- **Why:** Owner rule: never touch existing Firebase data; test CRUD on sample data.
- Uses the modular Firebase SDK v12 (npm) instead of the v10 compat CDN build. Same database, same
  paths, same data shape.

## 2026-10-24 · Libraries from npm, not CDN
- Bootstrap 5.3, Bootstrap Icons, Chart.js 4 and Firebase are bundled from npm. Only the Inter
  font still loads from Google Fonts. Charts use Chart.js directly through a small `ChartCanvas`
  component (destroy/recreate on change, same as legacy), not react-chartjs-2.
