// PRD Sprint 6 exit test 3: 1,000 simulateMatch calls average < 150 ms each on
// CI hardware. We measure mean, p50, p95, p99 and log them so regressions are
// visible in the test reporter output.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateMatch } from '../../../workers/src/sim/match';
import type { TeamMatchState } from '../../../workers/src/sim/set';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const makeTeam = (team: sim.TeamSide, rot = sim.initialRotation()): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: rot,
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

describe('match perf (PRD S6 exit test 3)', () => {
  it('1,000 matches back-to-back: mean < 150 ms', () => {
    const N = 1000;
    const timings: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      simulateMatch({
        seed: `perf-${i}`,
        home: makeTeam('home', sim.rotateBy(sim.initialRotation(), i % 6)),
        away: makeTeam('away', sim.rotateBy(sim.initialRotation(), (i + 3) % 6)),
        initialServer: i % 2 === 0 ? 'home' : 'away',
      });
      timings[i] = performance.now() - t0;
    }
    timings.sort((a, b) => a - b);
    const mean = timings.reduce((a, b) => a + b, 0) / N;
    const p = (q: number) => timings[Math.floor(N * q)]!;
    // eslint-disable-next-line no-console
    console.log(
      `matchPerf N=${N}  mean=${mean.toFixed(3)}ms  p50=${p(0.5).toFixed(3)}ms  p95=${p(0.95).toFixed(3)}ms  p99=${p(0.99).toFixed(3)}ms`,
    );
    expect(mean).toBeLessThan(150);
  }, 60_000);
});
