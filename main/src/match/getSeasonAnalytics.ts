// Sprint 28: season-level analytics aggregator.
//
// Reads PlayerMatchStat + Match for a single team-season, computes:
//   - team summary (W-L, sets, hitting %, opp hitting %, totals)
//   - per-match trend (one row per played match — for line charts)
//   - per-player season totals (sortable leaderboard)
//
// Hitting % uses the volume-weighted formula from CLAUDE.md "From
// Sprint 22": (Σkills − Σerrors) / ΣtotalAttacks.

import { PrismaClient } from '@prisma/client';
import { stats } from '@vcd/shared';

export type SeasonAnalyticsInput = {
  dbPath: string;
  teamId: string;
};

export type SeasonAnalyticsResult = {
  team: {
    teamId: string;
    teamAbbr: string;
    teamSchool: string;
    seasonYear: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
    teamHittingPctMilli: number;
    oppHittingPctMilli: number;
    totalKills: number;
    totalAces: number;
    totalBlocks: number;
    totalDigs: number;
  };
  trend: Array<{
    matchId: string;
    weekIndex: number;
    isoDate: string;
    opponentAbbr: string;
    isHome: boolean;
    setsWon: number;
    setsLost: number;
    hittingPctMilli: number;
    oppHittingPctMilli: number;
    kills: number;
    oppKills: number;
  }>;
  players: Array<{
    playerId: string;
    playerName: string;
    position: string;
    setsPlayed: number;
    matchesPlayed: number;
    kills: number;
    errors: number;
    totalAttacks: number;
    hittingPctMilli: number;
    killsPerSetMilli: number;
    digs: number;
    blocks: number;
    aces: number;
    assists: number;
  }>;
};

export async function getSeasonAnalytics(
  input: SeasonAnalyticsInput,
): Promise<SeasonAnalyticsResult | { error: 'NOT_FOUND'; message: string }> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const team = await client.team.findUnique({ where: { id: input.teamId } });
    if (!team) return { error: 'NOT_FOUND', message: `team ${input.teamId} not found` };

    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    const seasonYear = season?.year ?? new Date().getFullYear();
    const yearStart = new Date(`${seasonYear}-08-01T00:00:00Z`);
    const yearEnd = new Date(`${seasonYear + 1}-08-01T00:00:00Z`);

    const matches = await client.match.findMany({
      where: {
        OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
        winnerId: { not: null },
        date: { gte: yearStart, lt: yearEnd },
      },
      orderBy: { date: 'asc' },
      include: {
        sets: { select: { home: true, away: true } },
      },
    });

    const opponentIds = new Set<string>();
    for (const m of matches) {
      opponentIds.add(m.homeTeamId === input.teamId ? m.awayTeamId : m.homeTeamId);
    }
    const opponents = await client.team.findMany({
      where: { id: { in: [...opponentIds] } },
      select: { id: true, abbr: true },
    });
    const oppAbbr = new Map(opponents.map((o) => [o.id, o.abbr]));

    const players = await client.player.findMany({
      where: { teamId: input.teamId },
      select: { id: true, firstName: true, lastName: true, position: true },
    });
    const playerInfo = new Map(
      players.map((p) => [
        p.id,
        { name: `${p.firstName} ${p.lastName}`, position: p.position },
      ]),
    );
    const matchIds = matches.map((m) => m.id);
    const allPms =
      matchIds.length === 0
        ? []
        : await client.playerMatchStat.findMany({
            where: {
              matchId: { in: matchIds },
              playerId: { in: players.map((p) => p.id) },
            },
          });

    // Per-player aggregation.
    const playerRows = new Map<
      string,
      {
        rows: Array<{
          kills: number;
          errors: number;
          totalAttacks: number;
          digs: number;
          blockSolos: number;
          blockAssists: number;
          serviceAces: number;
          assists: number;
          rotationMinutes: number;
        }>;
      }
    >();
    for (const s of allPms) {
      const arr = playerRows.get(s.playerId)?.rows ?? [];
      arr.push({
        kills: s.kills,
        errors: s.errors,
        totalAttacks: s.totalAttacks,
        digs: s.digs,
        blockSolos: s.blockSolos,
        blockAssists: s.blockAssists,
        serviceAces: s.serviceAces,
        assists: s.assists,
        rotationMinutes: s.rotationMinutes,
      });
      playerRows.set(s.playerId, { rows: arr });
    }
    const playersOut: SeasonAnalyticsResult['players'] = [];
    for (const [playerId, { rows }] of playerRows) {
      const info = playerInfo.get(playerId);
      if (!info) continue;
      const agg = stats.aggregateStats(rows);
      const killsPerSet = agg.setsPlayed > 0 ? agg.kills / agg.setsPlayed : 0;
      playersOut.push({
        playerId,
        playerName: info.name,
        position: info.position,
        setsPlayed: agg.setsPlayed,
        matchesPlayed: agg.matchesPlayed,
        kills: agg.kills,
        errors: agg.errors,
        totalAttacks: agg.totalAttacks,
        hittingPctMilli: agg.hittingPctMilli,
        killsPerSetMilli: Math.round(killsPerSet * 1000),
        digs: agg.digs,
        blocks: agg.blocks,
        aces: agg.aces,
        assists: agg.assists,
      });
    }
    playersOut.sort((a, b) => b.kills - a.kills || a.playerName.localeCompare(b.playerName));

    // Per-match trend + team aggregates.
    let wins = 0;
    let losses = 0;
    let setsWon = 0;
    let setsLost = 0;
    let totalKills = 0;
    let totalAces = 0;
    let totalBlocks = 0;
    let totalDigs = 0;
    let teamKillsAgg = 0;
    let teamErrorsAgg = 0;
    let teamAttacksAgg = 0;
    let oppKillsAgg = 0;
    let oppErrorsAgg = 0;
    let oppAttacksAgg = 0;
    const trend: SeasonAnalyticsResult['trend'] = [];

    for (const m of matches) {
      const isHome = m.homeTeamId === input.teamId;
      const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
      let mySets = 0;
      let oppSets = 0;
      for (const s of m.sets) {
        if (isHome) {
          if (s.home > s.away) mySets += 1;
          else oppSets += 1;
        } else {
          if (s.away > s.home) mySets += 1;
          else oppSets += 1;
        }
      }
      setsWon += mySets;
      setsLost += oppSets;
      const won = m.winnerId === input.teamId;
      if (won) wins += 1;
      else losses += 1;

      const box = parseBoxScore(m.boxScoreJson);
      const my = isHome ? box.home : box.away;
      const opp = isHome ? box.away : box.home;

      teamKillsAgg += my.kills;
      teamErrorsAgg += my.errors;
      teamAttacksAgg += my.totalAttacks;
      oppKillsAgg += opp.kills;
      oppErrorsAgg += opp.errors;
      oppAttacksAgg += opp.totalAttacks;

      totalKills += my.kills;
      totalAces += my.serviceAces;
      totalBlocks += my.blockSolos + Math.round(my.blockAssists / 2);
      totalDigs += my.digs;

      const matchHit = my.totalAttacks > 0 ? (my.kills - my.errors) / my.totalAttacks : 0;
      const oppHit = opp.totalAttacks > 0 ? (opp.kills - opp.errors) / opp.totalAttacks : 0;

      trend.push({
        matchId: m.id,
        weekIndex: m.week,
        isoDate: m.date.toISOString().slice(0, 10),
        opponentAbbr: oppAbbr.get(opponentId) ?? '???',
        isHome,
        setsWon: mySets,
        setsLost: oppSets,
        hittingPctMilli: Math.round(matchHit * 1000),
        oppHittingPctMilli: Math.round(oppHit * 1000),
        kills: my.kills,
        oppKills: opp.kills,
      });
    }

    const teamHit = teamAttacksAgg > 0 ? (teamKillsAgg - teamErrorsAgg) / teamAttacksAgg : 0;
    const oppHit = oppAttacksAgg > 0 ? (oppKillsAgg - oppErrorsAgg) / oppAttacksAgg : 0;

    return {
      team: {
        teamId: team.id,
        teamAbbr: team.abbr,
        teamSchool: team.schoolName,
        seasonYear,
        matchesPlayed: matches.length,
        wins,
        losses,
        setsWon,
        setsLost,
        teamHittingPctMilli: Math.round(teamHit * 1000),
        oppHittingPctMilli: Math.round(oppHit * 1000),
        totalKills,
        totalAces,
        totalBlocks,
        totalDigs,
      },
      trend,
      players: playersOut,
    };
  } finally {
    await client.$disconnect();
  }
}

type BoxStat = {
  kills: number;
  errors: number;
  totalAttacks: number;
  serviceAces: number;
  blockSolos: number;
  blockAssists: number;
  digs: number;
};

function emptyStat(): BoxStat {
  return { kills: 0, errors: 0, totalAttacks: 0, serviceAces: 0, blockSolos: 0, blockAssists: 0, digs: 0 };
}

function parseBoxScore(json: string | null): { home: BoxStat; away: BoxStat } {
  if (!json) return { home: emptyStat(), away: emptyStat() };
  try {
    const parsed = JSON.parse(json) as {
      home?: { teamTotals?: Partial<BoxStat> };
      away?: { teamTotals?: Partial<BoxStat> };
    };
    const home = { ...emptyStat(), ...(parsed.home?.teamTotals ?? {}) };
    const away = { ...emptyStat(), ...(parsed.away?.teamTotals ?? {}) };
    return { home, away };
  } catch {
    return { home: emptyStat(), away: emptyStat() };
  }
}
