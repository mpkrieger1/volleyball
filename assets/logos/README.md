# VCD Team logos

This directory contains team logo assets (SVG preferred, PNG accepted).

## Rules

- **No FCCD content.** CLAUDE.md §Critical Rule 1 is absolute: zero copying from
  Football Coach: College Dynasty, its assets, its strings, or its `.asar` contents.
- **License-safe only.** Every file committed here must be public-domain, released
  under a permissive license (CC0, CC-BY, MIT, Apache-2.0), or owned by the project
  author with documented rights.
- **Naming.** Files must be named by team abbreviation: `<ABBR>.svg` or `<ABBR>.png`,
  matching the `Team.abbr` column in `prisma/seedData/teams.csv`. The logo resolver
  looks up by abbreviation.

## Placeholders

Teams without a real logo on disk fall back to a **generated monogram placeholder**
produced at runtime by `shared/src/assets/placeholderSvg.ts`. The placeholder draws
the team abbreviation in white on the team's primary color. This keeps the UI
functional while real art is sourced over time.

The seed script writes `logoPath = "placeholder:<ABBR>"` for every team during Sprint 2.
As real assets land here, edit `teams.csv` to set the correct asset-relative path
instead.
