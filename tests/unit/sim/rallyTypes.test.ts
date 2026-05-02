import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

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

describe('sim type schemas', () => {
  it('PlayerRatingsSchema rejects out-of-range values', () => {
    expect(() => sim.PlayerRatingsSchema.parse({ ...balanced(), attack: 101 })).toThrow();
    expect(() => sim.PlayerRatingsSchema.parse({ ...balanced(), attack: -1 })).toThrow();
    expect(() => sim.PlayerRatingsSchema.parse({ ...balanced(), attack: 50.5 })).toThrow();
  });

  it('PlayerLineupSchema requires exactly 6 players', () => {
    const five = { team: 'home' as const, players: Array(5).fill(balanced()) };
    const seven = { team: 'home' as const, players: Array(7).fill(balanced()) };
    const six = { team: 'home' as const, players: Array(6).fill(balanced()) };
    expect(() => sim.PlayerLineupSchema.parse(five)).toThrow();
    expect(() => sim.PlayerLineupSchema.parse(seven)).toThrow();
    expect(sim.PlayerLineupSchema.parse(six).players.length).toBe(6);
  });

  it('RallyEvent discriminated union rejects unknown kinds', () => {
    expect(() => sim.RallyEvent.parse({ kind: 'bogus', tick: 0 })).toThrow();
  });

  it('RallyEvent accepts each valid kind', () => {
    const evts: sim.RallyEvent[] = [
      { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'in_play', inPlayGrade: 2 },
      { kind: 'reception', tick: 1, team: 'away', receiver: 3, grade: 2 },
      { kind: 'set', tick: 2, team: 'away', setter: 1, quality: 'good' },
      { kind: 'attack', tick: 3, team: 'away', attacker: 4, outcome: 'kill' },
      { kind: 'dig', tick: 4, team: 'home', digger: 2, grade: 1 },
      { kind: 'point', tick: 5, winner: 'away', reason: 'kill' },
    ];
    for (const e of evts) expect(() => sim.RallyEvent.parse(e)).not.toThrow();
  });

  it('avg computes the mean of selected keys', () => {
    const r = balanced();
    expect(sim.avg(r, ['attack', 'block'])).toBe(50);
    expect(sim.avg({ ...r, attack: 80, block: 60 }, ['attack', 'block'])).toBe(70);
  });

  it('RallyResultSchema requires a terminal point', () => {
    const minimal: sim.RallyResult = {
      seed: 1,
      servingTeam: 'home',
      winningTeam: 'home',
      events: [
        { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'ace' },
        { kind: 'point', tick: 1, winner: 'home', reason: 'service_ace' },
      ],
      contacts: 1,
    };
    expect(sim.RallyResultSchema.parse(minimal).winningTeam).toBe('home');
    expect(() => sim.RallyResultSchema.parse({ ...minimal, contacts: 41 })).toThrow();
  });
});
