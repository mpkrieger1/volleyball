// PRD Sprint 5 exit test 2: over 5,000 sets with coach-AI timeouts enabled,
// opponent scoring in the 3 points AFTER a timeout is called differs from the
// baseline (opponent scoring in any 3-point window where no timeout was called)
// by a statistically significant margin at p < 0.05 (one-sided: scoring DOWN).
//
// Determinism: same seeds → identical z-statistic every CI run. If the observed
// z hovers near -1.96, the remedy is to tune TIMEOUT_MOMENTUM_RESET_FACTOR, NOT
// widen the threshold.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateSet, type TeamMatchState } from '../../../workers/src/sim/set';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 55, stamina: 55,
});

const makeTeam = (team: sim.TeamSide, rot = sim.initialRotation()): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: rot,
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

type WindowSample = { opponentPoints: number; pointsCounted: number };

/**
 * For each team (home, away) in each set, collect:
 *   - postTimeout windows: starting at the rally AFTER a timeout they called,
 *     sum opponent points in the next 3 rallies.
 *   - noTimeout windows: any 3-consecutive-rally span where no timeout was
 *     called by this team, used as the baseline.
 */
function collectWindows(setsCount: number): { post: WindowSample; base: WindowSample } {
  const post = { opponentPoints: 0, pointsCounted: 0 };
  const base = { opponentPoints: 0, pointsCounted: 0 };

  for (let i = 0; i < setsCount; i++) {
    const result = simulateSet({
      seed: `to-${i}`,
      home: makeTeam('home', sim.rotateBy(sim.initialRotation(), i % 6)),
      away: makeTeam('away', sim.rotateBy(sim.initialRotation(), (i + 3) % 6)),
      initialServer: i % 2 === 0 ? 'home' : 'away',
      useCoachAi: true,
    });

    for (const side of ['home', 'away'] as sim.TeamSide[]) {
      const myTimeouts = result.timeouts
        .filter((t) => t.by === side)
        .map((t) => t.atRallyIdx);
      const opposite: sim.TeamSide = side === 'home' ? 'away' : 'home';

      // Post-timeout windows: the 3 rallies beginning at rallyIdx (the one
      // that played AFTER the timeout was called).
      for (const start of myTimeouts) {
        for (let k = 0; k < 3 && start + k < result.rallies.length; k++) {
          const winner = result.rallies[start + k]!.winningTeam;
          post.pointsCounted += 1;
          if (winner === opposite) post.opponentPoints += 1;
        }
      }

      // Baseline windows: every non-overlapping 3-rally span NOT within 3
      // rallies of a timeout call by this side.
      const excluded = new Set<number>();
      for (const to of myTimeouts) {
        for (let k = 0; k < 3; k++) excluded.add(to + k);
      }
      for (let start = 0; start + 3 <= result.rallies.length; start += 3) {
        if (excluded.has(start) || excluded.has(start + 1) || excluded.has(start + 2)) continue;
        for (let k = 0; k < 3; k++) {
          const winner = result.rallies[start + k]!.winningTeam;
          base.pointsCounted += 1;
          if (winner === opposite) base.opponentPoints += 1;
        }
      }
    }
  }
  return { post, base };
}

describe('timeout effect regression (PRD S5 exit test 2)', () => {
  const { post, base } = collectWindows(5000);
  const z = sim.twoProportionZ(
    post.opponentPoints,
    post.pointsCounted,
    base.opponentPoints,
    base.pointsCounted,
  );

  it(`post-timeout opp-score=${(z.p1 * 100).toFixed(2)}% (n=${post.pointsCounted})  baseline=${(z.p2 * 100).toFixed(2)}% (n=${base.pointsCounted})  z=${z.z.toFixed(3)}: opponent scoring DOWN at p < 0.05`, () => {
    expect(post.pointsCounted).toBeGreaterThan(100);
    expect(base.pointsCounted).toBeGreaterThan(1000);
    // One-sided: z < -1.645 corresponds to p < 0.05 one-sided.
    // Per PRD "p < 0.05"; use the one-sided threshold because the test
    // posits a directional hypothesis (post-timeout opponent scoring DOWN).
    expect(z.z).toBeLessThan(-1.645);
  }, 60_000);
});
