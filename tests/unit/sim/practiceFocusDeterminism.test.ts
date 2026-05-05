// Sprint 34 Task 34.4 — THE LOAD-BEARING TEST.
//
// `simulateMatch(input)` must produce byte-equal output whether or not
// the optional practice-focus modifiers are supplied — provided the
// modifiers are absent OR equal to the IDENTITY sentinel. This guards
// the calibration suite (CLAUDE.md §Critical rules #2): the sim driver
// remains deterministic by `seed` alone for the production calibration
// path, and any modifier is opt-in via explicit non-default values.

import { describe, it, expect } from 'vitest';
import { sim, season, createRng } from '@vcd/shared';
import { simulateMatch, type TeamMatchState } from '@vcd/workers';

function makeRatings(seed: string): sim.PlayerRatings {
  const rng = createRng(`ratings:${seed}`);
  return {
    attack: rng.int(40, 90),
    block: rng.int(40, 90),
    serve: rng.int(40, 90),
    pass: rng.int(40, 90),
    set: rng.int(40, 90),
    dig: rng.int(40, 90),
    athleticism: rng.int(40, 90),
    iq: rng.int(40, 90),
    stamina: rng.int(40, 90),
  };
}

function makeLineup(side: 'home' | 'away', seed: string): sim.PlayerLineup {
  const players: sim.PlayerRatings[] = [];
  for (let i = 0; i < 6; i++) players.push(makeRatings(`${side}:${seed}:${i}`));
  return { players: players as never };
}

function makeTeam(side: 'home' | 'away', seed: string): TeamMatchState {
  return {
    lineup: makeLineup(side, seed),
    rotation: sim.initialRotation(),
    libero: sim.liberoOff(5),
    setterIndex: 0,
    system: sim.defaultSystem51(),
  };
}

describe('Sprint 34 — practice-focus determinism (calibration gate)', () => {
  it('100 random seeds: simulateMatch with NO modifier === simulateMatch with IDENTITY modifiers', () => {
    for (let i = 0; i < 100; i++) {
      const seed = `seed-${i}`;
      const home = makeTeam('home', seed);
      const away = makeTeam('away', seed);
      const noModifier = simulateMatch({
        seed,
        home,
        away,
        initialServer: 'home',
      });
      const withIdentity = simulateMatch({
        seed,
        home,
        away,
        initialServer: 'home',
        homeModifier: season.IDENTITY_PRACTICE_FOCUS_MODIFIER,
        awayModifier: season.IDENTITY_PRACTICE_FOCUS_MODIFIER,
      });
      expect(withIdentity).toEqual(noModifier);
    }
  });

  it('default-modifier branch produces deterministic output across re-runs (same seed)', () => {
    const seed = 'rerun';
    const home = makeTeam('home', seed);
    const away = makeTeam('away', seed);
    const a = simulateMatch({ seed, home, away, initialServer: 'home' });
    const b = simulateMatch({ seed, home, away, initialServer: 'home' });
    expect(b).toEqual(a);
  });
});
