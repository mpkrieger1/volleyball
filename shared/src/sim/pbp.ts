// Match PBP (play-by-play) serializer. Walks a MatchResult and emits a zod-
// validated JSON-ready object; replayPbp rebuilds the box score from the
// serialized stream using the SAME event walker as computeBoxScore.
//
// PRD S6 exit test 2: replay(serialize(match)) must equal computeBoxScore(match).

import { z } from 'zod';
import { RallyEvent } from './rallyEvents';
import { TeamSideSchema } from './lineup';
import {
  applyEventsToFrame,
  computeTotals,
  type MatchBoxScore,
  type PlayerBoxScore,
} from './boxScore';

export const SetPbpSchema = z.object({
  setIndex: z.number().int().min(0).max(4),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  rallies: z.array(
    z.object({
      rallyIndex: z.number().int().nonnegative(),
      seed: z.union([z.number().int(), z.string()]),
      servingTeam: TeamSideSchema,
      winningTeam: TeamSideSchema,
      events: z.array(RallyEvent),
    }),
  ),
});
export type SetPbp = z.infer<typeof SetPbpSchema>;

export const MatchPbpSchema = z.object({
  version: z.literal(1),
  winner: TeamSideSchema,
  homeSetsWon: z.number().int().min(0).max(3),
  awaySetsWon: z.number().int().min(0).max(3),
  sets: z.array(SetPbpSchema),
});
export type MatchPbp = z.infer<typeof MatchPbpSchema>;

type MatchResultLike = {
  winner: 'home' | 'away';
  homeSetsWon: number;
  awaySetsWon: number;
  sets: Array<{
    homeScore: number;
    awayScore: number;
    rallies: Array<{
      seed: number | string;
      servingTeam: 'home' | 'away';
      winningTeam: 'home' | 'away';
      events: RallyEvent[];
    }>;
  }>;
};

export function matchToPbp(match: MatchResultLike): MatchPbp {
  return {
    version: 1,
    winner: match.winner,
    homeSetsWon: match.homeSetsWon,
    awaySetsWon: match.awaySetsWon,
    sets: match.sets.map((s, setIndex) => ({
      setIndex,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      rallies: s.rallies.map((r, rallyIndex) => ({
        rallyIndex,
        seed: r.seed,
        servingTeam: r.servingTeam,
        winningTeam: r.winningTeam,
        events: r.events,
      })),
    })),
  };
}

export function serializeMatchPbp(match: MatchResultLike): string {
  const pbp = matchToPbp(match);
  MatchPbpSchema.parse(pbp);
  return JSON.stringify(pbp);
}

export function deserializeMatchPbp(json: string): MatchPbp {
  return MatchPbpSchema.parse(JSON.parse(json));
}

/**
 * Pure replay: given a MatchPbp, recompute the MatchBoxScore by walking
 * every rally's event stream through the same helper computeBoxScore uses.
 */
export function replayPbp(pbp: MatchPbp): MatchBoxScore {
  const home: PlayerBoxScore[] = Array.from({ length: 6 }, (_, i) => emptyRow(i));
  const away: PlayerBoxScore[] = Array.from({ length: 6 }, (_, i) => emptyRow(i));

  let rallyCount = 0;
  for (const s of pbp.sets) {
    for (const rally of s.rallies) {
      applyEventsToFrame(rally.events, home, away);
      rallyCount += 1;
    }
  }

  for (const r of [...home, ...away]) {
    r.rotationMinutes = rallyCount;
    r.hittingPctMilli = r.totalAttacks > 0
      ? Math.round(((r.kills - r.errors) / r.totalAttacks) * 1000)
      : 0;
  }

  return {
    home: { team: 'home', players: home, totals: computeTotals(home) },
    away: { team: 'away', players: away, totals: computeTotals(away) },
    homeSetsWon: pbp.homeSetsWon,
    awaySetsWon: pbp.awaySetsWon,
    winner: pbp.winner,
  };
}

function emptyRow(slotIndex: number): PlayerBoxScore {
  return {
    slotIndex,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    hittingPctMilli: 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 0,
  };
}
