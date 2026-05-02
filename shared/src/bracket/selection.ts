// Selection committee: 32 auto-bids + 32 at-larges.
//
// Rules (Sprint 10):
//   1. Every `autoBidEligible` conference's top metric-ranked team gets a bid.
//   2. If auto-bids > 32, we still award them all (PRD requires every
//      conference tournament winner gets in); the at-large pool shrinks.
//   3. At-large candidates must have winPct >= minAtLargeWinPct (default .500)
//      AND not already hold an auto-bid.
//   4. Cap at-large count per conference to `maxAtLargePerConference`
//      (default 10) to avoid one mega-conference dominating the field.
//   5. Fill at-larges in metric-rank order until 64 total.

import type { ConferenceRow, TeamRow } from './types';
import type { AutoBidResult } from './autoBids';

export type SelectionOptions = {
  fieldSize?: number; // default 64
  minAtLargeWinPct?: number; // default 0.500
  maxAtLargePerConference?: number; // default 10
};

export type TeamMetricInput = {
  teamId: string;
  wins: number;
  losses: number;
  /** metric-based rank, 1 = best. */
  metricRank: number;
};

export type SelectedTeam = {
  teamId: string;
  autoBid: boolean;
  metricRank: number;
  conferenceId: string;
};

export function selectField(
  teams: TeamRow[],
  _conferences: ConferenceRow[],
  metrics: TeamMetricInput[],
  autoBids: AutoBidResult[],
  opts: SelectionOptions = {},
): SelectedTeam[] {
  const fieldSize = opts.fieldSize ?? 64;
  const minWP = opts.minAtLargeWinPct ?? 0.5;
  const maxPerConf = opts.maxAtLargePerConference ?? 10;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const metricById = new Map(metrics.map((m) => [m.teamId, m]));
  const autoBidIds = new Set(autoBids.map((a) => a.teamId));

  const selected: SelectedTeam[] = [];
  const selectedByConf = new Map<string, number>();
  const bump = (cid: string) => selectedByConf.set(cid, (selectedByConf.get(cid) ?? 0) + 1);

  // 1) seat every auto-bid first.
  for (const ab of autoBids) {
    const team = teamById.get(ab.teamId);
    const m = metricById.get(ab.teamId);
    if (!team || !m) continue;
    selected.push({ teamId: ab.teamId, autoBid: true, metricRank: m.metricRank, conferenceId: team.conferenceId });
    bump(team.conferenceId);
  }

  // 2) at-large candidates sorted by metric rank.
  const candidates = metrics
    .filter((m) => !autoBidIds.has(m.teamId))
    .filter((m) => (m.wins + m.losses > 0 ? m.wins / (m.wins + m.losses) >= minWP : false))
    .slice()
    .sort((a, b) => a.metricRank - b.metricRank);

  for (const cand of candidates) {
    if (selected.length >= fieldSize) break;
    const team = teamById.get(cand.teamId);
    if (!team) continue;
    if ((selectedByConf.get(team.conferenceId) ?? 0) >= maxPerConf) continue;
    selected.push({
      teamId: cand.teamId,
      autoBid: false,
      metricRank: cand.metricRank,
      conferenceId: team.conferenceId,
    });
    bump(team.conferenceId);
  }

  // Final sort: by metric rank asc (best first). Stable tie-break by teamId.
  selected.sort((a, b) => a.metricRank - b.metricRank || a.teamId.localeCompare(b.teamId));
  return selected;
}
