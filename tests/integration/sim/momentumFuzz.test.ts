// PRD Sprint 5 exit test 3: over 10,000 matches, momentum never escapes
// [-1.0, +1.0]. Uses every rally's post-point momentum snapshot returned by
// simulateSet.

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

describe('momentum clamp fuzz (PRD S5 exit test 3)', () => {
  it('10,000 matches: momentum stays in [-1.0, +1.0] on every rally', () => {
    const MATCHES = 10_000;
    let maxMagnitude = 0;
    let samples = 0;

    for (let m = 0; m < MATCHES; m++) {
      const result = simulateMatch({
        seed: `fuzz-${m}`,
        home: makeTeam('home', sim.rotateBy(sim.initialRotation(), m % 6)),
        away: makeTeam('away', sim.rotateBy(sim.initialRotation(), (m + 2) % 6)),
        initialServer: m % 2 === 0 ? 'home' : 'away',
      });
      for (const s of result.sets) {
        for (const mom of s.momentumAfterRally) {
          samples += 1;
          if (!(mom.home >= -1 && mom.home <= 1)) {
            throw new Error(`match ${m}: home momentum out of range: ${mom.home}`);
          }
          if (!(mom.away >= -1 && mom.away <= 1)) {
            throw new Error(`match ${m}: away momentum out of range: ${mom.away}`);
          }
          maxMagnitude = Math.max(maxMagnitude, Math.abs(mom.home), Math.abs(mom.away));
        }
      }
    }

    expect(samples).toBeGreaterThan(300_000);
    expect(maxMagnitude).toBeLessThanOrEqual(1);
  }, 120_000);
});
