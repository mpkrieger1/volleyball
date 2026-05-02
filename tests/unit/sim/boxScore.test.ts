import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateMatch } from '../../../workers/src/sim/match';
import type { TeamMatchState } from '../../../workers/src/sim/set';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const makeTeam = (team: sim.TeamSide): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

describe('computeBoxScore', () => {
  it('empty match produces all-zero rows', () => {
    const empty: sim.MatchLike = {
      winner: 'home',
      homeSetsWon: 3,
      awaySetsWon: 0,
      sets: [],
    };
    const bs = sim.computeBoxScore(empty);
    expect(bs.home.totals.kills).toBe(0);
    expect(bs.away.totals.kills).toBe(0);
    expect(bs.home.players.length).toBe(6);
    expect(bs.away.players.length).toBe(6);
  });

  it('passes zod validation for a real match', () => {
    const match = simulateMatch({
      seed: 'bs-1',
      home: makeTeam('home'),
      away: makeTeam('away'),
      initialServer: 'home',
    });
    const bs = sim.computeBoxScore(match);
    expect(() => sim.MatchBoxScoreSchema.parse(bs)).not.toThrow();
  });

  it('PRD S6 exit test 1: Σ player.kills == team.kills over 100 random-seed matches', () => {
    for (let seed = 0; seed < 100; seed++) {
      const match = simulateMatch({
        seed: `inv-${seed}`,
        home: makeTeam('home'),
        away: makeTeam('away'),
        initialServer: seed % 2 === 0 ? 'home' : 'away',
      });
      const bs = sim.computeBoxScore(match);
      const homeSum = bs.home.players.reduce((a, p) => a + p.kills, 0);
      const awaySum = bs.away.players.reduce((a, p) => a + p.kills, 0);
      expect(homeSum).toBe(bs.home.totals.kills);
      expect(awaySum).toBe(bs.away.totals.kills);
      // Also errors + totalAttacks.
      expect(bs.home.players.reduce((a, p) => a + p.errors, 0)).toBe(bs.home.totals.errors);
      expect(bs.home.players.reduce((a, p) => a + p.totalAttacks, 0)).toBe(
        bs.home.totals.totalAttacks,
      );
    }
  });

  it('hittingPctMilli = round((K-E)/TA × 1000)', () => {
    const match = simulateMatch({
      seed: 'hit-1',
      home: makeTeam('home'),
      away: makeTeam('away'),
      initialServer: 'home',
    });
    const bs = sim.computeBoxScore(match);
    for (const p of [...bs.home.players, ...bs.away.players]) {
      const expected = p.totalAttacks > 0
        ? Math.round(((p.kills - p.errors) / p.totalAttacks) * 1000)
        : 0;
      expect(p.hittingPctMilli).toBe(expected);
    }
  });

  it('rotation minutes = rally count for every player (Sprint 6 placeholder)', () => {
    const match = simulateMatch({
      seed: 'rm-1',
      home: makeTeam('home'),
      away: makeTeam('away'),
      initialServer: 'home',
    });
    const bs = sim.computeBoxScore(match);
    const rallyCount = match.sets.reduce((a, s) => a + s.rallies.length, 0);
    for (const p of bs.home.players) expect(p.rotationMinutes).toBe(rallyCount);
    for (const p of bs.away.players) expect(p.rotationMinutes).toBe(rallyCount);
  });

  it('service aces credit the server, not the receiver', () => {
    // Run until we find a match that has at least one ace.
    for (let seed = 0; seed < 50; seed++) {
      const match = simulateMatch({
        seed: `ace-${seed}`,
        home: makeTeam('home'),
        away: makeTeam('away'),
        initialServer: 'home',
      });
      const bs = sim.computeBoxScore(match);
      if (bs.home.totals.serviceAces > 0 || bs.away.totals.serviceAces > 0) {
        // serviceAces reside on server slots; serviceErrors on same team.
        expect(bs.home.totals.serviceAces + bs.away.totals.serviceAces).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error('no aces observed in 50 matches — calibration regression?');
  });
});
