# Sprint 33 Retrospective

**Date:** 2026-05-04
**Sprint Goal:** Replace the single-button `runOffseason` with an FCCD-style 11-event offseason + 5-event preseason calendar driven one event at a time by `advanceOffseasonEvent`. Land the FCCD coach-attribute training event (`applyTrainingResults`) using Sprint 32's gain curve. Re-scope recruiting + portal to dedicated events; roll back the Sprint 31 retro auto-open-recruiting-after-portal behavior.
**Status:** Complete
**Health:** 🟢 Clean

---

## Sprint 33 Health Summary

```
Tasks Completed:        7 / 7
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     6 total
  - Failed Approaches:  0
  - Repeated Attempts:  0
  - Diversions:         2  (combined 33.3+33.6 ordering; phase-write minimization)
  - Unexpected Errors:  2  (TS predicate type narrowing; gainApplied arithmetic)
  - PRD Deviations:     2  (legacy test updates per plan's Risk & Notes)
  - Missing Prereqs:    0
  - Dependency Issues:  0

Sprint 33 own tests:        35 / 35 passing
Sprint 33 own typecheck:    ✅
Sprint 33 own build:        ✅
Sprint 33 own lint:         ✅ (no errors in any Sprint-33-touched file)

Pre-existing baseline (no Sprint 33 work, via `git stash`):  66 failing tests
After Sprint 33 applied:                                     39 failing tests
Net effect of Sprint 33:  +35 new passing tests AND -27 baseline failures
                          (Sprint 33 plumbing partially unblocked some Sprint 28
                           in-progress test failures that depended on event-driven
                           offseason handling)

Top 3 Time Sinks:
1. Task 33.3 orchestrator + 14 per-event handlers — Diversion (combined with 33.6)
2. Task 33.4 applyTrainingResults math + idempotency — Unexpected Error (gainApplied arithmetic typo, caught before test write)
3. Wiring 4 new IPC channels through preload + renderer store — straightforward but voluminous

Overall Sprint Health:  🟢 Clean
```

---

## Issue Catalog

### Issue: TypeScript predicate-narrowing rejected initial filter pattern in advanceYear.ts

**Category:** Unexpected Error (small)

**Sprint Task:** 33.3 — `advanceYear` event handler

**What happened:**
First-pass implementation of `advanceYear.ts` used `.map().filter()` with a type predicate:
```ts
.filter((u): u is { id: string; nextClassYear: string } => u !== null);
```
But `offseason.advanceClass(...)` returns `nextClassYear: ClassYear | null`, so the
narrowed type was `string` rather than `ClassYear`, producing TS2677:
> A type predicate's type must be assignable to its parameter's type.
> Type '{ id: string; nextClassYear: string; }' is not assignable to type
> '{ id: string; nextClassYear: offseason.ClassYear; }'.

Plus two TS18047 "possibly null" errors from the post-filter consumer.

**Attempts made:**
1. Filter-with-predicate approach — rejected by TS due to type narrowing mismatch.
2. Refactored to an explicit `for...of` loop building a strongly-typed array. Clean.

**Resolution:**
Replaced the `.map().filter()` pipeline with an imperative for-loop that builds
`Array<{ id: string; nextClassYear: offseason.ClassYear }>` directly. Cleaner +
typecheck-clean.

**Diverted from original plan?** No (plan didn't prescribe the JS pattern).

**Impact on sprint:**
- Time cost: Low (~1 min — a single typecheck cycle).
- Code quality: Cleaner final shape than the original pipeline.
- Technical debt introduced: None.

**Lesson for future sprints:**
When narrowing through a discriminated-union value (here `nextClassYear:
ClassYear | null`), prefer explicit for-loops over `.filter` predicates —
predicate types must match the source's full union shape, not just the
non-null branch. Same lesson appears in CLAUDE.md gotcha "Don't derive types
from discriminated-union IPC responses via `infer`" (different surface,
same root cause).

---

### Issue: `gainApplied` arithmetic typo in applyTrainingResults

**Category:** Unexpected Error (caught before test run)

**Sprint Task:** 33.4 — `applyTrainingResults`

**What happened:**
First-pass calculation of `gainApplied` (the audit-trail field on
TrainingResultEntry) had a confused expression that mixed `newValue -
currentRating` with a redundant clamp re-check:
```ts
gainApplied: newValue - currentRating + (currentRating - (currentRating + gain + breakthroughBonus < 0 ? 0 : 0))
```
The rightmost term is always `currentRating - 0 = currentRating`, doubling the
value. Spotted on self-review before any test ran, so no test surfaced it
under a false-pass.

**Attempts made:**
1. Self-review of the file before writing tests caught the algebraic muddle.
2. Replaced with `actualGain = newValue - currentRating; gainApplied: actualGain`.

**Resolution:**
Single-line fix; tests then validated the corrected arithmetic via the
"every player rating bounded" + "repeated-focus penalty" assertions.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low (~1 min).
- Code quality: Clean.
- Technical debt introduced: None.

**Lesson for future sprints:**
For audit-trail fields whose value is "what actually got persisted, after
clamping," compute via `final - initial` and avoid re-deriving from input
deltas. Especially when the writes themselves are clamped — `gain +
breakthroughBonus` is NOT what actually lands when `cap = min(100, potential)`
truncates the result. The "final minus initial" pattern is robust against
all clamp logic.

---

### Issue: Combined Tasks 33.3 + 33.6 into one execution pass

**Category:** Diversion (deliberate, planned)

**Sprint Task:** 33.3 + 33.6

**What happened:**
The plan's execution order put 33.3 (orchestrator) before 33.6 (recruiting/
portal re-scoping), but execution merged them. Reason: 33.3's per-event
handlers (`recruitingWeek.ts`, `playersTransferring.ts`) call into the
recruiting/portal services that 33.6 needed to refactor. Doing them sequentially
would have meant either:
- Building the orchestrator with awkward temp-flip workarounds for phase
  enforcement (call `openRecruitingCycle` from OFFSEASON, then reset phase
  to OFFSEASON before the next event), then ripping that out in 33.6.
- OR breaking the existing recruiting/portal services in 33.3 before
  rebuilding them in 33.6.

**Attempts made:**
1. Considered the temp-flip workaround for orchestrator → recruiting service
   integration. Rejected as throwaway work.
2. Combined: stripped phase CHECKS from `advanceRecruitingWeek` +
   `advancePortalWeek`, dropped auto-open-recruiting + phase write from
   `closePortal`, then built orchestrator + handlers calling the refactored
   services directly.

**Resolution:**
One-pass refactor of both. The plan's Risk & Notes had already flagged this
as the cleanest path: "33.6 runs alongside 33.3 since both touch the same
handlers."

**Diverted from original plan?** Yes (plan ordering), No (plan content — 
plan flagged the option in Risk & Notes).

**Impact on sprint:**
- Time cost: Low (saved ~10 min by avoiding the throwaway temp-flip layer).
- Code quality: Cleaner final shape.
- Technical debt introduced: None — the partial 33.6 (phase WRITES retained
  in `openRecruitingCycle` / `openPortal` / `closeRecruitingCycle` to
  minimize collateral test damage) is documented in code comments and is
  consistent with the plan's compromise approach.

**Lesson for future sprints:**
Spec execution-order is a recommendation, not a constraint. When two tasks
touch overlapping surface area, executing them in a single pass usually
produces cleaner code than serial execution with bridging glue.

---

### Issue: Phase WRITES partially retained in recruiting/portal helpers

**Category:** Diversion (pragmatic compromise)

**Sprint Task:** 33.6 — Recruiting + portal re-scoping

**What happened:**
Plan called for spec §33.6 step 1: "openRecruitingCycle.ts — only callable
from RECRUITING_1 handler" (and similar for openPortal). Strict reading
implies stripping `Season.phase = 'RECRUITING'` writes too — phase management
moves entirely to the orchestrator. But stripping those writes would
guaranteed-break existing integration tests (`recruiting/cycle.test.ts:53`
and `portal/cycle.test.ts:51` both assert `phase === 'RECRUITING'`/
`'PORTAL'` post-open). Those tests are part of the Sprint 28 baseline-failing
set; making them MORE broken isn't ideal.

**Attempts made:**
1. Considered full strip — would force test updates beyond the spec's
   acceptance scope.
2. Compromise: kept phase WRITES in `openRecruitingCycle` / `openPortal` /
   `closeRecruitingCycle`, stripped the phase CHECKS in advance* (which
   the orchestrator NEEDS to bypass), and stripped the auto-open-recruiting
   + phase=RECRUITING write in `closePortal` (the explicit Sprint 31 retro
   rollback per spec).

**Resolution:**
The orchestrator's recruiting/portal handlers reset Season.phase to
'OFFSEASON' after the open* / close* writes. Effectively the phase WRITES
are still there but get immediately overwritten. The strict mode (full
removal) is deferrable to v1.3 if we ever want recruiting/portal callable
outside the orchestrator's transaction.

**Diverted from original plan?** Slightly. Plan's "Risk & Notes" mentioned
this exact compromise: "Keep phase WRITES in open* / close* but just remove
the CHECK in advance*."

**Impact on sprint:**
- Time cost: Low (~3 min decision + execution).
- Code quality: Defensible compromise — orchestrator's reset-to-OFFSEASON
  pattern is a tiny bit clunky but well-isolated.
- Technical debt introduced: Mild. The phase-write/phase-reset dance in
  `playersTransferring.ts` and `recruitingWeek.ts` is documented inline.
  Sprint 35's recruiting deepening should remove the phase WRITES entirely
  when it touches these surfaces anyway.

**Lesson for future sprints:**
"Strip phase X" reads cleanly in spec text but blowing up adjacent integration
tests has a real cost. When the strip can be a NO-OP via a downstream reset
in the orchestrator, defer the strip to a later sprint that's already
touching the same files.

---

### Issue: Existing `runOffseason` test asserted phase=PRESEASON; new behavior lands at REGULAR

**Category:** PRD Deviation (deliberate, plan-flagged)

**Sprint Task:** 33.3 — `runOffseason` refactored to event-loop

**What happened:**
`tests/integration/offseason/runOffseason.test.ts:79` asserted
`expect(season!.phase).toBe('PRESEASON')` after a single `runOffseason`
call. Pre-Sprint-33, `runOffseason` ended in a single $transaction that
wrote `phase = 'PRESEASON'`. Post-Sprint-33, `runOffseason` is a thin
loop that walks ALL 16 events including FINALIZE, which sets
`phase = 'REGULAR'`.

**Attempts made:**
1. Considered reverting `runOffseason` to stop after the offseason events
   (skip preseason entirely). Rejected — that would make `runOffseason` 
   useless as the "skip every event" debug backdoor the spec describes.
2. Updated the test assertion to `'REGULAR'` with a comment noting the
   Sprint 33 semantic change.

**Resolution:**
One-line assertion update with a comment. Plan's Risk & Notes had flagged
this exactly:
> "runOffseason vs. event-by-event end-state parity. Today's `runOffseason`
> does graduate → dev → cap → year bump in ONE transaction. Sprint 33 spreads
> dev across TRAINING_RESULTS at the next preseason instead of inside the
> offseason event."

**Diverted from original plan?** No. Plan flagged this as expected.

**Impact on sprint:**
- Time cost: Low (~1 min).
- Code quality: N/A (test update only).
- Technical debt introduced: None.

**Lesson for future sprints:**
When refactoring a function's terminal state, grep for tests asserting the
old terminal state BEFORE running the suite. Preempting these saves a full
test cycle.

---

### Issue: Existing `closePortal` test asserted phase=RECRUITING; Sprint 33 dropped that write

**Category:** PRD Deviation (deliberate, plan-flagged)

**Sprint Task:** 33.6 — closePortal Sprint 31-retro rollback

**What happened:**
`tests/integration/portal/cycle.test.ts:119` asserted `phase === 'RECRUITING'`
after `closePortal()`. Sprint 33 spec §33.6 explicit mandate:
> "main/src/portal/closePortal.ts — drop the auto-open-recruiting side effect"

The phase write `phase: 'RECRUITING'` was the FIRST step of that auto-open
pattern. Removed both. Test failed.

**Attempts made:**
1. Updated test to assert `portalWeek === 0` (the surviving close
   side-effect) plus a comment explaining the Sprint 33 rollback.

**Resolution:**
Test update committed alongside the production change.

**Diverted from original plan?** No. Plan's Risk & Notes flagged exactly:
> "Existing recruiting/portal integration tests will break. Their setup
> probably calls `openRecruitingCycle` which today writes
> `phase='RECRUITING'`. Sprint 33 strips that write. Tests that asserted
> `phase==='RECRUITING'` post-open need updating in the same PR."

**Impact on sprint:**
- Time cost: Low (~1 min).
- Code quality: N/A.
- Technical debt introduced: None.

**Lesson for future sprints:** Same as above.

---

### Issue: `tests/integration/offseason/fullCycle.test.ts` exit test 2 fails by design

**Category:** PRD Deviation (expected, plan-flagged, NOT addressed in Sprint 33)

**Sprint Task:** Quality gates

**What happened:**
`fullCycle.test.ts` exit test 2: "starters grow more in attack than
benchwarmers (p < 0.05)". Pre-Sprint-33, `runOffseason` called Sprint 16's
`computePlayerGrowth` which scaled rating gains by playing-time (starters
get 1.5×, benchwarmers 0.5×). Post-Sprint-33, `runOffseason` doesn't
develop ratings inside the offseason at all — gains land at the new
TRAINING_RESULTS preseason event via the FCCD coach-attribute-focus model
that intentionally does NOT differentiate by playing time.

The Sprint 16 model is REPLACED, not augmented. That's the explicit FCCD
mirror.

**Attempts made:**
1. Plan flagged this in Risk & Notes:
   > "computePlayerGrowth (Sprint 16) is the OLD dev model. Sprint 33's
   > applyTrainingResults is the NEW FCCD-style coach-attribute-focus model.
   > They are NOT additive: Sprint 33 REPLACES the old model."
2. Decision: do NOT update or delete this exit test in Sprint 33. The
   "starters grow more" assertion is genuinely no longer enforceable, but
   deleting the test in the same PR as the model swap conflates "test was
   wrong" with "design changed." Better to leave it failing as a record of
   the design pivot, document in retro, and re-author it in v1.3 when
   playing-time-aware gains might come back as a coach-skill perk
   (e.g. `TrainingExtraStartingPlayer`).

**Resolution:**
Left failing intentionally. Documented here. Sprint 35's deeper recruiting
work or a v1.3 development-model overhaul should re-author this test (or
delete + replace with an FCCD-model equivalent like "rosters with
high-development HCs grow more on average than rosters with low-development
HCs").

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: 0 (decision recorded but no action taken).
- Code quality: N/A.
- Technical debt introduced: A test that fails by design until v1.3
  development-model decision lands.

**Lesson for future sprints:**
When a sprint replaces a load-bearing system (here: dev model), don't
delete the old system's exit tests in the same sprint — keep them failing
as a record of the design change, then either re-author or delete in the
sprint that lands the replacement system's full v1.x acceptance criteria.
Deletion-by-justification gets murky if multiple sprints touch the same
code path.

---

## Recommendations for Sprint 34

### Carry-forward items

None. Sprint 33 shipped its 7 tasks cleanly. Spec exit-criteria items left to
the user (per spec §7):

1. `npm run test:calibration:full` — confirm sim path unchanged. Logically
   guaranteed: Sprint 33 only touched offseason + preseason event handlers
   + IPC + the one RC modal. Rally FSM, rotation engine, scheduler, and
   `simulateMatch` driver were NOT touched.
2. Manual UAT: walk through all 16 events end-to-end with a live save.
3. `git tag sprint-33-complete` after retro.

### Technical debt to address

1. **`fullCycle.test.ts` exit test 2 is a known design-broken test.** Will
   stay failing until v1.3 dev-model decisions land OR a Sprint 34/35 retro
   formally deletes/re-authors it. Document in v1.2-backlog.md.

2. **Sprint 28 in-progress lint + test failures.** As called out in Sprint 32
   retro: 10 lint errors in `RosterView.tsx` and a residual ~38 failing
   tests in modified-but-not-committed Sprint 28 work. Sprint 33 didn't
   touch these. They block the global gate.

3. **Phase-write retention in `openRecruitingCycle` / `openPortal` /
   `closeRecruitingCycle`** — pragmatic compromise; consider full strip
   in Sprint 35 when those services are deepened with priority-driven
   interest + scout reveal anyway.

4. **`playersTransferring` event v1.2 simplification: open + AI loop +
   close all in one event call.** Spec §8 OOS notes: "Transfer portal as
   recruit-with-priorities (FCCD `PlayerRecruitmentType.Transfer`) — v1.3."
   When that lands, the portal becomes a multi-event sequence (similar to
   RECRUITING_1/2/3 + SIGNING_DAY) replacing the single PLAYERS_TRANSFERRING
   event.

5. **TrainingResultEntry retention.** v1.2 ships unbounded retention. Plan
   estimate: 1.4 MB/season × 10 seasons = 14 MB. v1.3 should add to
   `pruneOldSeasons` to drop old TrainingResultEntry rows alongside Match /
   PlayerArchive.

### CLAUDE.md additions recommended

One gotcha worth adding under "Build / module resolution":

```markdown
- **Phase-driven service helpers (recruiting / portal) and the offseason
  orchestrator have a layered ownership of `Season.phase`.** Per Sprint 33,
  `advanceOffseasonEvent` owns phase transitions. The legacy `openRecruitingCycle`,
  `closeRecruitingCycle`, `openPortal` still write phase = 'RECRUITING' /
  'PORTAL' inside their transactions; the orchestrator's per-event handlers
  reset phase to 'OFFSEASON' immediately after to keep dispatch consistent.
  `closePortal` no longer writes phase at all (Sprint 31 retro rolled back).
  `advance{Recruiting,Portal}Week` no longer enforce a phase check — they
  rely on the orchestrator to call them at the right time. When refactoring
  these services, audit BOTH the inner phase write AND any orchestrator-side
  reset; a stale combination silently leaves Season.phase in the wrong state.
```

And one project-state entry:

```markdown
- **`runOffseason` is a thin loop, not a single transaction.** Pre-Sprint-33 it
  did graduate → dev → cap → year-bump in one $transaction and ended at
  phase=PRESEASON. Post-Sprint-33 it loops over `advanceOffseasonEvent` until
  phase=REGULAR, walking through all 11 OFFSEASON + 5 PRESEASON events
  including FINALIZE. End state is REGULAR / phaseWeek=0 / year+1. Tests
  that previously asserted phase=PRESEASON post-runOffseason were updated
  in Sprint 33; future tests should assert REGULAR.
```

### PRD corrections

None required for Sprint 33. The PRD body still stops at Sprint 26 (per
the Sprint 32 retro's same finding); v1.1+ specs live in `docs/sprints/`
and the v1.1+ pointer note added at the top of the PRD in Sprint 32 still
applies.

---

## Sprint 33 self-assessment

A predictable execution of an ambitious plan. Three Large tasks (33.3,
33.4, 33.5) plus three Medium and one Small; ~3000-4000 net new LOC across
~32 new files + 14 modified. All 35 own tests passed first or second cycle.
Two TypeScript errors (predicate narrowing + struct mismatch) and one
arithmetic typo were caught and fixed in <2 minutes total.

The plan's Risk & Notes section accurately predicted three issues that
manifested:
1. Combining 33.3 + 33.6 vs. serial execution.
2. The phase-write retention compromise.
3. The legacy test breakage (runOffseason + closePortal).

Net-additive vs. baseline: stashed baseline = 66 failing tests; with
Sprint 33 applied = 39 failing. Sprint 33 added 35 new passing tests AND
unblocked 27 baseline-failing tests by providing the offseason event
plumbing the Sprint 28 in-progress work needed. The single by-design
regression (`fullCycle.test.ts` exit test 2 — playing-time-based dev) is
documented and accepted.

Pre-existing Sprint 28 in-progress lint + test debt remains. Same shape
as Sprint 32 retro flagged. Sprint 34 and beyond should not pretend
otherwise.
