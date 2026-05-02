# Sprint 16 Retrospective

**Date:** 2026-06-29
**Sprint Goal:** Rosters turn over and develop realistically between seasons.
**Status:** Complete — all 3 PRD S16 exit tests green.
**Health:** 🟡 Bumpy

---

## SPRINT 16 HEALTH SUMMARY

```
Tasks Completed:        11 / 11  (16.0 hygiene + 10 sprint tasks)
Tasks Partially Done:   none
Tasks Skipped:          git tag (standing directive — 16 sprints now)

Issues Encountered:     7
  - Failed Approaches:  1  (first dev-model cap logic clamped ratings DOWN)
  - Repeated Attempts:  0
  - Diversions:         1  (Monte Carlo test design — position-bias
                            iteration)
  - Unexpected Errors:  3  (Edit tool "file not read" blocking × 2;
                            final-gate lint)
  - PRD Deviations:     3  (pre-approved upfront: monthly→season, cap=15,
                            formula unspecified; plus redshirt auto-lock
                            deferred because PlayerMatchStat writes don't
                            exist yet)
  - Missing Prereqs:    1  (simulateAndPersist never wrote PlayerMatchStat
                            rows — Sprint 6 deferral never landed)
  - Dependency Issues:  0

Overall Sprint Health:  🟡 Bumpy. Not rough but not clean either. Three
clean sprints (10, 12, 15) broken by real tuning work on the development
model. The two-bug nature of exit test 2 (model cap clamping DOWN + test
position-mix bias + sample size) took 4 iterations to resolve.

Top 3 time sinks:
1. Dev-model cap bug (ratings clamped DOWN from archetype-inflated start)
2. Monte Carlo position-mix bias (OH attack at cap vs S attack below cap
   skewed starter/bench comparison)
3. Missing PlayerMatchStat writes (Sprint 6 deferral) forced test to
   synthetically seed minutes + discovered dead simulateAndPersist TODO
```

---

## Issues

### Issue 1: Development model clamped ratings DOWN when current > potential

**Category:** Failed Approach

**Sprint Task:** 16.2 — Development model + 16.9 PRD Monte Carlo

**What happened:**
First draft of `computePlayerGrowth`:

```ts
const cap = Math.min(99, player.potential);
for (const k of keys) {
  const current = player.ratings[k];
  const next = Math.round(current + growth);
  out[k] = Math.max(1, Math.min(cap, next));
}
```

Sprint 12's `applyArchetype` multiplies base rating by position multipliers (OH attack × 1.15, S attack × 0.70). A 65-base OH player ends up with attack ≈ 75 but `potential` is sampled independently (e.g., 70). So **current (75) > cap (70)** at cycle start.

On offseason: `Math.min(cap, 75 + growth)` = `Math.min(70, 75 + something)` → forced DOWN to 70. Player LOSES 5 attack points in one offseason.

Monte Carlo exit test 2 failed:
```
starters n=200 mean=-6.86; bench n=250 mean=-2.84
AssertionError: expected -6.85 to be greater than -2.824
```

Starters got worse FASTER because their higher multiplier produced bigger growth that was MORE aggressively clamped down from the above-cap start.

**Attempts made:**
1. Standard clamp `Math.min(cap, next)`. Failed: ratings drop.
2. Added a skip-if-above-cap branch: `if (current >= cap) { out[k] = current; continue; }`. Passed.

**Resolution:** Skip growth when at-or-above cap. Preserves current value; ratings can only grow upward. Unit tests stayed green (they used potential > initial ratings).

**Diverted from original plan?** No — plan specified "clamp at min(99, potential)" without anticipating current > potential starting state.

**Impact on sprint:**
- Time cost: Medium (~10 min to diagnose + fix).
- Code quality: Final logic is correct and explicit about the edge case.
- Technical debt introduced: No. Arguably improved by surfacing the
  tension between Sprint 12's archetype-inflated ratings and Sprint 16's
  potential-bounded growth.

**Lesson for future sprints:**
**When adding a "clamp at potential" invariant, check whether any
existing code could produce ratings that already violate it.** Sprint 12's
position archetypes can generate per-key ratings above player-level
potential — clamping down would break those players' stats. The fix is
to constrain growth direction, not rating range.

---

### Issue 2: Monte Carlo test had a position-mix bias

**Category:** Diversion

**Sprint Task:** 16.9 — PRD Monte Carlo

**What happened:**
First draft of exit test 2 picked starter/bench by sorting player IDs
alphabetically and splitting in half. Because `applyArchetype` systematically
pushes OH attack up (mult 1.15) and S attack down (mult 0.70),
starter and bench pools ended up with slightly different position
distributions. Since S attack has massive growth headroom and OH attack
has almost none, the pool with more S players grew faster —
regardless of playing time.

Result after the cap fix:
```
starters n=200 mean=0.09; bench n=250 mean=0.49
AssertionError: expected 0.09 to be greater than 0.49
```

Bench outperformed starters because of position mix, not play time.

**Attempts made:**
1. Random id-sort split. Failed (bias).
2. Rewrote to pick starter/bench pairs WITHIN each (team, position) —
   first id → starter, second id → bench. Position-balanced. Result:
   `starters n=100 mean=0.10; bench n=100 mean=0.02; p=0.053` (just
   misses 0.05 threshold).
3. Expanded sample from 50 teams to all 360 teams. Result:
   `starters n=720 mean=0.14; bench n=720 mean=0.06; p=2.6e-7`. Pass.

**Resolution:** Position-balanced sampling + full-league sample.

**Diverted from original plan?** Yes. Plan said "compare mean `attack`
growth for starters vs benchwarmers". Implementation needed extra care
to control for position as a confound.

**Impact on sprint:**
- Time cost: Medium (~15 min across 2 test rewrites).
- Code quality: Better — explicit about the confound in a comment.
- Technical debt introduced: No.

**Lesson for future sprints:**
**When an integration test compares two populations, check for
confounding variables before trusting the result.** The generator applies
systematic transformations (position multipliers) that skew per-attribute
distributions differently across categories. Any A/B comparison should
control for the skew axis explicitly.

---

### Issue 3: `simulateAndPersist` never wrote PlayerMatchStat rows

**Category:** Missing Prerequisite

**Sprint Task:** 16.5 — runOffseason (playing-time lookup)

**What happened:**
The development model reads `sum(PlayerMatchStat.rotationMinutes)` per
player as the playing-time signal. Audit during planning claimed
PlayerMatchStat rows are "persisted since Sprint 12". Reality:
`main/src/match/simulateAndPersist.ts` still has the Sprint 6 comment:

```
// Sprint 6 stores per-player stats in the boxScoreJson column only.
// PlayerMatchStat rows land in Sprint 12 once real Player rows exist
```

Sprint 12 added Player rows but didn't revisit this TODO. Zero
PlayerMatchStat rows exist in any save DB. The development model would
receive `playTime = 0` for every player if the sprint didn't handle it.

**Attempts made:**
1. Option A: implement PlayerMatchStat writes in simulateAndPersist this
   sprint. Rejected: `lineupFromTeam` generates ephemeral synthetic
   players, not real Player row references. Bridging that gap is a
   Sprint 18+ scope change.
2. Option B: synthetically seed PlayerMatchStat rows in the Monte Carlo
   test directly. Shipped.

**Resolution:** Test-level fixture injects rotationMinutes=90 for
"starters" and rotationMinutes=5 for "bench" before calling runOffseason.
The runOffseason service itself reads PlayerMatchStat correctly — it's
just that real-world writes don't exist yet.

**Diverted from original plan?** No. Plan explicitly flagged this as a
Sprint 18+ pickup: "PlayerMatchStat writes deferred to Sprint 18 when
simulator integrates with real Player rows."

**Impact on sprint:**
- Time cost: Low (~5 min to design synthetic seeding).
- Code quality: Test has synthetic setup; production code is fine.
- Technical debt introduced: Yes — Sprint 18's scope grows. The
  redshirt auto-lock also blocks on this (can't detect "first match
  played" without real PlayerMatchStat writes).

**Lesson for future sprints:**
**Audit inventory claims by grepping the assumed code path.** My Phase-1
explorer said PlayerMatchStat was persisted since Sprint 12. The actual
grep would have shown the Sprint 6 TODO comment still in place. A
50-character grep for `PlayerMatchStat.create` would have caught it.

---

### Issue 4: Edit tool blocked twice for "file has not been read"

**Category:** Unexpected Error

**Sprint Task:** 16.9 (dev model fix), 16.9 (test fix), 16.9 (package.json)

**What happened:**
Three times in the session, Edit returned:
```
InputValidationError: File has not been read yet. Read it first before
writing to it.
```

Files hit: `shared/src/offseason/developmentModel.ts` (mid-debug),
`tests/integration/offseason/fullCycle.test.ts` (test refactor),
`package.json` (adding `test:offseason-sim`).

Each time I had to Read the file first, then retry the Edit. First-draft
Edits during a long session lose their "recently read" status when
intervening work touches other files.

**Attempts made:**
1. Edit without prior Read. Blocked.
2. Read → Edit. Worked.

**Resolution:** Pattern established — before editing any cross-cutting
file (package.json, developmentModel.ts once I'd switched to other
files mid-sprint), do a quick Read first.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial (~1 min per instance × 3 = 3 min total).
- Code quality: None.
- Technical debt introduced: No.

**Lesson for future sprints:**
**Sprint 15's "Read-before-Edit is session-level" lesson extends to
debugging cycles.** When mid-sprint you return to a file after work on
other files, the Read-state is often lost. Batch-Read key files at the
start of any debug iteration that touches more than one.

---

### Issue 5: Lint errors at final gate

**Category:** Unexpected Error

**Sprint Task:** 16.10 — Final gate

**What happened:**
Final `npm run check` blocked with:
```
runOffseason.ts(113): 'nationalChampionTeamId' is never reassigned.
   Use 'const' instead
runOffseason.ts(128): Move function declaration to function body root
```

First error: I declared with `let` without needing reassignment.
Second error: `function tournamentFinishFor()` declared inside an
`if`-free block triggered `no-inner-declarations`.

**Attempts made:**
1. Fixed: `let` → `const`; `function tournamentFinishFor()` →
   `const tournamentFinishFor = ...`. Clean.

**Resolution:** 2-line fix.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: Same.
- Technical debt introduced: No.

**Lesson for future sprints:**
**Run `npm run check` mid-task, not only at final gate.** Recurring
lesson across Sprints 3, 5, 8, 9, 16 (5 sprints now). The 10-second
cost per task iteration beats a 3-minute final-gate fix cycle.

---

### Issue 6: Development model first-fix Edit appeared successful but didn't persist

**Category:** Unexpected Error

**Sprint Task:** 16.9 — PRD Monte Carlo (exit test 2)

**What happened:**
After diagnosing the clamp-down bug (Issue 1), I issued an Edit to fix
it. The tool returned "The file ... has been updated successfully." I
rebuilt shared, re-ran the Monte Carlo. Same failure. Same mean numbers
(-6.86 / -2.84). I assumed the fix was cached somewhere and reran. Same
result.

Finally I grep'd the source file — the fix WAS NOT IN THE FILE. The
earlier Edit call had returned success but the actual file on disk was
unchanged. My second Edit (explicit Read first) worked.

**Attempts made:**
1. Edit after previous Edit → "success" message, no file change. Confusing.
2. Read → Edit → verified via grep → fix present → test passed.

**Resolution:** Always grep or re-read to verify critical fixes
landed, especially when the Edit follows an earlier blocked Edit.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Medium (~5-8 min debugging a phantom non-fix).
- Code quality: Final fix is correct.
- Technical debt introduced: No.

**Lesson for future sprints:**
**Verify critical Edits landed by reading the file AFTER the Edit.**
Or use grep for the exact new string. "Edit returned success" is
necessary but not sufficient — I've seen it fail silently once per
multi-edit session.

---

### Issue 7: PRD deviations (3 pre-approved + 1 deferred)

**Category:** PRD Deviation

**Sprint Task:** All — documented upfront

**What happened:**
Four intentional deviations, all approved/documented in the plan:

1. **"Over 5 simulated seasons" → "over 5 simulated offseason cycles".**
   Full-league 5-season sim would take 30-60 min; offseason-only
   completes in ~18s. Confirmed with user via AskUserQuestion.
2. **SCHOLARSHIP_CAP = 15.** PRD doesn't specify a value. Confirmed
   with user.
3. **Development formula multiplicative form.** PRD says "based on
   potential, coach development, playing time" without a formula.
   Multiplicative: `BASE × coach × playTime × classYear × redshirt ×
   headroom + noise`.
4. **Redshirt auto-lock deferred to Sprint 18.** PRD says "auto-lock
   after first match played". Blocked on missing PlayerMatchStat writes
   (Issue 3). Documented in Task 16.6 plan; flagged in code comment.

**Attempts made:** N/A — all documented upfront.

**Resolution:** Shipped with deviations documented in retro + code.

**Diverted from original plan?** No — the plan documented these.

**Impact on sprint:** None beyond the 3-item PRD update queue growing.

**Lesson for future sprints:**
**When a PRD is under-specified, make the choice explicit in the plan
AND in code comments that reference the sprint.** All 4 deviations here
are traceable via grep: "Sprint 16 deviation" surfaces each one.

---

## Notable positives (not issues)

- **All 3 PRD exit tests passed after tuning.** Starter vs bench growth
  delta (0.14 vs 0.06) is directionally correct with p=2.6e-7 —
  extremely strong signal once confounds were controlled.
- **Pre-sprint perf-test serialization paid off.** Default suite
  completed clean at 480/480 (up from 452) in 31s. No flakes. The
  Sprint 15.5 fix eliminated the recurring memoryLeak + weekPerf
  issues.
- **Sprint 15 "clamp sanity check" lesson PARTIALLY applied.** I wrote
  the clamp but didn't pre-check what happens when current > cap at
  start (Issue 1). The lesson needs extending: not just range output
  sanity-check, but also boundary-case input sanity-check.
- **Sprint 13 "prototype threshold" lesson applied.** The unit test
  for developmentModel verified starter-vs-bench direction BEFORE the
  Monte Carlo. However, the Monte Carlo itself found a bias the unit
  test couldn't catch (position mix). Unit test + MC together caught
  the real issues.
- **Test count progression:** S15 452 → S16 **480** default (+28).

---

## Recommendations for Sprint 17

### Carry-forward items
- **PlayerMatchStat writes in `simulateAndPersist`.** Sprint 18 owns
  this. Blocker for both realistic Sprint 16 playing-time data AND
  Sprint 16's deferred redshirt auto-lock.
- **User-team picker UI.** 6 sprints running on the "first team from
  listTeams" shortcut.
- **Git remote push** still outstanding (16 sprints).

### Technical debt to address
- **Sprint 12 position archetypes can push per-key ratings above
  player-level potential.** Sprint 16 works around this in the dev
  model. Sprint 17+ could either:
  - Cap per-key ratings during generation, OR
  - Raise `potential` to `max(potential, max(ratings[k]))` at generation
    time (cleaner).
- **`tournamentFinishFor` uses a heuristic Final Four detection** based
  on `tournamentRound === 'NCAA_FF'`. Works today; tighter contract
  via explicit TournamentResult table is a Sprint 19+ cleanup.

### CLAUDE.md updates to add

Append a `### From Sprint 16` subsection:

```markdown
### From Sprint 16
- **Clamp sanity check extended: boundary inputs, not just outputs.**
  Sprint 15's lesson was "verify clamped range with 3 sample outputs".
  Sprint 16 found a new failure mode: current value can EXCEED the
  cap at start of the clamp, so clamping DOWN destroys data. When
  adding any `Math.min(cap, x)` or `Math.max(floor, x)`, also ask
  "can x already be outside this range at entry?" Two sprints, two
  different clamp bugs — worth the extra 15 seconds of thought.
- **Integration tests for A/B comparisons need to control for
  confounding variables.** Sprint 16's first Monte Carlo split
  starter/bench randomly by id; position distributions skewed the
  comparison because OH attack is near cap (no growth possible) while
  S attack has huge headroom. Explicit within-position balancing
  fixed it. Any A/B population test should ask: "what systematic
  transformation could make my two pools look different for reasons
  other than the variable I'm testing?"
- **Phase 1 inventory claims need verification by grep.** The
  explorer claimed PlayerMatchStat rows were "persisted since
  Sprint 12"; a 30-second grep for `PlayerMatchStat.create` would
  have shown the Sprint 6 TODO still active. Trust but verify.
- **Verify critical Edits landed by reading the file AFTER.** Edit
  tool occasionally returns "success" without changing the file
  (observed once in Sprint 16). `grep` for the new string or Read
  the target range. "Edit returned success" is necessary but not
  sufficient.
- **`npm run check` per task, not at final gate.** 5-sprint
  recurring lesson (3, 5, 8, 9, 16). The mechanism exists; discipline
  still occasionally slips.
```

### PRD corrections
- **§5 Sprint 16 exit test 1** should be reworded from "over 5 simulated
  seasons" to either "over 5 simulated offseason cycles" (what we
  shipped) OR clarify that a full-league 5-season sim is required.
- **§5 Sprint 16 scholarship cap value:** PRD should specify the cap
  number (Sprint 16 chose 15).
- **§5 Sprint 16 development formula:** PRD should either specify the
  growth model or explicitly say "implementor's choice, calibrated to
  exit test 2".
- **§5 Sprint 16 "redshirt auto-lock after first match played"** is
  not achievable until Sprint 18's `simulateAndPersist` writes real
  PlayerMatchStat rows tied to real Player ids. PRD should either
  move the redshirt auto-lock to Sprint 18 or mark it as aspirational.

---

## Notes

Sprint 16 breaks the recent streak of clean-ish sprints (14 clean, 15
clean) but not dramatically. The dev-model cap bug + MC design bias are
both teaching moments rather than planning failures — both were caught
by the test infrastructure, both fixed in ~15 min total.

The most instructive finding: **PlayerMatchStat writes being missing
was a genuine Phase-1 planning miss.** The explorer's claim was wrong;
I trusted it; discovered the gap mid-sprint; worked around it with test
scaffolding. Shows the value of verifying inventory claims when they're
load-bearing for a sprint's design. Adding this to CLAUDE.md so future
sprints can budget a grep check.

Running tally of recurring lessons that persist:
1. **`npm run check` per task** — 5 sprints (3, 5, 8, 9, 16). Not
   internalized.
2. **Clamp sanity checks** — 2 sprints (15, 16) with different-flavored
   clamp bugs. The discipline needs to include boundary inputs too.
3. **Read-before-Edit in long sessions** — 2 sprints (15, 16). Established.
4. **Confound control in A/B population tests** (new Sprint 16).
5. **Phase-1 inventory verification via grep** (new Sprint 16).

Sprint 17 is Coaching Staff. No obvious prerequisites blocking; all
three Sprint 16 deferred items (PlayerMatchStat writes, redshirt
auto-lock, user-team picker) push to Sprint 18 or beyond.
