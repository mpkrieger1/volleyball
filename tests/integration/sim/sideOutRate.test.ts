// PRD Sprint 3 exit test 1: 10,000-rally Monte Carlo with balanced lineups
// produces side-out rates within ±3% of the real NCAA average (~65%).
//
// Slow test (~200ms) — always runs. Determinism comes from the sequence of
// string seeds `m-0..m-9999`.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRally } from '../../../workers/src/sim/rally';

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

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: Array.from({ length: 6 }, () => balanced()),
});

describe('side-out rate calibration (PRD S3 exit test 1)', () => {
  const N = 10_000;
  let sideOuts = 0;
  let totalContacts = 0;

  for (let i = 0; i < N; i++) {
    const serving: sim.TeamSide = i % 2 === 0 ? 'home' : 'away';
    // Sprint 4: exercise rotation + libero during calibration so the 65% target
    // reflects the real engine path, not the Sprint 3 flat round-robin.
    const homeRot = sim.rotateBy(sim.initialRotation(), i % 6);
    const awayRot = sim.rotateBy(sim.initialRotation(), (i + 3) % 6);
    const res = simulateRally({
      seed: `m-${i}`,
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: serving,
      homeRotation: homeRot,
      awayRotation: awayRot,
      homeLibero: sim.liberoOff(5),
      awayLibero: sim.liberoOff(5),
      homeSetterIndex: 0,
      awaySetterIndex: 0,
    });
    if (res.winningTeam !== serving) sideOuts += 1;
    totalContacts += res.contacts;
  }
  const sideOutRate = sideOuts / N;
  const meanContacts = totalContacts / N;

  it(`side-out rate ${(sideOutRate * 100).toFixed(2)}% is within [62%, 68%]`, () => {
    expect(sideOutRate).toBeGreaterThanOrEqual(0.62);
    expect(sideOutRate).toBeLessThanOrEqual(0.68);
  });

  it('mean contacts per rally is in a sane 3..12 range', () => {
    expect(meanContacts).toBeGreaterThanOrEqual(3);
    expect(meanContacts).toBeLessThanOrEqual(12);
  });
});
