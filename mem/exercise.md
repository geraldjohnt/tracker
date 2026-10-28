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
| Each rank has a badge: simple for low ranks, cooler for high ranks; each tier number has a colour (1 pale … 5 bright purple), same for every rank | `RankBadge.tsx` (pure SVG). Rank → ornaments: Rookie disc+chevron, Mover ringed disc, Grinder hexagon+bolt, Athlete shield+star, Warrior +crossed swords, Gladiator +laurels, Spartan +crest+rays, Titan +gem+glow, Olympian +crown+wings, Legend +bigger wings, jewelled crown, animated sparkles. Tier colours: 1 pale stone, 2 green, 3 blue, 4 gold/orange, 5 purple-magenta with gold trim. Tier pips (dots) too, for colour-blind players: one row up to 3, two rows for 4 (2+2) and 5 (3+2) so they stay inside the trim (owner, 2026-10-24) |
| The badge replaces the tier number on the player card emblem | `.emblem-badge` on `.rank-emblem`; the ranking board shows badges as well |
| Each weekday has a target (e.g. Monday legs), with a default the user can change; daily quests follow it | Focuses `legs`/`upper`/`core`/`full`. Default plan Mon legs, Tue upper, Wed core, Thu legs, Fri upper, Sat core, Sun full body. Stored in `settings/targets`; Weekly plan strip + editor on the Quests tab. Daily quests: 3 bodyweight exercises of that focus, no repeats (full body = legs + upper + core) |
| Daily quests: 3 exercises; reps rise with level (squats 10 at L0, 12 at L1) | `base + perLevel × level` per exercise. Slots depend on the day's focus, bodyweight only (`equipment: 'none'`). Daily difficulty unlocks by level: medium at 10, hard at 20, elite at 30 (unchanged by the rank rework) |
| Optional quests with XP; must be accepted first; harder = more XP, harder exercise, more reps | One per difficulty per day. XP easy 8 / medium 15 / hard 30 / elite 50; reps × 1 / 1.25 / 1.5 / 2. Daily XP easy 5 / medium 8 / hard 12 / elite 20. All XP +10% per **rank** (was per 5 levels; changed with the curve so rewards don't outgrow requirements) |
| Missed daily quest → that day's XP deducted; nothing at level 0 / 0 XP; ≥1 of 3 done = no deduction | `settle()`; penalty capped at current XP |
| Each exercise: beginner-friendly how-to, which variation, body form | `variant`, `summary`, `steps`, `form`, `mistakes`, `easier` |
| Recommended gender (reference only, anyone can accept) | `gender: any/female/male`, shown as "Recommended for women · anyone can do it" |
| Body visual with the worked area highlighted | `BodyMap.tsx`: anatomical front/back SVG (redrawn 2026-10-24 at the owner's request: realistic silhouette, individual muscle heads, e.g. 3 quads, 2 hamstrings, gastrocnemius + soleus, 6-pack segments, lats, rear/front delts, plus untracked anatomy like serratus, sartorius, tibialis drawn but never highlighted). Muscle strands follow real fibre paths (owner asked for realistic, curved strands): each part has `f` specs, strands from an origin line to an insertion line, bowed across the belly (spindle muscles), fanned (pecs, delts, lats, glute medius), feathered (rectus femoris), clipped to the outline. Highlighted muscles get light strands, others dark. Primary muscles = accent, secondary = tint |

## Owner decisions (asked 2026-10-24, all recommended options except the last)
- Catalog in Firebase, published by the owner account, bundled fallback.
- Every missed day is deducted (no cap), counted from the first day the account opened Exercise.
- Losing XP can drop levels/ranks, down to Level 0 / 0 XP.
- Optional quests: daily board, one per difficulty; accepted-but-unfinished ones expire at midnight, no penalty.
- Only daily quests protect a day from the penalty (optional ones don't).
- **Level-ups change reps immediately**: unfinished quests always show amounts for the current
  level (only the exercise choice is fixed for the day). Completed quests freeze amount/XP.
- **Camera (owner, 2026-10-26, answered the phase-5 open question):** completing a quest requires the camera
  to check the exercise; the video is never saved. If the user can't use a camera or denies access, they can
  still complete the quest, but for **half the XP, rounded down** (`manualXp`; 5 → 2, 15 → 7).

## Choices made without asking (cheap to change)
- Phase 3: focus names/default plan above; no "rest day" option (a rest day would need a penalty rule: ask
  the owner if wanted). Changing today's target re-picks today's quests only if none is done yet.
- XP curve: the +10%/level curve made high ranks unreachable (Warrior ≈ 3.3M XP). The owner compared three
  options (simulated) and chose C above: "moderate". The owner's first idea (+5 per *rank*) reached Legend in ~3 months.
  Existing XP is kept; levels are recomputed from it (the ledger has no stored level).
- App name "LevelUp"; rank names; XP numbers above; undo is allowed for today's completions only.
- Phase 5 camera details: the "Complete for half XP" link is always shown under the camera view (denying camera
  access is always possible anyway, so hiding it only adds friction). A quest completes itself the moment the
  camera reaches the goal. Exercises without a counter yet use a **watch** timer (person in view for
  amount × 1.5 s, or the hold's seconds) and still get full XP; phase 6 replaces these with real counters.
  Per-side amounts must be done on both sides (6 each side = 12 counted). Pose model: MediaPipe Pose Landmarker
  lite (GPU, falls back to CPU), Wasm bundled from npm, model from storage.googleapis.com (cached by the browser).
  Form checks that fail during a rep make it not count ("Hips sagging … (rep not counted)"); a shallow rep shows
  "Go lower". Holds count only while the position is right, and pause when out of view.
- Undoing a camera-checked quest and redoing it is allowed (same as before); the client is still trusted, so XP
  is not tamper-proof (there's no server).
- Non-participants can still *view* the ranking board; they just aren't on it.
- Board values are self-reported by each client (like XP itself) until there's server-side
  verification; the rules stop impersonation, not inflated numbers.

## Phase plan (agreed with the owner 2026-10-24): 9 phases
Owner rule: PR + merge to `main` after **each** phase (CI green), then **stop** until the owner says continue.

| # | Phase | Status | PR |
|---|---|---|---|
| 1 | Core game: 48-exercise catalog + rules, engine (`derive.ts`), store, Quests / Exercises / History, detail modal + body map | Done | geraldjohnt/tracker#8 |
| 2 | Opt-in ranking board (Ranking tab); daily quests bodyweight-only; L-sit floor version, `CATALOG_VERSION` 2 | Done | geraldjohnt/tracker#9 |
| 3 | Tiers every 5 levels / ranks every 25, SVG rank badges, Ranks tab, badge on player emblem + board, weekly plan driving daily quests | Done | geraldjohnt/tracker#10 |
| 4 | Moderate XP curve (option C): 15 XP/level +5 per tier; quest XP +10% per rank | Done | geraldjohnt/tracker#11 |
| — | Fix: mobile bottom tab bar covered page bottoms (pad `.content-col` by measured `--bottom-nav-h`) | Done | geraldjohnt/tracker#12 |
| — | Realistic anatomical body map; badge pips in two rows for tiers 4–5 | Done | geraldjohnt/tracker#13, #14 |
| 5 | Camera form check, part 1: camera required to complete; half XP without it; counters for squat, lunge, push-up, wall push-up, bridge, plank, wall sit | Done | geraldjohnt/tracker#15 |
| 6 | Camera form check, part 2: counters for all 48 exercises (33 kinds), front-view squats + knee caving, jump checks | Done | geraldjohnt/tracker#19 |
| 7 | Dashboard card for LevelUp | Done | geraldjohnt/tracker#20 |
| 8 | Better visuals: animated movement demo for every exercise | Done | (this PR) |
| 9 | **Extras (owner picks)** (next) | Not started | |
| — | **Then:** calisthenics programme (ladders), see "Programme proposal" below; owner deferred it until 6–9 are done | Deferred | |

The owner may move 7–9 before the camera phases.

### Phase 5: camera form check, part 1
- Pose detection in the browser (MediaPipe Pose Landmarker or TF.js MoveNet; no server, works on GitHub Pages;
  no video leaves the device). Camera view in a quest "Start with camera" modal.
- Rep counting + basic form checks for the most common daily exercises: **squats, lunges, push-ups, glute
  bridges, planks/holds** (holds count seconds while the pose is held).
- Rep counters from joint angles (knee angle for squats/lunges, elbow for push-ups, hip for bridges, body line
  for planks), with hysteresis thresholds. A quest completes when the camera has counted every rep.
- Add a per-exercise `tracker` definition (joints, angle thresholds, form rules) to the catalog →
  bump `CATALOG_VERSION`, extend `database.rules.json` (`exercises/items/$id`), update tests.
- Load the pose model lazily (only when the camera opens) so the page stays light.
- **Done (2026-10-26).** Owner answered the open question differently: no setting; manual completion is always
  possible but worth half XP (rounded down). Implemented in `pose.ts` (counters, unit-tested on synthetic poses),
  `poseModel.ts`, `CameraModal.tsx`; catalog `tracker` field, `CATALOG_VERSION` 3; rules: `exercises/items/$id/tracker`
  and `manual` on quest slots (**owner must re-publish the rules**, then open the page as geraldjohnt to publish v3).
- Checked in Chromium with a fake camera fed a real photo (MediaPipe's `pose.jpg`, a lunge): detection, skeleton
  overlay, idle guard, watch-mode auto-complete, denied → half XP. Real rep counting on video was not possible here
  (no exercise video reachable); worth a quick real-phone check by the owner.

### Phase 6: camera form check, part 2
- Trackers for the rest of the catalog (everything still on the watch timer: calf raises, jumping jacks, superman,
  crunches, dead bug, bird dog, mountain climbers, dips, rows, pull-ups, pike/archer push-ups, hollow hold, L-sit,
  leg raises, burpees, jumps, V-ups, Nordic curls, dragon flag, side lunge tuning); more form feedback (e.g. knees
  caving needs a front view); tune thresholds from the owner's real-phone feedback.
- **Done (2026-10-27).** Every catalog exercise now has a `tracker` (33 kinds, `CATALOG_VERSION` 4); watch mode only
  remains as a fallback for kinds a page doesn't know. New counter features in `pose.ts`:
  - `need`: a condition that must hold at depth (past the work threshold, not on the way back), e.g. chin over the
    bar (pull-ups), other leg/arm straight (side lunge, archer), feet wide when facing the camera (jumping jacks),
    straight plank (burpees), opposite arm reaching (bird dog), shoulders lifted (bicycle crunch).
  - `jump`: ankles must rise 10% of leg length above a learned floor line, during the rep or up to 0.8 s after standing
    (jump squats, tuck jumps, burpees). The floor is re-learned if the ankles stay "up" while standing for 1.5 s (camera moved).
  - `sides: 'each'`: a state machine per leg for fast alternating moves (mountain climbers, bicycle crunch, dead bug,
    bird dog); 'either' (lunges, side lunge, archer) is the phase-5 "whichever side bends most".
  - Squats facing the camera: depth from the thigh's height vs the shin (`squatKnee`), and "knees caving in"
    (knees < 70% of the feet's width on the way down) voids the rep. Side-on is unchanged.
  - Holds: hollow hold, L-sit. Pull-up/chin-up share `pullup`; bench dip/parallel dip share `dip`; lying and hanging
    leg raises share `legraise`; jump squat moved from `squat` to `jumpsquat`.
  - Setup tip per kind in `CameraModal.tsx`; foot landmarks (heel, toes) drawn on the skeleton (calf raises use them).
- All thresholds are from geometry on synthetic poses (unit-tested), not real video; **expect tuning after the owner
  tries them on a phone.** Least certain: superman (small lift), calf raise (heel landmarks), L-sit (legs off the
  floor), hollow hold (small lifts), jumping jacks from the side (arms only).

### Phase 7: dashboard card
- LevelUp card on `index.html`: level, rank badge, XP progress, today's daily quests done / 3, streak.
- **Done (2026-10-28).** `ExerciseCard.tsx` spans both grid columns (one column below 900px): badge + level + XP bar,
  stats (Today x/3, Streak, Total XP, This week), today's daily quests (name, amount, XP; done ticked, "no camera" for
  manual), a Safe / "N XP at risk" chip, and the hero line adds "x/3 quests done". Pure `exerciseSummary()` in
  `derive.ts` (tested). Choices made without asking: the dashboard stays read-only, so it doesn't create today's quests
  ("appear once you open LevelUp") and doesn't apply missed-day penalties; it shows a red "N missed days: −X XP when
  you next open LevelUp" preview instead, and the XP shown is before that deduction. It uses the bundled catalog for
  names. No rules change.

### Phase 8: better visuals
- An illustration or short animation of the movement per exercise, next to the body map (the body map only
  shows muscles).

- **Done (2026-10-28).** `motion.ts` + `MovementFigure.tsx`: a looping stick-figure demo for all 48 exercises, above the
  body map in the detail modal (play/pause button) and small next to the setup tip in the camera modal. Choices made
  without asking: stick figure in the accent colour (near limbs solid, far ones faded), side view except jumping jacks,
  side lunge, reverse snow angel (from above) and wide/archer push-ups (from the front); props drawn for walls, benches,
  bars and the Nordic anchor; paused by default under "reduce motion"; demos are bundled per exercise id (not stored in
  the catalog), so no rules change. Library cards still show the mini body map. Checked every keyframe on a contact
  sheet and the page in Chromium (desktop light, phone dark, fake camera).

### Phase 9: extras (offer the list; owner picks)
- Achievements, streak bonuses, rest days in the weekly plan (needs a penalty rule), rank-up celebration
  screen, weekly challenge quest.

### Programme proposal (2026-10-26) — DEFERRED until phases 6–9 are done (6 done)
**Owner (2026-10-26):** save this now; come back to it only after the whole first plan (phases 6–9) is finished.
At that point, re-present these options and the open questions to the owner before building anything.

Why: today reps rise with the player **level**, which mixes XP (effort/consistency) with strength. A real programme
lets strength drive the exercises and keeps XP as the reward layer.

**Recommended: progression ladders + XP on top**
- **Ladders** per movement pattern: push, pull, squat, hinge/bridge, core. Each is an ordered list of catalog exercises,
  easiest → hardest. E.g. push: wall → incline → knee → full → diamond → archer → (one-arm); squat: squat → split squat
  → Bulgarian split squat → shrimp → pistol; pull (home kit only): table/towel row → negatives → pull-up → archer.
  Each player has a current step per ladder (e.g. `programme/ladders/<pattern>` = step index; needs rules + types).
- **Sets × rep range, double progression** (e.g. 3 × 8–12; holds 3 × 20–45 s): add reps each session; hitting the top
  of the range on every set (camera-checked) **graduates** to the next step, back to the bottom of the range.
  Manual (no-camera) sets count for XP (half, as now) but should not graduate a step. Reps follow the ladder, not the level.
- **Placement test** on first use: max reps per ladder, counted by the camera, picks the starting steps (re-test any time).
- **Weekly template**: 3 full-body strength days (e.g. Mon/Wed/Fri) + 2 light days (mobility/core/skill) + 2 rest days.
  Recommended penalty rule: **scheduled rest days never get a penalty** and don't break the streak; at most 3 rest days
  a week; strength/light days keep today's rule (≥1 daily quest done or lose that day's XP). Deload week every ~6 weeks
  (lower volume, same XP).
- **XP stays**: XP per completed set/session (camera vs manual unchanged), a big bonus per graduation, small bonus for a
  personal record. Optional quests stay as side quests; the curve, tiers, ranks and badges are unchanged.
- **Rank trials** (optional): reaching a new rank needs the XP **and** a skill milestone (e.g. Athlete: 10 full
  push-ups on camera). Recommended as a later add-on, opt-in at first.

**Lighter alternatives (not recommended)**
- *Sets only*: keep quests, show them as sets. Quick, but not a programme.
- *Fixed plans*: pick a ready-made plan (Beginner / Intermediate, N weeks). Simple, doesn't adapt.

**Suggested phases (after phase 9):** P-A ladders + placement test · P-B session view (sets, rest timer, double
progression, graduations) · P-C weekly template + rest days + deload · P-D rank trials. Same rule: PR + merge per phase.

**Open questions for the owner then:** ladders vs alternatives; rest-day penalty rule above; whether existing daily
quests are replaced by programme sessions or kept alongside them; rank trials yes/no.

### Known issues to fix (small, any time)
- Ranks tab on mobile with large phone text: the 5-badge tier row can overflow the right edge
  (e.g. "Olympian 5" clipped). Likely fix: `min-width:0` on `.tier`, smaller badges / wrapping labels below 400px.

## Status
- **Part 1 (done, 2026-10-24):** catalog + rules, game engine (`derive.ts`, unit-tested), store,
  page with Quests / Exercises (library with filters) / History, exercise detail modal with body
  map, nav links on every page.
- **Phase 3 (done, 2026-10-24):** ranks stretched to 25 levels (tiers every 5), rank badges, Ranks tab,
  weekly targets driving daily quests. Rules: `settings/targets`, `days/<date>/focus` (**owner must re-publish**).
- **Phase 2 (done, 2026-10-24):** opt-in ranking board (Ranking tab); daily quests are bodyweight-only;
  L-sit moved to the floor version (no equipment); `CATALOG_VERSION` 2.
- **Phase 5 (done, 2026-10-26):** camera form check; half XP without the camera. Rules: `tracker`, `manual`.
- **Phase 6 (done, 2026-10-27):** counters for every exercise; rules: `tracker` regex extended (33 kinds).
- **Phase 7 (done, 2026-10-28):** LevelUp card on the dashboard. No rules change.
- **Phase 8 (done, 2026-10-28):** animated movement demos. No rules change.
- **Owner to do:** re-publish `database.rules.json` (latest: the longer `tracker` list on catalog items),
  then open `exercise.html` signed in as `geraldjohnt` once, which publishes the catalog (version 4). Until then
  everyone uses the bundled catalog (v4 > stored v3), so nothing breaks.

## Roadmap
See "Phase plan" above (phases 5–9). Notes for the camera phases: per-exercise rep counters from joint angles,
form rules derived from the catalog's `form` cues.
