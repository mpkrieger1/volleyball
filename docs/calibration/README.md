# Calibration

Sprint 22 introduced a continuous calibration regime so that the rally
simulator's probability tables stay aligned with real NCAA D-I Women's
volleyball statistics over the lifetime of the project.

## Files

- `tuning-log.md` — append-only changelog of every probability-table change,
  the hypothesis behind it, and the post-change measurement. **Read this
  before changing any value in `shared/src/sim/tuning.ts`.**
- `../../prisma/benchmarkData/ncaa-2024-25-stats.csv` — the benchmark dataset
  the calibration suite compares against.
- `../../tests/integration/calibration/seasonCalibration.test.ts` —
  full-season pooled-mean assertions vs. PRD tolerance bands.
- `../../scripts/calibrate-season.ts` — manual single-season runner used
  during tuning iterations.

## Workflow

1. **Drop new benchmark data** (when AVCA publishes the next season's top-25
   final stats) into `prisma/benchmarkData/ncaa-2024-25-stats.csv` (or a
   sibling file with the season year in the name and update the loader).
2. **Add a baseline section** at the top of `tuning-log.md` for the new
   benchmark — capture sim-vs-benchmark deltas with the *current* tuning
   table.
3. **If any metric is outside the PRD tolerance band**, follow the
   "tuning iteration" template in `tuning-log.md`:
   - State the hypothesis
   - Record the knob change as an old/new pair
   - Run `npm run test:calibration-season` (or `npm run calibrate:run -- --seed=… --append-log` for spot checks)
   - Record the result table — `✓` or `✗` per metric
4. **Cap iterations at 3** per sprint. After 3, document the residual gap
   and ship anyway. Calibration is iterative; the goal is not perfection
   in a single sprint.

## PRD tolerance bands

| Metric | Band |
|---|---|
| Top-25 hitting % | ±0.015 of benchmark mean |
| Top-25 K/set | ±0.3 of benchmark mean |
| Top-25 libero dig/set | ±0.4 of benchmark mean |

## CI

The nightly workflow `.github/workflows/calibration-nightly.yml`
runs both `test:calibration:full` (Sprint 5 isolated-rally Monte
Carlo) and `test:calibration-season` (Sprint 22 full-season pooled
mean) at 06:00 UTC every day. Failures surface in the workflow run
summary but do **not** block PR merges.
