// Conference auto-bid stub. Sprint 11 replaces with actual conference
// tournament results; for Sprint 10 we award the auto-bid to the top
// metric-ranked team in each autoBidEligible conference.

import type { ConferenceRow, TeamRow } from './types';

export type AutoBidResult = {
  /** teamId of the bid winner. */
  teamId: string;
  conferenceId: string;
};

export function selectAutoBids(
  teams: TeamRow[],
  conferences: ConferenceRow[],
  metricRankedTeamIds: string[],
): AutoBidResult[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const rankByTeam = new Map<string, number>();
  metricRankedTeamIds.forEach((id, i) => rankByTeam.set(id, i + 1));

  const out: AutoBidResult[] = [];
  for (const conf of conferences) {
    if (!conf.autoBidEligible) continue;
    const confTeams = teams.filter((t) => t.conferenceId === conf.id);
    if (confTeams.length === 0) continue;
    confTeams.sort((a, b) => {
      const ra = rankByTeam.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rankByTeam.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.id.localeCompare(b.id);
    });
    const winner = confTeams[0];
    if (winner && teamById.has(winner.id)) {
      out.push({ teamId: winner.id, conferenceId: conf.id });
    }
  }
  return out;
}
