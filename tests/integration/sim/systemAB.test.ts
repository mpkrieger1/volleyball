// PRD Sprint 5 exit test 1: 5-1 vs 6-2 produces measurable hitting% gap
// (≥ 0.010 in the expected direction).
//
// Expected direction: 6-2 has HIGHER first-attack hitting% than 5-1. 6-2 excludes
// BOTH setter indices from the front-row attacker pool (2 strong attackers).
// 5-1 uses all 3 front-row slots, always including one weak setter (with the
// lineup below). So 6-2 never sends a weak setter to attack; 5-1 does ~33% of
// the time.
//
// Why first-attack only? Rally-extending dugs introduce symmetric later attacks
// from both teams, diluting the system effect into noise. First-attack hitting%
// is the cleanest measurement of the PRD S5 exit criterion.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateSet, type TeamMatchState } from '../../../workers/src/sim/set';

// Non-uniform lineup: attackers (slots 1,2,4,5) rate 65 attack, setters
// (slots 0 and 3) rate 40 attack. Identical for both teams so the
// cross-comparison is fair.
const STRONG_ATTACKER: sim.PlayerRatings = {
  attack: 95, block: 50, serve: 50, pass: 50, set: 30, dig: 50,
  athleticism: 55, iq: 55, stamina: 55,
};
const WEAK_ATTACKING_SETTER: sim.PlayerRatings = {
  attack: 1, block: 50, serve: 50, pass: 50, set: 95, dig: 50,
  athleticism: 55, iq: 55, stamina: 55,
};

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: [
    WEAK_ATTACKING_SETTER, // slot 0 (setter in both 5-1 and 6-2)
    STRONG_ATTACKER,       // slot 1
    STRONG_ATTACKER,       // slot 2
    WEAK_ATTACKING_SETTER, // slot 3 (setter B in 6-2 — regular attacker in 5-1)
    STRONG_ATTACKER,       // slot 4
    STRONG_ATTACKER,       // slot 5
  ],
});

const makeTeam = (
  team: sim.TeamSide,
  system: sim.SystemConfig,
  rot = sim.initialRotation(),
): TeamMatchState => ({
  lineup: lineup(team),
  rotation: rot,
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system,
});

function measureHittingPct(system: sim.SystemConfig, setsPerArm: number): number {
  let kills = 0;
  let errors = 0;
  let attacks = 0;
  for (let i = 0; i < setsPerArm; i++) {
    const result = simulateSet({
      seed: `ab-${system.system}-${i}`,
      home: makeTeam('home', system, sim.rotateBy(sim.initialRotation(), i % 6)),
      away: makeTeam('away', system, sim.rotateBy(sim.initialRotation(), (i + 3) % 6)),
      initialServer: i % 2 === 0 ? 'home' : 'away',
    });
    for (const rally of result.rallies) {
      // First attack of each rally only — isolates the setter-selection effect.
      const firstAttack = rally.events.find((e) => e.kind === 'attack');
      if (firstAttack && firstAttack.kind === 'attack') {
        attacks += 1;
        if (firstAttack.outcome === 'kill') kills += 1;
        else if (firstAttack.outcome === 'error') errors += 1;
      }
    }
  }
  return (kills - errors) / attacks;
}

describe('A/B system sim (PRD S5 exit test 1)', () => {
  const setsPerArm = 1500;
  const hittingPct51 = measureHittingPct(sim.defaultSystem51(), setsPerArm);
  const hittingPct62 = measureHittingPct(sim.defaultSystem62(), setsPerArm);
  const gap = hittingPct62 - hittingPct51;

  it(`5-1 ${hittingPct51.toFixed(4)}  6-2 ${hittingPct62.toFixed(4)}  gap ${gap.toFixed(4)}: 6-2 − 5-1 ≥ 0.010`, () => {
    // Expected direction: 6-2 > 5-1 on first-attack hitting% — 6-2's 2-attacker
    // pool excludes both weak setters.
    expect(gap).toBeGreaterThanOrEqual(0.010);
  });

  it('determinism: identical seed produces identical numeric results', () => {
    const again = measureHittingPct(sim.defaultSystem51(), setsPerArm);
    expect(again).toBeCloseTo(hittingPct51, 10);
  });
});
