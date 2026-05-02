# Sprint 9 Retrospective

**Date:** 2026-04-19
**Sprint Goal:** Weekly poll reads like a real AVCA poll.
**Status:** Complete — all 3 PRD S9 exit tests green (including the slow season-scale invariant). 286/286 default tests + 3/3 season tests.
**Health:** 🟡 Bumpy

---

## SPRINT 9 HEALTH SUMMARY

```
Tasks Completed:        9 / 9  (hygiene + 8 sprint tasks)
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     4
  - Failed Approaches:  1  (inertia sort-and-renumber couldn't enforce exit test 3)
  - Repeated Attempts:  0
  - Diversions:         0
  - Unexpected Errors:  3  (test-data spread bug; sort tiebreak direction; lint prefer-const)
  - PRD Deviations:     0
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟡 Bumpy. The poll sim itself worked first try (voter
model produced a 5/5 overlap with objective top 5 without tuning). But the
inertia algorithm required a full rewrite mid-task when unit-test-green code
failed the season-scale integration test.

Top 3 time sinks:
1. Inertia algorithm rewrite (sort-and-renumber → rank-slot assignment) — Failed Approach
2. Test setup bug (metrics spread overrode specific T10 entry) — Unexpected Error
3. Sort tiebreak direction wrong — Unexpected Error
```

---

## Issues

### Issue 1: Inertia's sort-and-renumber algorithm failed PRD S9 exit test 3

**Category:** Failed Approach

**Sprint Task:** Task 9.4 — Prior-rank inertia (diagnosed in Task 9.7 via
the integration test)

**What happened:**
My first implementation of `applyInertia` computed a `desiredRank` per team
(clamped to the movement-allowance range), sorted all teams by desiredRank,
and renumbered the sorted list 1..25 as the final output. Unit tests passed.
Integration test (13-week season) failed:

```
week 1, team cmo5uxv9q002fldz1v1j1c2pz moved 11 spots (prev=25, now=14) without an upset
```

The bug: when many teams were pushed out of their narrow allowed windows
(e.g., a team with prev=25 had range [21, 25] but those slots were taken),
they landed in an overflow pool. My initial code then *filled empty 1..25
slots from overflow*, which let a team with prev=25 land at rank 14 because
rank 14 happened to be empty after sorting.

**Attempts made:**
1. Sort-by-desiredRank + renumber. Unit tests pass. Season integration
   test fails: 11-spot non-upset jump.
2. Tweaked tiebreak direction (reverse `originalRank`). Unit tests still
   pass. Integration test still fails.
3. Rewrote as explicit **rank-slot assignment**: compute each team's
   allowed `[lo, hi]` range; walk newPoll in score order; place each team
   in the first free slot within their range; if no slot fits, team drops
   off this week. Removed the "fill empty slots with overflow" fallback
   entirely.
4. Integration test passes. All 8 unit tests still pass.

**Resolution:**
Rewrote the algorithm. The rank-slot assignment model is structurally
simpler and harder to violate — the range IS the final-rank constraint,
not a sort key that can be renumbered around.

**Diverted from original plan?** No — the plan specified `applyInertia`
with the stated invariants, not a specific algorithm. The mistake was
purely implementation.

**Impact on sprint:**
- Time cost: Medium (~15 min of debugging + rewrite).
- Code quality: Improved. Final algorithm is easier to reason about.
- Technical debt introduced: None. The new algorithm is strictly better.

**Lesson for future sprints:**
**Unit tests don't catch emergent integration bugs.** The sort-renumber
approach passed every unit test I wrote (including tests that individually
asserted "0-3 team can't rise" and "non-upset can't move > 8"). What
broke was the interaction across 25 teams competing for overlapping
ranges — a scenario my unit tests didn't construct. Whenever a function
does slot-filling / ranking / scheduling, write a unit test that pushes
many entities through the same narrow constraint to surface these bugs
before the integration test does.

---

### Issue 2: Test setup — object spread overrode a specific metrics entry

**Category:** Unexpected Error

**Sprint Task:** Task 9.4 — Inertia unit tests

**What happened:**
Initial version of the "0-3 team cannot rise" test built its metrics
map like this:

```ts
const metrics = mkMetrics([
  { id: 'T10', last3Wins: 0, last3Losses: 3 },
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `T${i + 1}`, last3Wins: 2, last3Losses: 1,
  })),
]);
```

The spread iterated T1..T25 — including T10 — with `last3Wins: 2,
last3Losses: 1`. Because `mkMetrics` builds a Map sequentially, the later
entry for T10 overwrote the earlier `0-3` entry. The test was asserting
the inertia rule never fired — my algorithm was technically correct and
the test was wrong.

**Attempts made:**
1. Original spread with T10 override clobbered. Test failed.
2. Collapsed into a single Array.from that conditionally assigns 0-3 to
   T10 only. No override risk.

**Resolution:**
Rewrote the test fixture to avoid spread + duplicate-key hazard.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low (~5 min once I inspected the spread semantics).
- Code quality: Test fixture is clearer now.
- Technical debt introduced: No.

**Lesson for future sprints:**
When building test fixtures that map IDs to values, avoid "specific entry
+ spread of defaults" patterns — the spread clobbers. Either merge at the
end with the specific entry last, or build from a single data source with
conditionals.

---

### Issue 3: Sort tiebreak direction initially wrong

**Category:** Unexpected Error

**Sprint Task:** Task 9.4 — Inertia first-attempt algorithm

**What happened:**
The sort-and-renumber algorithm's tiebreak used `a.originalRank -
b.originalRank` (lower orig first) when I actually wanted higher orig to
win on ties. Got the compareFn direction wrong. Caught when one of the
inertia unit tests failed; I flipped to `b.originalRank - a.originalRank`.

**Attempts made:**
1. Forward tiebreak. Unit test for "new entrant floored at rank 20" failed.
2. Reverse tiebreak. Unit test passed.

**Resolution:**
Reverse direction. Later obsoleted by Issue 1's rewrite (the rewritten
algorithm doesn't use sort-renumber at all).

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Obsoleted by Issue 1 rewrite.
- Technical debt introduced: No.

**Lesson for future sprints:**
TypeScript's `Array.sort` compareFn semantics: `a - b` is ascending (small
a before large a). For tiebreak-ascending-then-descending patterns, write
out a concrete tuple example in the comment before coding.

---

### Issue 4: Lint `prefer-const` on a test helper

**Category:** Unexpected Error

**Sprint Task:** Task 9.8 — Final gate

**What happened:**
The invariants test declared `let pollsByWeek = new Map(...)` at module
scope. It was never reassigned (I only mutated via `.set()`). ESLint
flagged `prefer-const`. Trivial.

**Attempts made:**
1. `let` → `const`. Lint clean.

**Resolution:**
One-line fix.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: Fine.
- Technical debt introduced: No.

**Lesson for future sprints:**
The `npm run check` script added in Task 9.0 would have caught this
during the task if I had actually run it after writing the invariants
test. The mechanism is there; I still need the discipline to use it
mid-task, not just at final gate. **Fourth sprint in a row this lesson
applies** (Sprints 3, 5, 8, 9).

---

## Notable positives (not issues)

- **Voter model tuning worked first try.** The initial weight set (0.55
  winPct, 0.25 opponentWinPct, + recency/blueblood/loyalty bonuses)
  produced a **5/5 overlap** with the objective top-5 (win% + opponent
  win% ranking) on the seeded 13-week season. PRD target was ≥ 4/5.
- **`npm run check` landed.** After three sprints of flagging "run lint
  per task," the discipline finally has a mechanism. Used it mid-sprint
  once and caught a typecheck issue immediately.
- **Test count progression stayed healthy.** S1 26 → S2 83 → S3 119 → S4
  156 → S5 189 → S6 211 → S7 239 → S8 254 → S9 **286** (+3 season tests).
- **No CLAUDE.md gotcha recurrences.** The Sprint 8 retro flagged
  `type-inference-from-discriminated-union` and other known patterns —
  none recurred this sprint. Documentation is working.

---

## Recommendations for Sprint 10

### Carry-forward items
- **Nothing blocking.** All sprint tasks complete; no carryover. Git
  remote push still outstanding (9 sprints) but not blocking.

### Technical debt to address
- The poll point system uses the Prisma `Poll` schema which has a
  `points` column missing. Sprint 9's `runPollForWeek` only writes
  `{ week, rank, teamId, prevRank, firstPlaceVotes }` — not `points`.
  Check the schema (it may have been intentionally omitted); if `points`
  exists in the schema, wire it up. Otherwise document the omission.
- `MAX_NON_UPSET_MOVE` (8) and `MAX_NORMAL_RISE` (4) / `MAX_NORMAL_DROP`
  (6) are two separate clamps — confusingly, one is for the PRD exit
  test 3 hard bound and the other tightens below. Consider consolidating.
- The "overflow teams drop off" behavior can leave polls with < 25 rows
  in pathological weeks. In the 13-week season test this didn't happen,
  but a future season with heavy churn might. Add an integration assertion
  that polls always return exactly 25 rows, or document that < 25 is
  acceptable.

### CLAUDE.md updates to add

Append a `### From Sprint 9` subsection:

```markdown
### From Sprint 9
- **Unit tests don't catch emergent integration bugs in slot-filling
  algorithms.** When a function places entities into overlapping slot
  ranges (ranking, scheduling, round-robin), write a unit test that
  pushes many entities through the same narrow constraint — otherwise
  the bug only surfaces at integration scale. The Sprint 9 inertia
  rewrite is the template for this class of failure.
- **Rank-slot assignment > sort-and-renumber** for rank-based placement
  problems. Compute allowed `[lo, hi]` per entity; walk in priority
  order; place in first free slot within range; drop off when no slot
  fits. Don't fill empty slots with overflow — that defeats the range
  constraint.
- **`npm run check`** is the per-task gate. Running it mid-sprint instead
  of only at the final gate has been flagged in Sprint 3, 5, 8, and 9
  retros. The mechanism is there — use it.
- **Test fixtures: avoid "specific entry + spread of defaults"** when
  building ID → value maps. The spread clobbers. Build from a single
  source with conditionals instead.
```

### PRD corrections
- None required. Sprint 9's exit tests were all achievable as written and
  landed cleanly.

Worth flagging for future PRD edits (not requested now): the "realistic
top 5" reference in exit test 1 isn't precisely defined. Sprint 9 used
`winPct × 0.7 + opponentWinPct × 0.3`. Sprint 10's RPI replaces this proxy.

---

## Notes

The inertia algorithm rewrite is the most instructive event of this
sprint. The lesson is NOT "unit tests are bad" — it's that **slot-filling
algorithms have correctness properties that only emerge at scale**, and
the specific failure mode (renumbering around constraints) is a common
class of bug that unit tests rarely construct.

The voter model's success on the first try is the opposite lesson: when
an algorithm's inputs and output semantics are well-specified, the
implementation can be got right without iteration. Poll aggregation,
team metrics, and ballot generation all worked first try. Only the
*adjustment layer* (inertia) needed rework.

Running tally of retro lessons that persist:

1. **"Run `npm run check` per task"** — flagged in Sprints 3, 5, 8, 9.
   Mechanism exists; habit still not fully internalized. Sprint 10: try
   setting an explicit "after every file save" note somewhere visible.
2. **Slot-filling bugs need scale tests** (new this sprint) — add an
   "adversarial stress test" pattern to the sim/algorithm testing style.
