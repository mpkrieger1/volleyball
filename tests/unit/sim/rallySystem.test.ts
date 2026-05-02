// Sprint 5 integration — system-aware selection + momentum bias in simulateRally.

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

const runAttackers = (system: sim.SystemConfig, team: sim.TeamSide, N = 200) => {
  const attackers: number[] = [];
  for (let seed = 0; seed < N; seed++) {
    const rot = sim.rotateBy(sim.initialRotation(), seed % 6);
    const res = simulateRally({
      seed: `sys-${seed}`,
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: team === 'home' ? 'away' : 'home',
      homeRotation: team === 'home' ? rot : sim.initialRotation(),
      awayRotation: team === 'away' ? rot : sim.initialRotation(),
      homeSystem: team === 'home' ? system : sim.defaultSystem51(),
      awaySystem: team === 'away' ? system : sim.defaultSystem51(),
    });
    for (const ev of res.events) {
      if (ev.kind === 'attack' && ev.team === team) attackers.push(ev.attacker);
    }
  }
  return attackers;
};

describe('system-aware selection in simulateRally', () => {
  it('6-2 NEVER picks the current setter as attacker (per-rally invariant)', () => {
    const system = sim.defaultSystem62(); // A=0, B=3
    for (let seed = 0; seed < 300; seed++) {
      const rot = sim.rotateBy(sim.initialRotation(), seed % 6);
      const currentSetter = sim.deriveCurrentSetter(system, rot);
      const res = simulateRally({
        seed: `62-inv-${seed}`,
        home: lineup('home'),
        away: lineup('away'),
        servingTeam: 'away', // home attacks
        homeRotation: rot,
        awayRotation: sim.initialRotation(),
        homeSystem: system,
        awaySystem: sim.defaultSystem51(),
      });
      for (const ev of res.events) {
        if (ev.kind === 'attack' && ev.team === 'home') {
          expect(ev.attacker, `seed ${seed}: setter ${currentSetter} attacked`).not.toBe(
            currentSetter,
          );
        }
      }
    }
  });

  it('5-1 includes the setter as attacker when they are front-row', () => {
    const system = sim.defaultSystem51();
    const attackers = runAttackers(system, 'home', 400);
    // Setter (index 0) should appear in the attacker set at least once.
    expect(attackers).toContain(0);
  });

  it('momentum bias shifts kill rate observably across a large sample', () => {
    const N = 2000;
    const countKillsFor = (m: sim.MomentumState) => {
      let kills = 0;
      let attacks = 0;
      for (let seed = 0; seed < N; seed++) {
        const res = simulateRally({
          seed: `mom-${seed}`,
          home: lineup('home'),
          away: lineup('away'),
          servingTeam: seed % 2 === 0 ? 'away' : 'home',
          homeRotation: sim.initialRotation(),
          awayRotation: sim.initialRotation(),
          homeSystem: sim.defaultSystem51(),
          awaySystem: sim.defaultSystem51(),
          momentum: m,
        });
        for (const ev of res.events) {
          if (ev.kind === 'attack' && ev.team === 'home') {
            attacks += 1;
            if (ev.outcome === 'kill') kills += 1;
          }
        }
      }
      return { kills, attacks };
    };
    const neutral = countKillsFor({ home: 0, away: 0, lastWinner: null, runLength: 0 });
    const boosted = countKillsFor({ home: 1, away: -1, lastWinner: 'home', runLength: 5 });
    const ratioNeutral = neutral.kills / neutral.attacks;
    const ratioBoosted = boosted.kills / boosted.attacks;
    expect(ratioBoosted).toBeGreaterThan(ratioNeutral);
  });

  it('is deterministic across calls with full Sprint 5 inputs', () => {
    const input = {
      seed: 'det-5',
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'home' as sim.TeamSide,
      homeRotation: sim.initialRotation(),
      awayRotation: sim.rotateBy(sim.initialRotation(), 2),
      homeSystem: sim.defaultSystem62(),
      awaySystem: sim.defaultSystem51(),
      momentum: sim.updateOnPoint(sim.initialMomentum(), 'home'),
    };
    const a = simulateRally(input);
    const b = simulateRally(input);
    expect(a).toEqual(b);
  });
});
