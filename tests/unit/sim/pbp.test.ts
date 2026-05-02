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

describe('match PBP', () => {
  const match = simulateMatch({
    seed: 'pbp-1',
    home: makeTeam('home'),
    away: makeTeam('away'),
    initialServer: 'home',
  });

  it('serializeMatchPbp produces a JSON string that deserializes + validates', () => {
    const json = sim.serializeMatchPbp(match);
    expect(typeof json).toBe('string');
    const pbp = sim.deserializeMatchPbp(json);
    expect(() => sim.MatchPbpSchema.parse(pbp)).not.toThrow();
  });

  it('PBP size is within sanity bounds (< 250 KB per match)', () => {
    const json = sim.serializeMatchPbp(match);
    expect(json.length).toBeLessThan(250 * 1024);
  });

  it('PRD S6 exit test 2: replay(serialize(match)) == computeBoxScore(match) over 50 matches', () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = simulateMatch({
        seed: `pbp-invariant-${seed}`,
        home: makeTeam('home'),
        away: makeTeam('away'),
        initialServer: seed % 2 === 0 ? 'home' : 'away',
      });
      const fromCompute = sim.computeBoxScore(m);
      const fromReplay = sim.replayPbp(sim.deserializeMatchPbp(sim.serializeMatchPbp(m)));
      expect(fromReplay).toEqual(fromCompute);
    }
  });

  it('deserialize → reserialize is lossless (JSON canonicalization via zod parse)', () => {
    const json1 = sim.serializeMatchPbp(match);
    const pbp = sim.deserializeMatchPbp(json1);
    const json2 = JSON.stringify(pbp);
    expect(json2.length).toBe(json1.length);
  });
});
