// Sprint 18 PRD exit test 2: top-5 hitters by K/set appear in at least one
// of the 4 AA teams in 90%+ of simulated seasons.
//
// Approach (Sprint 17 lesson — pair p-value with magnitude):
//   - 100 Monte Carlo iterations of a synthetic season (seeded RNG per run).
//   - For each iteration: identify the top-5 OH/OPP hitters by K/set;
//     count how many appear in any of the 4 AA teams.
//   - Assert: ≥ 90/100 iterations have all 5 in AA.
//   - Magnitude pairing: average # of top-5 hitters appearing in AA across
//     all 100 runs is ≥ 4.7 / 5 (= 94%).

import { describe, expect, it } from 'vitest';
import { awards } from '@vcd/shared';
import { generateSyntheticSeason, topNHitters } from '../../fixtures/awards/syntheticSeason';

const ITERATIONS = 100;
const TOP_N = 5;
const PASS_THRESHOLD = 90;

describe('PRD Sprint 18 exit test 2 — top-5 hitters land in AA in 90%+ of seasons', () => {
  it('100 iterations: ≥90% have all top-5 K/set hitters in any AA team', () => {
    let allFiveCount = 0;
    let totalAppearances = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const season = generateSyntheticSeason({ seed: `exit-2-iter-${i}` });
      const top5 = topNHitters(season.stats, season.meta, TOP_N);
      const selections = awards.selectAllAmericans({ stats: season.stats, players: season.meta });
      const aaIds = new Set(selections.map((s) => s.playerId));
      const hits = top5.filter((id) => aaIds.has(id)).length;
      totalAppearances += hits;
      if (hits === TOP_N) allFiveCount++;
    }
    const passRate = allFiveCount / ITERATIONS;
    const avgAppearances = totalAppearances / ITERATIONS;
    // eslint-disable-next-line no-console
    console.log(
      `[exit-test-2] all-5 pass rate: ${(passRate * 100).toFixed(1)}%; ` +
        `avg top-5 appearances: ${avgAppearances.toFixed(2)}/5`,
    );
    expect(allFiveCount).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    // Magnitude pairing — average should be very close to 5/5.
    expect(avgAppearances).toBeGreaterThanOrEqual(4.7);
  });
});
