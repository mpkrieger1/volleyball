// Sprint 34 Task 34.4 — non-default modifier produces a detectable
// effect on team performance. Complements the byte-equality test: this
// test confirms the modifier path actually mutates outcomes when the
// modifier ≠ identity.

import { describe, it, expect } from 'vitest';
import { sim, season, createRng } from '@vcd/shared';
import { simulateMatch, type TeamMatchState } from '@vcd/workers';

function makeRatings(seed: string): sim.PlayerRatings {
  const rng = createRng(`ratings:${seed}`);
  return {
    attack: rng.int(50, 80),
    block: rng.int(50, 80),
    serve: rng.int(50, 80),
    pass: rng.int(50, 80),
    set: rng.int(50, 80),
    dig: rng.int(50, 80),
    athleticism: rng.int(50, 80),
    iq: rng.int(50, 80),
    stamina: rng.int(50, 80),
  };
}

function makeTeam(side: 'home' | 'away', seed: string): TeamMatchState {
  const players: sim.PlayerRatings[] = [];
  for (let i = 0; i < 6; i++) players.push(makeRatings(`${side}:${seed}:${i}`));
  return {
    lineup: { players: players as never },
    rotation: sim.initialRotation(),
    libero: sim.liberoOff(5),
    setterIndex: 0,
    system: sim.defaultSystem51(),
  };
}

function homeKills(matchResult: ReturnType<typeof simulateMatch>): number {
  let kills = 0;
  for (const set of matchResult.sets) {
    for (const rally of set.rallies) {
      for (const ev of rally.events) {
        if (ev.kind === 'attack' && ev.team === 'home' && ev.outcome === 'kill') kills += 1;
      }
    }
  }
  return kills;
}

describe('Sprint 34 — practice-focus effect (non-default path)', () => {
  it('home POWER_HITTING boost detectably increases home kills across 200 seeds', () => {
    const N = 200;
    let baselineKills = 0;
    let boostedKills = 0;

    const homeBoost: season.PracticeFocusModifier = {
      ...season.IDENTITY_PRACTICE_FOCUS_MODIFIER,
      attackBonus: 1.05,
    };

    for (let i = 0; i < N; i++) {
      const seed = `effect-${i}`;
      const home = makeTeam('home', seed);
      const away = makeTeam('away', seed);
      baselineKills += homeKills(
        simulateMatch({ seed, home, away, initialServer: 'home' }),
      );
      boostedKills += homeKills(
        simulateMatch({
          seed,
          home,
          away,
          initialServer: 'home',
          homeModifier: homeBoost,
        }),
      );
    }

    // Boosted should be measurably higher than baseline. The 5% attack
    // bonus translates to ~0.5–1% kill lift after re-normalization (the
    // dist also has error/blocked/dug, so the kill bump is partially
    // absorbed into normalization). Empirical observation: ~0.8% lift
    // across 200 matches at this seed range — strictly positive but
    // small. Use 0.5% as the floor.
    expect(boostedKills).toBeGreaterThan(baselineKills);
    const lift = (boostedKills - baselineKills) / baselineKills;
    expect(lift).toBeGreaterThan(0.005);
  });
});
