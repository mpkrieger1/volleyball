# VCD seed data — 2026 D-I Women's Volleyball

These CSVs are the authoritative source for the baseline league at new-save time.

## Provenance

**Hand-authored, best-effort.** Conference membership reflects the 2026 D-I women's
volleyball alignment as the author understood it at commit time. School colors are
representative hex values. No asset, logo, or text was copied from
Football Coach: College Dynasty (FCCD) or any other commercial product — CLAUDE.md
§Critical Rule 1 is absolute.

Known approximations and caveats:
- The ~340 figure in PRD §2 is a target; this dataset contains 360 rows covering
  all 31 D-I conferences that sponsor women's volleyball. If a program in this file
  is not an actual D-I volleyball sponsor, or belongs to a different conference
  under 2026 alignment, open a PR with the correction and bump
  `expected-counts.json` in the same commit.
- Some abbreviations are synthesized where canonical short forms collide (e.g.,
  `KSU` vs `KSU2` for Kansas State vs Kennesaw State). Treat `abbr` as a unique key,
  not a brand.
- Prestige values are coarse starting tiers (0–100); the sim engine will evolve them
  season-over-season. Initial distribution leans toward historical women's
  volleyball strength, not football.

## Schema

`conferences.csv` columns: `id, name, abbr, tier, autoBidEligible`
- `id` — lowercase stable slug; used as the foreign key from teams.csv
- `tier` — one of `P4 | G5 | MID | IND`

`teams.csv` columns: `schoolName, abbr, conferenceId, primaryColor, secondaryColor, prestige`
- Colors in `#RRGGBB`, both required
- `conferenceId` must match a row in conferences.csv

`expected-counts.json` locks the row counts so silent data drift is caught by the
invariant test in `tests/unit/seedData.test.ts`.

## Changes

- Any addition, removal, or conference move must: (a) edit the CSV, (b) update
  `expected-counts.json` if row counts change, (c) add a one-line note here.
