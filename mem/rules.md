# Owner's standing rules

Hard rules from the project owner. They apply to every session on every machine.

## Data safety
- **Do not touch the existing data in Firebase.** That means no test writes, no "quick check"
  writes, no deletes, and no schema experiments against the production database
  (`tracker-8dcc0`, roots `weightTracker` / `spendingTracker`).
- To test CRUD, use **sample data only**:
  - `npm run dev` always uses the in-memory `MemoryBackend` seeded from `src/shared/sampleData.ts`
    (persisted to the browser's `localStorage` key `tracker.sample.v1`; clear it to reset).
  - A production build opened with `?sample=1` (e.g. `npm run preview` → `/weight.html?sample=1`)
    also uses sample data.
  - Unit tests construct `MemoryBackend` directly.
- If a change to `database.rules.json` is needed, edit the file and tell the owner. Don't publish
  it to the console yourself.

## Working style
- When a decision is the owner's to make, ask, and include a recommendation (mark it "Recommended").
- Keep the portable memory in `mem/` up to date; it's how work continues on other machines.
- Keep the GitHub Pages deployment working at all times; each migration phase must ship on its own.
