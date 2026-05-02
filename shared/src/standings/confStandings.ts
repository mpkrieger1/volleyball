// Sprint 11: per-conference standings used to seed conference tournaments.
//
// Tiebreaks (in order):
//   1. Conference win % (desc)
//   2. Head-to-head record between the tied teams (desc)
//   3. Overall win % (desc)
//   4. teamId ascending (deterministic final tiebreak)

export type StandingsMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerId: string;
  isConference: boolean;
};

export type StandingsTeam = {
  id: string;
  conferenceId: string;
};

export type TeamStanding = {
  teamId: string;
  conferenceId: string;
  confWins: number;
  confLosses: number;
  confWinPct: number; // 0..1, 3 decimals
  overallWins: number;
  overallLosses: number;
  overallWinPct: number;
  /** Rank within the conference, 1-based. */
  rank: number;
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function computeConferenceStandings(
  matches: StandingsMatch[],
  teams: StandingsTeam[],
): Map<string, TeamStanding[]> {
  // Per-team aggregates.
  const agg = new Map<
    string,
    { teamId: string; confId: string; cw: number; cl: number; ow: number; ol: number }
  >();
  for (const t of teams) {
    agg.set(t.id, { teamId: t.id, confId: t.conferenceId, cw: 0, cl: 0, ow: 0, ol: 0 });
  }
  for (const m of matches) {
    const home = agg.get(m.homeTeamId);
    const away = agg.get(m.awayTeamId);
    if (!home || !away) continue;
    const homeWon = m.winnerId === m.homeTeamId;
    if (homeWon) {
      home.ow += 1;
      away.ol += 1;
      if (m.isConference) {
        home.cw += 1;
        away.cl += 1;
      }
    } else {
      away.ow += 1;
      home.ol += 1;
      if (m.isConference) {
        away.cw += 1;
        home.cl += 1;
      }
    }
  }

  // Head-to-head lookup: Map<aId|bId (sorted), { aWins, bWins }> where a < b.
  const h2hKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const h2h = new Map<string, { left: string; leftWins: number; rightWins: number }>();
  for (const m of matches) {
    if (!m.isConference) continue;
    const left = m.homeTeamId < m.awayTeamId ? m.homeTeamId : m.awayTeamId;
    const right = m.homeTeamId < m.awayTeamId ? m.awayTeamId : m.homeTeamId;
    const key = h2hKey(left, right);
    let rec = h2h.get(key);
    if (!rec) {
      rec = { left, leftWins: 0, rightWins: 0 };
      h2h.set(key, rec);
    }
    if (m.winnerId === left) rec.leftWins += 1;
    else rec.rightWins += 1;
  }

  const teamsByConf = new Map<string, typeof agg extends Map<string, infer V> ? V[] : never>();
  for (const row of agg.values()) {
    let list = teamsByConf.get(row.confId);
    if (!list) {
      list = [];
      teamsByConf.set(row.confId, list);
    }
    list.push(row);
  }

  const out = new Map<string, TeamStanding[]>();
  for (const [confId, rows] of teamsByConf) {
    // Sort by conf%, then h2h pairwise comparator, then overall%, then teamId.
    const sorted = rows.slice().sort((a, b) => {
      const ag = a.cw + a.cl;
      const bg = b.cw + b.cl;
      const apct = ag > 0 ? a.cw / ag : 0;
      const bpct = bg > 0 ? b.cw / bg : 0;
      if (apct !== bpct) return bpct - apct;
      // Head-to-head between a and b.
      const rec = h2h.get(h2hKey(a.teamId, b.teamId));
      if (rec) {
        const aWins = rec.left === a.teamId ? rec.leftWins : rec.rightWins;
        const bWins = rec.left === b.teamId ? rec.leftWins : rec.rightWins;
        if (aWins !== bWins) return bWins - aWins;
      }
      const aog = a.ow + a.ol;
      const bog = b.ow + b.ol;
      const aop = aog > 0 ? a.ow / aog : 0;
      const bop = bog > 0 ? b.ow / bog : 0;
      if (aop !== bop) return bop - aop;
      return a.teamId.localeCompare(b.teamId);
    });

    const standings: TeamStanding[] = sorted.map((r, i) => {
      const cg = r.cw + r.cl;
      const og = r.ow + r.ol;
      return {
        teamId: r.teamId,
        conferenceId: r.confId,
        confWins: r.cw,
        confLosses: r.cl,
        confWinPct: cg > 0 ? round3(r.cw / cg) : 0,
        overallWins: r.ow,
        overallLosses: r.ol,
        overallWinPct: og > 0 ? round3(r.ow / og) : 0,
        rank: i + 1,
      };
    });
    out.set(confId, standings);
  }
  return out;
}
