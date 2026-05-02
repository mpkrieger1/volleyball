// Pure team-metrics aggregator. Takes a list of played matches (winnerId set)
// and emits per-team records suitable for the voter model and the Sprint 9
// "realistic top 5" reference ranker. No SOS or RPI — that's Sprint 10.

export type PlayedMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerId: string;
  date: Date;
};

export type TeamMetrics = {
  teamId: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  /** wins / gamesPlayed, or 0 when no games. Rounded to 3 decimals. */
  winPct: number;
  /** wins in the 3 most recent matches by date (0..3). */
  last3Wins: number;
  /** losses in the 3 most recent matches by date (0..3). */
  last3Losses: number;
  /** Mean winPct of all unique opponents. 0 when no opponents. */
  opponentWinPct: number;
  /** Opponent teamIds (unique), for downstream upset detection. */
  opponentIds: string[];
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function computeTeamMetrics(
  matches: PlayedMatch[],
  teamIds: string[],
): Map<string, TeamMetrics> {
  // Per-team match lists (ordered by date ascending).
  const byTeam = new Map<string, PlayedMatch[]>();
  for (const id of teamIds) byTeam.set(id, []);
  for (const m of matches) {
    byTeam.get(m.homeTeamId)?.push(m);
    byTeam.get(m.awayTeamId)?.push(m);
  }
  for (const list of byTeam.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // First pass: wins/losses + last3 from the trailing 3 matches.
  const firstPass = new Map<string, Omit<TeamMetrics, 'opponentWinPct'>>();
  for (const [id, list] of byTeam) {
    let wins = 0;
    let losses = 0;
    const opponents = new Set<string>();
    for (const m of list) {
      const won = m.winnerId === id;
      if (won) wins += 1;
      else losses += 1;
      const opp = m.homeTeamId === id ? m.awayTeamId : m.homeTeamId;
      opponents.add(opp);
    }
    const gamesPlayed = wins + losses;
    const last3 = list.slice(-3);
    let last3Wins = 0;
    let last3Losses = 0;
    for (const m of last3) {
      if (m.winnerId === id) last3Wins += 1;
      else last3Losses += 1;
    }
    firstPass.set(id, {
      teamId: id,
      wins,
      losses,
      gamesPlayed,
      winPct: gamesPlayed > 0 ? round3(wins / gamesPlayed) : 0,
      last3Wins,
      last3Losses,
      opponentIds: [...opponents],
    });
  }

  // Second pass: opponentWinPct using first-pass winPcts.
  const out = new Map<string, TeamMetrics>();
  for (const [id, base] of firstPass) {
    const oppPcts = base.opponentIds
      .map((oid) => firstPass.get(oid)?.winPct ?? 0);
    const opponentWinPct =
      oppPcts.length > 0 ? round3(oppPcts.reduce((a, b) => a + b, 0) / oppPcts.length) : 0;
    out.set(id, { ...base, opponentWinPct });
  }
  return out;
}
