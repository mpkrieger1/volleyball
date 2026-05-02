# Benchmark Data

This folder holds external data used for **simulation calibration** (PRD §5
Sprint 22 + ongoing nightly CI). It is read-only at runtime; never written
to during gameplay or seeding.

## Files

### `ncaa-2024-25-stats.csv`

Top-25 NCAA D-I Women's Volleyball team stats from the 2024–25 season.
Used by `tests/integration/calibration/seasonCalibration.test.ts` to assert
that simulated season averages match real benchmark within PRD-defined
tolerances (Sprint 22 PRD §5):

- Top-25 team avg hitting % within ±0.015
- Top-25 team avg K/set within ±0.3
- Top-25 libero dig/set within ±0.4

#### Format

Plain CSV. Lines starting with `#` are comments and ignored by the loader.
The presence of a `# STUB` comment line causes the loader to mark the file
as a **stub** — the calibration suite logs a warning and skips PRD
assertions in that case.

```
teamRank,schoolName,hittingPct,killsPerSet,liberoDigsPerSet,blocksPerSet,assistsPerSet
1,Pittsburgh,0.298,13.40,3.92,2.41,11.98
2,Penn State,0.285,12.91,3.81,2.55,11.65
...
```

| Column | Type | Range / Example | Notes |
|---|---|---|---|
| `teamRank` | int 1..25 | `1` | Final AVCA Coaches' Poll rank for the season. |
| `schoolName` | string | `"Pittsburgh"` | Display name; not joined to local Team table. |
| `hittingPct` | float | `0.298` | Team season hitting % (decimal, not %). |
| `killsPerSet` | float | `13.40` | Team season K/set. |
| `liberoDigsPerSet` | float | `3.92` | Average dig/set for the team's libero only. |
| `blocksPerSet` | float | `2.41` | Block-solos + 0.5 × block-assists per set. |
| `assistsPerSet` | float | `11.98` | Setter assists per set. |

#### Source

Real source: AVCA's published end-of-season top-25 stats from the 2024–25
season. Data should be sourced from the official AVCA stats portal or
NCAA.com volleyball stats pages.

#### Refresh cadence

Once per real-world season (annually, after the NCAA championship
match). Update the file, bump the comment header to the new year, and
re-run `npm run test:calibration-season` to confirm sim still matches.

#### Stub status

The committed file is currently a **stub** — placeholder values, not real
2024–25 stats. PRD exit tests don't assert until the stub marker is
removed and a real top-25 dataset replaces the example row.
