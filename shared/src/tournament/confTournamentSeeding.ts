// Sprint 11: seed conference tournament brackets from regular-season standings.
//
// Bracket shape by conference size:
//   >= 8 teams: 8-team bracket. First round = CT_R1 (4 matches).
//   4–7 teams: 4-team bracket using top 4 seeds. First round = CT_SF (2 matches).
//   2–3 teams: 2-team bracket using top 2 seeds. First round = CT_F (1 match).
//   <2 teams: no tournament (returns empty pairings).
//
// Slot ordering within R1/SF (so winner-pairing into the next round is
// deterministic): matches 2i and 2i+1 pair to form next round's match i.
//
// 8-team R1 order (bracket positions):
//   slot 0: seed 1 vs seed 8
//   slot 1: seed 4 vs seed 5    ← winners of 0 and 1 pair into SF slot 0
//   slot 2: seed 3 vs seed 6
//   slot 3: seed 2 vs seed 7    ← winners of 2 and 3 pair into SF slot 1
//
// 4-team SF order:
//   slot 0: seed 1 vs seed 4
//   slot 1: seed 2 vs seed 3    ← winners pair into F
//
// 2-team F:
//   slot 0: seed 1 vs seed 2

import type { TournamentRound } from './rounds';

export type StandingsLike = { teamId: string; rank: number };

export type CtFirstRoundPairing = {
  conferenceId: string;
  round: TournamentRound; // CT_R1 | CT_SF | CT_F (first real round of that conf's bracket)
  bracketSlot: number;
  higherSeed: number;
  higherSeedTeamId: string;
  lowerSeed: number;
  lowerSeedTeamId: string;
};

export function buildConfFirstRoundPairings(
  conferenceId: string,
  standings: StandingsLike[],
): CtFirstRoundPairing[] {
  const sorted = standings.slice().sort((a, b) => a.rank - b.rank);
  const n = sorted.length;
  if (n < 2) return [];

  const mk = (
    round: TournamentRound,
    slot: number,
    hiSeed: number,
    loSeed: number,
  ): CtFirstRoundPairing => ({
    conferenceId,
    round,
    bracketSlot: slot,
    higherSeed: hiSeed,
    higherSeedTeamId: sorted[hiSeed - 1]!.teamId,
    lowerSeed: loSeed,
    lowerSeedTeamId: sorted[loSeed - 1]!.teamId,
  });

  if (n >= 8) {
    return [
      mk('CT_R1', 0, 1, 8),
      mk('CT_R1', 1, 4, 5),
      mk('CT_R1', 2, 3, 6),
      mk('CT_R1', 3, 2, 7),
    ];
  }
  if (n >= 4) {
    return [mk('CT_SF', 0, 1, 4), mk('CT_SF', 1, 2, 3)];
  }
  return [mk('CT_F', 0, 1, 2)];
}
