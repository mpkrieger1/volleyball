// Golden-fixture harness. See CLAUDE.md §Golden fixtures — fixtures never get
// silently updated; regenerate via `scripts/regen-rally-fixture.ts` in a
// dedicated commit.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sim } from '@vcd/shared';
import { simulateRally } from '../../../workers/src/sim/rally';

const fixturesDir = resolve(__dirname, '../../fixtures/rally');

const cases = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.input.json'))
  .map((f) => f.replace('.input.json', ''))
  .sort();

describe('rally golden fixtures', () => {
  expect(cases.length).toBeGreaterThan(0);

  for (const name of cases) {
    it(`[${name}] reproduces exactly`, () => {
      const raw = JSON.parse(readFileSync(resolve(fixturesDir, `${name}.input.json`), 'utf8'));
      const expected = JSON.parse(
        readFileSync(resolve(fixturesDir, `${name}.expected.json`), 'utf8'),
      );
      const input = sim.parseRallyFixtureInput(raw);
      const actual = simulateRally(input);
      expect(actual).toEqual(expected);
    });
  }

  it('determinism: running each fixture 3 times yields identical results (PRD exit test 2)', () => {
    for (const name of cases) {
      const raw = JSON.parse(readFileSync(resolve(fixturesDir, `${name}.input.json`), 'utf8'));
      const input = sim.parseRallyFixtureInput(raw);
      const a = simulateRally(input);
      const b = simulateRally(input);
      const c = simulateRally(input);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    }
  });
});
