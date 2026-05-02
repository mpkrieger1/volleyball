# Rally golden fixtures

Each fixture is a pair:

- `<case>.input.json` — `{ seed, home, away, servingTeam }`
- `<case>.expected.json` — full `RallyResult` committed to disk

The harness at `tests/integration/sim/rallyGolden.test.ts` runs every `*.input.json`
through `simulateRally` and asserts byte-equality with `*.expected.json`.

## Regenerating (intentionally)

Per CLAUDE.md §Golden fixtures — fixtures are only regenerated in a **dedicated
commit** whose message explains why the engine output needed to change. Never
silently update a fixture to make a failing test pass; that hides the regression
the test is catching.

To regenerate one case:

```sh
npx tsx scripts/regen-rally-fixture.ts <case-name>
```

Then review the diff, confirm it's the intended change, and commit separately.

## Cases

- `balanced-home-serves` — both lineups rating 50 across the board, seed 1, home
  serves. The baseline smoke case.
- `elite-serve-vs-weak-pass` — home has serve=95, away has pass=25, seed 7. Tests
  the ace/error serve distribution shift.
- `elite-block-vs-mid-attack` — away block=90, home attack=60, seed 11. Tests
  defensive flow (blocks + digs).
