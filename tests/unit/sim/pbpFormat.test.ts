import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

const lineup: sim.FormatLineup = {
  home: ['Smith', 'Jones', 'Lee', 'Brown', 'Park', 'Davis'],
  away: ['Adams', 'Baker', 'Cole', 'Diaz', 'Evans', 'Frye'],
  homeTeamName: 'Nebraska',
  awayTeamName: 'Wisconsin',
};

describe('formatRallyEvent', () => {
  it('serve ace', () => {
    const out = sim.formatRallyEvent(
      { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'ace' },
      lineup,
    );
    expect(out).toContain('Smith');
    expect(out).toContain('Nebraska');
    expect(out).toContain('ACE');
  });

  it('serve in_play', () => {
    const out = sim.formatRallyEvent(
      { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'in_play', inPlayGrade: 2 },
      lineup,
    );
    expect(out).toContain('serves');
    expect(out).not.toContain('ACE');
  });

  it('reception error', () => {
    const out = sim.formatRallyEvent(
      { kind: 'reception', tick: 1, team: 'away', receiver: 4, grade: 0 },
      lineup,
    );
    expect(out).toContain('Evans');
    expect(out.toLowerCase()).toContain('error');
  });

  it('attack kill includes player name and team', () => {
    const out = sim.formatRallyEvent(
      { kind: 'attack', tick: 5, team: 'away', attacker: 1, outcome: 'kill' },
      lineup,
    );
    expect(out).toContain('Baker');
    expect(out).toContain('Wisconsin');
    expect(out).toContain('KILL');
  });

  it('attack blocked', () => {
    const out = sim.formatRallyEvent(
      { kind: 'attack', tick: 5, team: 'away', attacker: 1, outcome: 'blocked' },
      lineup,
    );
    expect(out.toLowerCase()).toContain('block');
  });

  it('dig produces a name + verb', () => {
    const out = sim.formatRallyEvent(
      { kind: 'dig', tick: 6, team: 'home', digger: 5, grade: 2 },
      lineup,
    );
    expect(out).toContain('Davis');
    expect(out.toLowerCase()).toContain('dig');
  });

  it('set quality affects output', () => {
    const perfect = sim.formatRallyEvent(
      { kind: 'set', tick: 3, team: 'home', setter: 0, quality: 'perfect' },
      lineup,
    );
    const bad = sim.formatRallyEvent(
      { kind: 'set', tick: 3, team: 'home', setter: 0, quality: 'bad' },
      lineup,
    );
    expect(perfect.toLowerCase()).toContain('perfect');
    expect(bad.toLowerCase()).toContain('bad');
  });

  it('point includes winner team and reason', () => {
    const out = sim.formatRallyEvent(
      { kind: 'point', tick: 8, winner: 'home', reason: 'kill' },
      lineup,
    );
    expect(out).toContain('Nebraska');
    expect(out.toLowerCase()).toContain('kill');
  });

  it('falls back to slot label when player name missing', () => {
    const sparseLineup: sim.FormatLineup = {
      home: ['Smith'],
      away: [],
      homeTeamName: 'Nebraska',
      awayTeamName: 'Wisconsin',
    };
    const out = sim.formatRallyEvent(
      { kind: 'attack', tick: 0, team: 'away', attacker: 3, outcome: 'kill' },
      sparseLineup,
    );
    expect(out).toContain('#3');
  });
});
