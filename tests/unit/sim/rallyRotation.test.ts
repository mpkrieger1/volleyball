// Sprint 4: rotation-aware rally selection. Every attacker must come from
// front-row; the libero must not serve without the exception flag; setter is
// taken from the designated setter index.

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

const attackingSlots = (res: sim.RallyResult, team: sim.TeamSide): number[] =>
  res.events.filter((e): e is Extract<sim.RallyEvent, { kind: 'attack' }> => e.kind === 'attack' && e.team === team).map((e) => e.attacker);

describe('rotation-aware rally', () => {
  it('attackers from a rotated team always come from front-row slots', () => {
    for (let seed = 0; seed < 100; seed++) {
      const homeRot = sim.rotateBy(sim.initialRotation(), seed % 6);
      const awayRot = sim.rotateBy(sim.initialRotation(), (seed + 3) % 6);
      const res = simulateRally({
        seed: `rot-${seed}`,
        home: lineup('home'),
        away: lineup('away'),
        servingTeam: seed % 2 === 0 ? 'home' : 'away',
        homeRotation: homeRot,
        awayRotation: awayRot,
      });
      for (const attacker of attackingSlots(res, 'home')) {
        const pos = sim.positionOf(homeRot, attacker);
        expect(pos, `home attacker ${attacker} at ${pos}`).toBeTruthy();
        expect(sim.isFrontRow(pos!), `home attacker at ${pos} must be front-row`).toBe(true);
      }
      for (const attacker of attackingSlots(res, 'away')) {
        const pos = sim.positionOf(awayRot, attacker);
        expect(pos).toBeTruthy();
        expect(sim.isFrontRow(pos!)).toBe(true);
      }
    }
  });

  it('does not emit rotation_violation when rotation is provided correctly', () => {
    for (let seed = 0; seed < 500; seed++) {
      const res = simulateRally({
        seed: `v-${seed}`,
        home: lineup('home'),
        away: lineup('away'),
        servingTeam: seed % 2 === 0 ? 'home' : 'away',
        homeRotation: sim.rotateBy(sim.initialRotation(), seed % 6),
        awayRotation: sim.rotateBy(sim.initialRotation(), (seed + 2) % 6),
      });
      const violation = res.events.find(
        (e) => e.kind === 'point' && e.reason === 'rotation_violation',
      );
      expect(violation, `seed ${seed} should not rotation-violate`).toBeUndefined();
    }
  });

  it('libero does not serve at P1 without the exception flag', () => {
    // Place libero (index 5) at P1 by rotating 5 times.
    const homeRot = sim.rotateBy(sim.initialRotation(), 5);
    expect(sim.playerAt(homeRot, 'P1')).toBe(5);
    const liberoState = sim.liberoReplace(sim.liberoOff(5), homeRot, sim.playerAt(homeRot, 'P5'));
    const res = simulateRally({
      seed: 'libero-serve',
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'home',
      homeRotation: homeRot,
      awayRotation: sim.initialRotation(),
      homeLibero: liberoState,
    });
    const serve = res.events.find((e) => e.kind === 'serve');
    expect(serve).toBeTruthy();
    if (serve && serve.kind === 'serve') {
      // Server must NOT be the libero (index 5).
      expect(serve.server).not.toBe(5);
    }
  });

  it('is deterministic when rotation + libero are provided', () => {
    const input = {
      seed: 'det-1',
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'home' as sim.TeamSide,
      homeRotation: sim.rotateBy(sim.initialRotation(), 2),
      awayRotation: sim.rotateBy(sim.initialRotation(), 4),
      homeLibero: sim.liberoOff(4),
      awayLibero: sim.liberoOff(5),
    };
    const a = simulateRally(input);
    const b = simulateRally(input);
    expect(a).toEqual(b);
  });

  it('setter index is honored when specified', () => {
    const res = simulateRally({
      seed: 'setter-1',
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'away',
      homeRotation: sim.initialRotation(),
      awayRotation: sim.initialRotation(),
      homeSetterIndex: 3,
      awaySetterIndex: 3,
    });
    const sets = res.events.filter(
      (e): e is Extract<sim.RallyEvent, { kind: 'set' }> => e.kind === 'set',
    );
    for (const s of sets) {
      expect(s.setter).toBe(3);
    }
  });
});
