// Sprint 22: team-level top-25 aggregator. Volume-weighted (Σ kills /
// Σ totalAttacks per team), NOT mean-of-player-percentages. Libero
// dig/set filtered by `position === 'L'`.

import type { AggregatedSeasonStats } from '../awards/types';

export type TeamSeasonStats = {
  teamId: string;
  pollRank: number;
  hittingPct: number;
  killsPerSet: number;
  liberoDigsPerSet: number;
  blocksPerSet: number;
  assistsPerSet: number;
};

export type Top25Aggregates = {
  topTeams: TeamSeasonStats[];
  averages: {
    hittingPct: number;
    killsPerSet: number;
    liberoDigsPerSet: number;
    blocksPerSet: number;
    assistsPerSet: number;
  };
};

export type Top25AggregateInput = {
  /** Per-player season stats keyed by playerId (Sprint 18 aggregateAllPlayers output). */
  stats: ReadonlyMap<string, AggregatedSeasonStats>;
  playerMeta: ReadonlyMap<string, { teamId: string; position: string; isLibero: boolean }>;
  /** End-of-season poll. teamId + 1..N rank. Aggregator filters to ≤25. */
  pollTop25: readonly { teamId: string; rank: number }[];
};

type TeamAccumulator = {
  teamId: string;
  pollRank: number;
  kills: number;
  errors: number;
  totalAttacks: number;
  setsPlayed: number;
  liberoDigs: number;
  liberoSets: number;
  blocksWeighted: number; // solos + 0.5 × assists
  assists: number;
};

function emptyAccumulator(teamId: string, pollRank: number): TeamAccumulator {
  return {
    teamId,
    pollRank,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    setsPlayed: 0,
    liberoDigs: 0,
    liberoSets: 0,
    blocksWeighted: 0,
    assists: 0,
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function aggregateTop25(input: Top25AggregateInput): Top25Aggregates {
  const top25 = input.pollTop25.slice(0, 25);
  if (top25.length === 0) {
    return {
      topTeams: [],
      averages: {
        hittingPct: 0,
        killsPerSet: 0,
        liberoDigsPerSet: 0,
        blocksPerSet: 0,
        assistsPerSet: 0,
      },
    };
  }

  const acc = new Map<string, TeamAccumulator>();
  for (const t of top25) acc.set(t.teamId, emptyAccumulator(t.teamId, t.rank));

  for (const [playerId, stats] of input.stats) {
    const meta = input.playerMeta.get(playerId);
    if (!meta) continue;
    const a = acc.get(meta.teamId);
    if (!a) continue; // not a top-25 team

    a.kills += stats.kills;
    a.errors += stats.errors;
    a.totalAttacks += stats.totalAttacks;
    a.setsPlayed += stats.setsPlayed;
    a.assists += stats.assists;
    a.blocksWeighted += stats.blockSolos + 0.5 * stats.blockAssists;
    if (meta.isLibero) {
      a.liberoDigs += stats.digs;
      a.liberoSets += stats.setsPlayed;
    }
  }

  const topTeams: TeamSeasonStats[] = [...acc.values()]
    .map((a) => ({
      teamId: a.teamId,
      pollRank: a.pollRank,
      hittingPct: safeRate(a.kills - a.errors, a.totalAttacks),
      killsPerSet: safeRate(a.kills, a.setsPlayed),
      liberoDigsPerSet: safeRate(a.liberoDigs, a.liberoSets),
      blocksPerSet: safeRate(a.blocksWeighted, a.setsPlayed),
      assistsPerSet: safeRate(a.assists, a.setsPlayed),
    }))
    .sort((a, b) => a.pollRank - b.pollRank);

  const n = topTeams.length;
  const sum = (key: keyof Omit<TeamSeasonStats, 'teamId' | 'pollRank'>): number =>
    topTeams.reduce((s, t) => s + t[key], 0);
  return {
    topTeams,
    averages: {
      hittingPct: n > 0 ? sum('hittingPct') / n : 0,
      killsPerSet: n > 0 ? sum('killsPerSet') / n : 0,
      liberoDigsPerSet: n > 0 ? sum('liberoDigsPerSet') / n : 0,
      blocksPerSet: n > 0 ? sum('blocksPerSet') / n : 0,
      assistsPerSet: n > 0 ? sum('assistsPerSet') / n : 0,
    },
  };
}
