// PRD Sprint 4 exit test 2: 1,000-match regression run surfaces zero rotation
// violations.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateMatch } from '../../../workers/src/sim/match';
import type { TeamMatchState } from '../../../workers/src/sim/set';

const balanced = (): sim.PlayerRatings => ({
  attack: 50,
  block: 50,
  serve: 50,
  pass: 50,
  set: 50,
  dig: 50,
  athleticism: 50,
  iq: 50,
  stamina: 50,
});

const makeTeam = (team: sim.TeamSide, rot = sim.initialRotation()): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: rot,
  libero: sim.liberoOff(5),
  setterIndex: 0,
});

describe('rotation regression (1000 matches)', () => {
  it('produces zero rotation_violation events and exercises enough rallies', () => {
    const MATCHES = 1000;
    let totalRallies = 0;
    let violations = 0;

    for (let m = 0; m < MATCHES; m++) {
      const result = simulateMatch({
        seed: `regress-${m}`,
        home: makeTeam('home', sim.rotateBy(sim.initialRotation(), m % 6)),
        away: makeTeam('away', sim.rotateBy(sim.initialRotation(), (m + 3) % 6)),
        initialServer: m % 2 === 0 ? 'home' : 'away',
      });
      for (const s of result.sets) {
        totalRallies += s.rallies.length;
        for (const rally of s.rallies) {
          for (const ev of rally.events) {
            if (ev.kind === 'point' && ev.reason === 'rotation_violation') {
              violations += 1;
            }
          }
        }
      }
    }

    expect(violations).toBe(0);
    expect(totalRallies).toBeGreaterThanOrEqual(40_000);
  }, 60_000);
});
