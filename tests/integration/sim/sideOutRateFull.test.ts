// Sprint 6 second calibration canary. Exercises the full Sprint 5 engine path:
// rotation + libero + default 5-1 system + momentum updated across rallies.
// Catches regressions that the rotation-only test misses.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRally } from '../../../workers/src/sim/rally';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: Array.from({ length: 6 }, () => balanced()),
});

describe('side-out rate — full engine path (rotation + system + momentum)', () => {
  const N = 10_000;
  let sideOuts = 0;
  let totalContacts = 0;
  let momentum = sim.initialMomentum();

  for (let i = 0; i < N; i++) {
    const serving: sim.TeamSide = i % 2 === 0 ? 'home' : 'away';
    const res = simulateRally({
      seed: `full-${i}`,
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: serving,
      homeRotation: sim.rotateBy(sim.initialRotation(), i % 6),
      awayRotation: sim.rotateBy(sim.initialRotation(), (i + 3) % 6),
      homeLibero: sim.liberoOff(5),
      awayLibero: sim.liberoOff(5),
      homeSetterIndex: 0,
      awaySetterIndex: 0,
      homeSystem: sim.defaultSystem51(),
      awaySystem: sim.defaultSystem51(),
      momentum,
    });
    if (res.winningTeam !== serving) sideOuts += 1;
    totalContacts += res.contacts;
    // Reset momentum every ~30 rallies to simulate set boundaries.
    momentum = i % 30 === 29 ? sim.initialMomentum() : sim.updateOnPoint(momentum, res.winningTeam);
  }
  const rate = sideOuts / N;
  const meanContacts = totalContacts / N;

  it(`${(rate * 100).toFixed(2)}% side-out rate ∈ [62%, 68%]  (mean contacts ${meanContacts.toFixed(2)})`, () => {
    expect(rate).toBeGreaterThanOrEqual(0.62);
    expect(rate).toBeLessThanOrEqual(0.68);
  });

  it('mean contacts is plausible', () => {
    expect(meanContacts).toBeGreaterThanOrEqual(3);
    expect(meanContacts).toBeLessThanOrEqual(12);
  });
});
