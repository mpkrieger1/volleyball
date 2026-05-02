// Per-voter ballot: rank the top-25 teams by the voter's scoring function.

import type { TeamMetrics } from './teamMetrics';
import type { VoterProfile } from './voter';
import { voterTeamJitter } from './voter';

export type BallotInputTeam = {
  id: string;
  abbr: string;
  prestige: number; // 0..100
  conferenceId: string;
};

/** Exactly 25 teamIds, ordered 1st → 25th. */
export type Ballot = string[];

export const BALLOT_SIZE = 25;

export function generateBallot(
  voter: VoterProfile,
  metrics: Map<string, TeamMetrics>,
  teams: BallotInputTeam[],
): Ballot {
  // Score each team with metrics. Teams with 0 games get 0 score + tiny
  // prestige floor so they don't all tie.
  const scored: Array<{ id: string; abbr: string; score: number }> = teams.map((t) => {
    const m = metrics.get(t.id);
    const winPct = m?.winPct ?? 0;
    const oppPct = m?.opponentWinPct ?? 0;
    const last3Rate = m ? m.last3Wins / Math.max(1, m.last3Wins + m.last3Losses) : 0;
    const bluebloodBonus = (t.prestige / 100) * voter.bluebloodWeight;
    const confLoyaltyBonus =
      t.conferenceId === voter.homeConferenceId ? voter.conferenceLoyalty : 0;
    const jitter = voterTeamJitter(voter, t.id);
    const score =
      0.55 * winPct +
      0.25 * oppPct +
      voter.recencyWeight * last3Rate +
      bluebloodBonus +
      confLoyaltyBonus +
      jitter;
    return { id: t.id, abbr: t.abbr, score };
  });

  // Sort: score desc, tie-break by abbr asc for determinism.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.abbr.localeCompare(b.abbr);
  });

  return scored.slice(0, BALLOT_SIZE).map((t) => t.id);
}
