# Sprint 4 Retrospective

**Date:** 2026-04-18
**Sprint Goal:** Matches obey real volleyball rotation, substitution, and libero rules.
**Status:** Complete (156/156 tests green; all 3 PRD exit tests verified; 40k+ rallies / 1000 matches produced zero rotation violations)
**Health:** 🟢 Clean

---

## SPRINT 4 HEALTH SUMMARY

```
Tasks Completed:        8 / 8  (hygiene + 7 sprint tasks)
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     2
  - Failed Approaches:  0
  - Repeated Attempts:  0
  - Diversions:         1  (intentional — back-compat on optional rotation)
  - Unexpected Errors:  1  (golden harness parse gap)
  - PRD Deviations:     0
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟢 Clean. Cleanest sprint to date. The S1/S2/S3 retro
lessons compounded: prebench hook, tsbuildinfo cleanup, package-name imports,
optional-rotation back-compat, and the `liberoBlocksAttack` second-line-of-defense
all smoothed the sprint.

Top 3 time sinks (all small):
1. Golden harness didn't parse new rotation/libero input fields — 1-line fix
2. Fixture regen double-step (gen inputs + regen expected) — ordinary process cost
3. Minor test structure quirk (1000-match loop running in describe body) — benign
```

---

## Issues

### Issue 1: Golden harness didn't parse the new optional rotation/libero fields

**Category:** Unexpected Error

**Sprint Task:** Task 4.6 — Golden fixtures for 6 rotations + libero

**What happened:**
After generating the 6 rotation input JSON files and their expected counterparts,
the golden harness failed 6 of 11 tests. The harness at
`tests/integration/sim/rallyGolden.test.ts` had been written in Sprint 3 against
only `{seed, home, away, servingTeam}`; it silently dropped the new optional
fields (`homeRotation`, `awayRotation`, `homeLibero`, `homeSetterIndex`, etc.)
when parsing. The regen script was updated to read them; the harness was not.
Expected JSONs had been generated with rotation applied, but the harness ran
`simulateRally` without rotation, producing different event sequences.

**Attempts made:**
1. Wrote the gen + regen scripts to include rotation fields. Fixtures generated
   correctly.
2. Ran the harness. 6/11 failed with `expect(actual).toEqual(expected)` diffs.
3. Updated the harness to parse the same optional fields as the regen script.
   All 11 green.

**Resolution:**
Extended the harness parse block with the same `...(raw.X && { X: schema.parse(...) })`
spread pattern used in `scripts/regen-rally-fixture.ts`.

**Diverted from original plan?** No — the plan anticipated "the regen script
may need a tiny extension." In practice the harness needed the mirror extension.

**Impact on sprint:**
- Time cost: Low (~2 min).
- Code quality: Clean.
- Technical debt introduced: Mild — the regen script and the harness now
  duplicate the same parse logic. Future sprint could extract a
  `parseRallyFixtureInput()` helper that both use. Not urgent.

**Lesson for future sprints:**
When a schema evolves (adding optional fields), update ALL callers that
parse the same on-disk format, not just the producer side. Consider a shared
fixture-input parser.

---

### Issue 2: Back-compat divergence — preserved Sprint 3 goldens by making rotation optional

**Category:** Diversion

**Sprint Task:** Task 4.4 — Rally FSM integration

**What happened:**
The plan's Risk & Notes section called out that enabling rotation in
`simulateRally` would likely change the event sequence for Sprint 3 fixtures,
and proposed preserving back-compat by making rotation fields OPTIONAL on the
input. Task 4.4 followed this guidance. Result: Sprint 3 fixtures passed
unchanged under the Sprint 4 engine (flat round-robin path kicks in when rotation
isn't supplied).

Side effect: Task 4.7 (recalibration) was effectively a no-op — the balanced
lineups with rotation produced the same 64.89% side-out rate because uniform
rating-50 players don't change selection bias under rotation.

**Attempts made:**
1. Wrote the FSM with optional rotation/libero params. Guarded every selection
   helper with `if (!c.rotation) return nextSlot(c)`.
2. Verified Sprint 3 goldens and the 5 Sprint 3 test files still pass.
3. Added rotation-aware tests in `rallyRotation.test.ts` to cover the new path.

**Resolution:**
The optional-path approach worked. Zero fixture regenerations required across
sprint boundaries.

**Diverted from original plan?** Yes, but it WAS in the plan — specifically the
Risk & Notes guidance was followed. Flagging as a diversion from the initial
plan section's execution-order wording (which had "Task 4.7 Recalibrate" as
potentially triggering Sprint 3 fixture regen).

**Impact on sprint:**
- Time cost: Saved time (no fixture regen required).
- Code quality: Code has a dual path (rotation / no-rotation) which adds a small
  branching complexity to `simulateRally`. Acceptable for now; consolidation
  opportunity when Sprint 5+ makes rotation the only legal path.
- Technical debt introduced: Mild — the Sprint 3 flat round-robin path is now
  effectively legacy. It costs nothing to maintain at runtime but its existence
  slightly obscures the intended call pattern. Consider removing in Sprint 5
  if no consumer actually relies on it (the real codebase will always pass
  rotation state).

**Lesson for future sprints:**
When a refactor needs to preserve regression fixtures, dual-path/optional-input
is low-cost short-term but accumulates. Plan the deprecation window in the same
sprint that introduces the dual path (e.g., "remove flat-rotator path in Sprint
5 once match loop is the only caller").

---

## Calibration notes (not an issue)

- **Side-out rate unchanged at 64.89%.** Rotation with rating-50 balanced lineups
  produces the same sampling distribution as flat round-robin. This is expected
  but also lucky: it's invariance under *uniform* ratings only. Non-uniform
  lineups (Sprint 8 onwards when generated players land) may shift the rate.
  The calibration test is the canary; keep it running on every PR.
- **Perf unchanged.** Rally mean ~0.012 ms, p99 ~0.1 ms. Rotation selection added
  ~3 cheap `playerAt()` calls per event; imperceptible at this scale.
- **1000-match regression** ran in <3 s, producing 40k+ rallies. Scaling room for
  Sprint 5's match loop + system toggle.

---

## Recommendations for Sprint 5

### Carry-forward items
- **Git remote / first CI push** — now 4 sprints overdue. Sprint 5 should
  resolve regardless of whether other tasks need it.
- **Sprint 3 flat-round-robin fallback in `simulateRally`** — consider deleting
  in Sprint 5 if match loop becomes the only call site.
- **Fixture input parser extraction** — the regen script and the golden harness
  now duplicate 6 lines of optional-field parsing. Extract a shared helper under
  `tests/fixtures/` or `/shared/src/sim/`.

### Technical debt to address
- Dual-path in `simulateRally` (optional rotation) — low cost, clear sunset when
  match loop is the only caller.
- `libero.ts`'s "above net" approximation — `liberoBlocksAttack` keys off
  front-row slot, not physical net-height. Document in CLAUDE.md if not already
  (it's in the file comment but not in the gotchas section).
- `rotationRegression.test.ts` runs its 1000-match loop at describe-time rather
  than inside an `it()`. Works (timing lands in "collect" phase) but slightly
  odd in test reporter output. Minor cleanup.
- Sprint 4 set/match loops hardcode default rotation carry-forward between sets.
  Real rule: each set starts with the coach-specified starting lineup. Sprint 5
  should expose this when system toggle + coach AI land.

### CLAUDE.md updates to add

Append a `### From Sprint 4` subsection under "Gotchas accumulated":

```markdown
### From Sprint 4
- **Rotation is position-aware selection, not player-to-slot assignment.**
  `RotationState.slots` is an ordered tuple `[P1, P2, P3, P4, P5, P6]` of
  lineup-player indices. `rotate()` is a left shift (P2 player becomes new P1).
  Six rotations is identity.
- **Libero "above net" is approximated by front-row slot occupancy.**
  `liberoBlocksAttack` returns true when the libero is in any front-row
  position. Real FIVB rule 19.3.1.3 cares about net height, not slot. Revisit
  if/when the sim models ball height.
- **`simulateRally` has an optional/legacy flat-rotator path.** When rotation
  fields are omitted, selection uses round-robin by slot index (the Sprint 3
  path). Prod callers must always pass rotation + libero state; tests may
  omit them for simplicity.
- **Golden-fixture input parsers must stay in sync.** If you add a new optional
  field to `SimulateRallyInput`, update BOTH `scripts/regen-rally-fixture.ts`
  AND `tests/integration/sim/rallyGolden.test.ts` — they share the same on-disk
  format and will silently diverge otherwise.
```

### PRD corrections
None required. Sprint 4's exit tests (6-rotation goldens, 1000-match zero
violations, 15-cap + 16th rejection) were achievable exactly as written.

---

## Notes

This was the first sprint where the retro's "top time sinks" section bottomed
out at items measured in single-digit minutes. The pattern worth preserving:

1. Plan the fallback / back-compat path in the plan's Risk & Notes, not in
   mid-task.
2. Land mechanisms (lint rules, pre-hooks) in Task N.0 at the start of each
   sprint so they're paying off during the same sprint.
3. Keep the calibration test running — it's the canary that caught nothing this
   sprint, which is exactly what a canary should do most of the time.

Test count progression: S1 26 → S2 83 → S3 119 → S4 156. Engine performance
unchanged across all four sprints.
