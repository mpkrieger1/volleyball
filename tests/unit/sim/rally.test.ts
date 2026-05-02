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

describe('simulateRally', () => {
  it('is deterministic for a given seed', () => {
    const input = {
      seed: 'rally-1',
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'home' as sim.TeamSide,
    };
    const a = simulateRally(input);
    const b = simulateRally(input);
    expect(a).toEqual(b);
  });

  it('starts with a serve event at tick 0', () => {
    const res = simulateRally({
      seed: 1,
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'home',
    });
    expect(res.events[0]?.kind).toBe('serve');
    expect(res.events[0]?.tick).toBe(0);
  });

  it('always ends with a point event', () => {
    for (const seed of [1, 2, 3, 4, 5, 'abc', 'xyz']) {
      const res = simulateRally({
        seed,
        home: lineup('home'),
        away: lineup('away'),
        servingTeam: 'home',
      });
      const last = res.events[res.events.length - 1];
      expect(last?.kind).toBe('point');
      if (last?.kind === 'point') {
        expect(['home', 'away']).toContain(last.winner);
      }
    }
  });

  it('never exceeds 40 contacts (PRD exit test 3)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const res = simulateRally({
        seed,
        home: lineup('home'),
        away: lineup('away'),
        servingTeam: seed % 2 === 0 ? 'home' : 'away',
      });
      expect(res.contacts).toBeLessThanOrEqual(40);
    }
  });

  it('serve ace awards the point to the serving team', () => {
    // Stack the deck: make serving team's server strong, receiver weak.
    const elite = (): sim.PlayerRatings => ({ ...balanced(), serve: 100 });
    const weak = (): sim.PlayerRatings => ({ ...balanced(), pass: 0 });
    let aceSeen = false;
    for (let seed = 0; seed < 200 && !aceSeen; seed++) {
      const res = simulateRally({
        seed,
        home: { team: 'home', players: Array.from({ length: 6 }, () => elite()) },
        away: { team: 'away', players: Array.from({ length: 6 }, () => weak()) },
        servingTeam: 'home',
      });
      const ace = res.events.find((e) => e.kind === 'serve' && e.quality === 'ace');
      if (ace) {
        aceSeen = true;
        const point = res.events[res.events.length - 1];
        expect(point?.kind).toBe('point');
        if (point?.kind === 'point') {
          expect(point.winner).toBe('home');
          expect(point.reason).toBe('service_ace');
        }
      }
    }
    expect(aceSeen).toBe(true);
  });

  it('serve error awards the point to the receiving team', () => {
    const freeError = (): sim.PlayerRatings => ({ ...balanced(), serve: 0 });
    let errSeen = false;
    for (let seed = 0; seed < 400 && !errSeen; seed++) {
      const res = simulateRally({
        seed,
        home: { team: 'home', players: Array.from({ length: 6 }, () => freeError()) },
        away: lineup('away'),
        servingTeam: 'home',
      });
      const err = res.events.find((e) => e.kind === 'serve' && e.quality === 'error');
      if (err) {
        errSeen = true;
        const point = res.events[res.events.length - 1];
        expect(point?.kind).toBe('point');
        if (point?.kind === 'point') expect(point.winner).toBe('away');
      }
    }
    expect(errSeen).toBe(true);
  });

  it('emitted events all validate against the zod schema', () => {
    const res = simulateRally({
      seed: 42,
      home: lineup('home'),
      away: lineup('away'),
      servingTeam: 'away',
    });
    for (const e of res.events) {
      expect(() => sim.RallyEvent.parse(e)).not.toThrow();
    }
    expect(() => sim.RallyResultSchema.parse(res)).not.toThrow();
  });
});
