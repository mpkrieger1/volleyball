# Tuning Log

Append-only changelog of probability-table changes in
`shared/src/sim/tuning.ts`. **Newest entries at the top.**

Format per Sprint 22 retro: each entry is either a **Baseline** (whole
section) or an **Iteration** (hypothesis → knob change → result).

---

## Sprint 22 baseline — TBD (awaiting real benchmark CSV)

### Benchmark

- **Source:** NCAA 2024-25 AVCA Top-25 final stats
- **File:** `prisma/benchmarkData/ncaa-2024-25-stats.csv`
- **Status:** STUB. Drop real top-25 averages into the CSV and the calibration
  suite's PRD assertions activate automatically.

### Pooled simulator output (5 fixed-seed seasons)

Will be filled in once the suite is run for the first time.

| Metric | Benchmark | Sim (pooled mean of 5 seasons) | Δ | In tolerance? |
|---|---|---|---|---|
| Top-25 hitting % | TBD | TBD | TBD | TBD |
| Top-25 K/set | TBD | TBD | TBD | TBD |
| Top-25 libero dig/set | TBD | TBD | TBD | TBD |
| Top-25 blocks/set | TBD | TBD | (informational) | n/a |
| Top-25 assists/set | TBD | TBD | (informational) | n/a |

### Manual `calibrate:run` log (append-only)

| Timestamp | Seed | Hit % | K/set | Libero D/set | Blocks/set | Assists/set | Benchmark mode |
|---|---|---|---|---|---|---|---|

---

## Iteration template

When tuning, append a new section above the baseline. Use this template:

```markdown
## Iteration N — YYYY-MM-DD

### Hypothesis
[Which metric is out of band, and the proposed mechanism for the fix.]

### Knob change

| Knob | Old | New | Reason |
|---|---|---|---|
| ATTACK_KILL_BASE | 0.38 | 0.40 | Hit% was 0.005 below band; expect +0.005 lift |

### Result (5 fixed-seed seasons pooled)

| Metric | Sim | Δ vs benchmark | In tolerance? |
|---|---|---|---|
| Hit % | 0.??? | ±0.??? | ✓ / ✗ |
| K/set | ??.?? | ±?.?? | ✓ / ✗ |
| Libero D/set | ?.?? | ±?.?? | ✓ / ✗ |

### Notes
[Any side-effects, surprising interactions, decisions to keep or revert.]
```

---

*Sprint 22 cap: ≤3 iterations. After 3, document residual gap and ship.*
