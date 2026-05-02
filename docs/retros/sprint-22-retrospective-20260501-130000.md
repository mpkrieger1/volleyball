# Sprint 22 Retrospective

**Date:** 2026-05-01 (backfilled in Sprint 24 Task 24.0; Sprint 22 retro
was not authored when the sprint ended — user pivoted directly to
`/sprint-plan 23`)
**Sprint Goal:** Calibration & balance pass — benchmark CSV checked in,
calibration test suite that runs a full simulated season vs benchmark,
probability-table tuning, tuning changelog, nightly CI workflow.
**Status:** Complete (with PRD-tolerated stub: benchmark CSV ships as a
STUB; PRD assertions auto-skip until real data is dropped in)
**Health:** 🟢 Clean

---

## Summary

Sprint 22 was the realism-validation sprint. The deliverables shipped
clean:
- Benchmark CSV scaffolding under `prisma/benchmarkData/` with `STUB`
  detection in the parser → calibration test skips assertions and logs
  a warning when the CSV is a placeholder.
- Volume-weighted top-25 aggregator (`shared/src/calibration/teamSeasonAggregate.ts`).
- Full-season orchestrator extracted to `main/src/calibration/runFullSeason.ts`
  (5 sec/season; reusable).
- Integration test `tests/integration/calibration/seasonCalibration.test.ts`
  with `it.skipIf(!benchmarkIsReal())` PRD assertions.
- Manual CLI `scripts/calibrate-season.ts --append-log` for tuning
  iterations.
- Tuning changelog template + README.
- Nightly GitHub Actions workflow `.github/workflows/calibration-nightly.yml`.

No tuning was actually performed because the benchmark CSV remained a
stub through Sprint 22's runtime. The user populated real 2024-25 NCAA
top-25 stats before Sprint 23 closed.

---

## Sprint 22 Health Summary

```
Tasks Completed:        9 / 9
Issues Encountered:     1 (recurring flake; not a regression)
Overall Sprint Health:  🟢 Clean
```

---

## Issues

### Issue: Sprint 13 recruiting top-5 stars flake recurred at final gate

**Category:** Pre-existing recurring flake (not Sprint 22 work)

**What happened:** Final-gate `npm test` hit the known recurring flake in
`tests/integration/recruiting/fullCycle.test.ts > exit test 2: top-5
prestige program averages ≥ 2.8 stars over 10 cycles` — got 2.7799.

**Resolution:** Documented as pre-existing recurring flake. Three known
recurring Monte Carlo flakes (Sprint 9 poll, Sprint 13 recruiting,
Sprint 17 coaching) need batch stabilization in a future cycle.

**Lesson for future sprints:** `/schedule` an agent for batch
stabilization. These flakes have recurred across 5+ sprints; the cost of
leaving them is ongoing test-output noise that masks real regressions.

---

## Recommendations for Sprint 23

1. **Carry-forward**: User to populate `prisma/benchmarkData/ncaa-2024-25-stats.csv`
   with real top-25 stats and remove the `# STUB` marker; calibration
   assertions then auto-activate.
2. **Pattern**: `runFullSeason` is the canonical full-season orchestrator;
   any test/script that needs a played-out season should reuse it
   instead of re-extracting the CT/NCAA loop from
   `tests/integration/postseason/fullPostseason.test.ts`.
3. **Pattern**: Stub-detection via `STUB` token in CSV comments is the
   right way to ship scaffolding that depends on user-supplied data.
4. **Pattern**: Volume-weighted aggregation (Σ kills / Σ totalAttacks
   per team), NOT mean-of-player-percentages. Top-25 average is mean
   across team values.
5. **CLAUDE.md additions**: stub-mode skipif pattern, runFullSeason
   orchestrator, benchmark CSV path convention, calibrate-season CLI,
   PRD top-25 metric vs league composition distinction. (All landed in
   CLAUDE.md "From Sprint 22" block.)

---

*Backfilled 2026-05-01 from conversation context and the existing CLAUDE.md
"From Sprint 22" block.*
