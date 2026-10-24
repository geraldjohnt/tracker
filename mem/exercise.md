# Exercise / LevelUp: spec, status and roadmap

`exercise.html` (**LevelUp**, sidebar/bottom-nav label "Exercise") is a game-like calisthenics
tracker. Code: `src/exercise/`. Architecture notes are in CLAUDE.md → "Exercise / LevelUp".

## Owner's spec (2026-10-24), and how it's implemented
| Spec | Implementation |
|---|---|
| Only calisthenics that can be done at home (no running/jogging); equipment exercises are optional-quest only | Catalog is all home exercises (equipment at most a doorway bar, chairs, a wall, a sofa to hook feet). Daily quests use `equipment: 'none'` only |
| Ranking board for all users, opt-in only, ranked by level | `leaderboard/<uid>` (shared; own entry writable only; username must match the account). Join/leave behind a confirm dialog; entry kept in sync while joined. Ties: more XP, then earlier join |
| List of calisthenics exercises, saved to the database, readable by all users | `catalog.ts` (48 exercises: 15 easy, 15 medium, 10 hard, 8 elite). Published to `exercises/` by the owner's session; read by every signed-in account; bundled fallback |
| ~~20 XP to level 1, +10% per level~~ **Changed 2026-10-24 (owner chose option C):** 15 XP per level in Rookie 1, +5 per tier (every 5 levels) | `xpToNext = 15 + 5 × tierStep`: Rookie 15–35, Mover 40–60, Grinder 65–85 … Legend 240–260 per level. Rank starts: Mover 625 XP, Grinder 1,875, Athlete 3,750, Warrior 6,250, Gladiator 9,375, Spartan 13,125, Titan 17,500, Olympian 22,500, Legend 28,125. Simulated: Legend after ~18.5 months of dailies only, ~11 months with easy+medium optional daily (no missed days) |
| ~~Every 5 levels is a rank~~ **Changed 2026-10-24:** every 5 levels is the next *tier* (Level 5 Rookie 2, 10 Rookie 3, 15 Rookie 4, 20 Rookie 5, 25 Mover 1) | `RANKS`: Rookie, Mover, Grinder, Athlete, Warrior, Gladiator, Spartan, Titan, Olympian, Legend; 25 levels each. Past Legend 5 it keeps counting (Legend 6…) |
| Players can see all ranks, to motivate them | **Ranks** tab (`RanksView.tsx`): every rank and tier with its badge, unlock level and total XP; the player card's badge links there |
| Each rank has a badge: simple for low ranks, cooler for high ranks; each tier number has a colour (1 pale … 5 bright purple), same for every rank | `RankBadge.tsx` (pure SVG). Rank → ornaments: Rookie disc+chevron, Mover ringed disc, Grinder hexagon+bolt, Athlete shield+star, Warrior +crossed swords, Gladiator +laurels, Spartan +crest+rays, Titan +gem+glow, Olympian +crown+wings, Legend +bigger wings, jewelled crown, animated sparkles. Tier colours: 1 pale stone, 2 green, 3 blue, 4 gold/orange, 5 purple-magenta with gold trim. Tier pips (dots) too, for colour-blind players |
| The badge replaces the tier number on the player card emblem | `.emblem-badge` on `.rank-emblem`; the ranking board shows badges as well |
| Each weekday has a target (e.g. Monday legs), with a default the user can change; daily quests follow it | Focuses `legs`/`upper`/`core`/`full`. Default plan Mon legs, Tue upper, Wed core, Thu legs, Fri upper, Sat core, Sun full body. Stored in `settings/targets`; Weekly plan strip + editor on the Quests tab. Daily quests: 3 bodyweight exercises of that focus, no repeats (full body = legs + upper + core) |
| Daily quests: 3 exercises; reps rise with level (squats 10 at L0, 12 at L1) | `base + perLevel × level` per exercise. Slots depend on the day's focus, bodyweight only (`equipment: 'none'`). Daily difficulty unlocks by level: medium at 10, hard at 20, elite at 30 (unchanged by the rank rework) |
| Optional quests with XP; must be accepted first; harder = more XP, harder exercise, more reps | One per difficulty per day. XP easy 8 / medium 15 / hard 30 / elite 50; reps × 1 / 1.25 / 1.5 / 2. Daily XP easy 5 / medium 8 / hard 12 / elite 20. All XP +10% per **rank** (was per 5 levels; changed with the curve so rewards don't outgrow requirements) |
| Missed daily quest → that day's XP deducted; nothing at level 0 / 0 XP; ≥1 of 3 done = no deduction | `settle()`; penalty capped at current XP |
| Each exercise: beginner-friendly how-to, which variation, body form | `variant`, `summary`, `steps`, `form`, `mistakes`, `easier` |
| Recommended gender (reference only, anyone can accept) | `gender: any/female/male`, shown as "Recommended for women · anyone can do it" |
| Body visual with the worked area highlighted | `BodyMap.tsx`: stylized front/back SVG; primary muscles = accent, secondary = tint |

## Owner decisions (asked 2026-10-24, all recommended options except the last)
- Catalog in Firebase, published by the owner account, bundled fallback.
- Every missed day is deducted (no cap), counted from the first day the account opened Exercise.
- Losing XP can drop levels/ranks, down to Level 0 / 0 XP.
- Optional quests: daily board, one per difficulty; accepted-but-unfinished ones expire at midnight, no penalty.
- Only daily quests protect a day from the penalty (optional ones don't).
- **Level-ups change reps immediately**: unfinished quests always show amounts for the current
  level (only the exercise choice is fixed for the day). Completed quests freeze amount/XP.

## Choices made without asking (cheap to change)
- Phase 3: focus names/default plan above; no "rest day" option (a rest day would need a penalty rule: ask
  the owner if wanted). Changing today's target re-picks today's quests only if none is done yet.
- XP curve: the +10%/level curve made high ranks unreachable (Warrior ≈ 3.3M XP). The owner compared three
  options (simulated) and chose C above: "moderate". The owner's first idea (+5 per *rank*) reached Legend in ~3 months.
  Existing XP is kept; levels are recomputed from it (the ledger has no stored level).
- App name "LevelUp"; rank names; XP numbers above; undo is allowed for today's completions only
  (honour system until the camera exists).
- Non-participants can still *view* the ranking board; they just aren't on it.
- Board values are self-reported by each client (like XP itself) until there's server-side
  verification; the rules stop impersonation, not inflated numbers.

## Status
- **Part 1 (done, 2026-10-24):** catalog + rules, game engine (`derive.ts`, unit-tested), store,
  page with Quests / Exercises (library with filters) / History, exercise detail modal with body
  map, nav links on every page.
- **Phase 3 (done, 2026-10-24):** ranks stretched to 25 levels (tiers every 5), rank badges, Ranks tab,
  weekly targets driving daily quests. Rules: `settings/targets`, `days/<date>/focus` (**owner must re-publish**).
- **Phase 2 (done, 2026-10-24):** opt-in ranking board (Ranking tab); daily quests are bodyweight-only;
  L-sit moved to the floor version (no equipment); `CATALOG_VERSION` 2.
- **Owner to do:** re-publish `database.rules.json` (new `exercises/`, `leaderboard/` and `users/$uid/exerciseTracker`),
  then open `exercise.html` signed in as `geraldjohnt` once, which publishes the catalog.

## Roadmap (next phases; PR + merge after each, then wait for the owner)
1. **Camera form check (owner's planned upgrade):** a quest only completes when the camera sees the
   required reps with correct form. Likely approach: MediaPipe Pose / TensorFlow.js MoveNet in the
   browser (no server; works on Pages), per-exercise rep counters from joint angles (e.g. knee angle
   for squats, elbow angle for push-ups), form rules from the catalog's `form` cues. Needs a
   per-exercise "tracker" definition (joints, angle thresholds) added to the catalog, so bump
   `CATALOG_VERSION` and extend the rules. Keep the manual button as a fallback setting? Ask the owner.
2. Dashboard card for LevelUp (level, rank, today's daily progress).
3. Better visuals: per-exercise illustrations or animations of the movement (the body map only
   shows muscles).
4. "And more" ideas to offer the owner: weekly challenge quest, achievements/badges, streak
   bonuses, rest days, a rank-up celebration screen.
