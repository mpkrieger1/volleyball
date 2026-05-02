// Sprint 19: load a stored match's full replay payload by id.
// Used by the Match Hub ticker to play back a match the user already
// simulated (or that was played as part of a season advance).

import type { Prisma, PrismaClient } from '@prisma/client';
import { sim, matchIpc } from '@vcd/shared';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';
import { pickStartersForTeam } from './pickStarters';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type GetMatchByIdResult =
  | { ok: true; payload: matchIpc.GetMatchByIdResponse extends infer T ? Extract<T, { ok: true }> : never }
  | { ok: false; code: 'NOT_FOUND' | 'INTERNAL'; message: string };

async function lineupSlotsFor(client: ClientLike, teamId: string): Promise<string[]> {
  const ids = await pickStartersForTeam(client, teamId);
  const players = await client.player.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`] as const));
  return ids.map((id) => nameById.get(id) ?? id);
}

export async function getMatchById(
  client: ClientLike,
  matchId: string,
): Promise<GetMatchByIdResult> {
  const row = await client.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      sets: { orderBy: { index: 'asc' } },
    },
  });
  if (!row) {
    return { ok: false, code: 'NOT_FOUND', message: `match ${matchId} not found` };
  }
  if (!row.boxScoreJson || !row.pbpJson) {
    return { ok: false, code: 'NOT_FOUND', message: `match ${matchId} has no PBP / box score` };
  }

  const boxScore = sim.MatchBoxScoreSchema.parse(JSON.parse(row.boxScoreJson));
  // Sprint 23: PBP may be gzip-base64 (default for new rows) or legacy 'json'.
  // Pruned rows are surfaced as NOT_FOUND for the replay path; box-score-only
  // callers should use a different IPC.
  let pbp;
  try {
    pbp = pbpCodec.decodePbp(row.pbpJson, row.pbpEncoding);
  } catch (err) {
    if (err instanceof pbpCodec.PbpUnavailableError) {
      return { ok: false, code: 'NOT_FOUND', message: `match ${matchId} PBP unavailable (pruned)` };
    }
    throw err;
  }
  const timeline = row.timelineJson
    ? sim.MatchTimelineSchema.parse(JSON.parse(row.timelineJson))
    : sim.EMPTY_MATCH_TIMELINE;

  const [homeSlots, awaySlots] = await Promise.all([
    lineupSlotsFor(client, row.homeTeamId),
    lineupSlotsFor(client, row.awayTeamId),
  ]);

  return {
    ok: true,
    payload: {
      ok: true,
      match: {
        id: row.id,
        date: row.date.toISOString(),
        week: row.week,
        isTournament: row.isTournament,
        tournamentRound: row.tournamentRound,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        winnerId: row.winnerId,
        homeSetsWon: pbp.homeSetsWon,
        awaySetsWon: pbp.awaySetsWon,
      },
      home: {
        teamId: row.homeTeam.id,
        teamName: row.homeTeam.schoolName,
        teamAbbr: row.homeTeam.abbr,
        primaryColor: row.homeTeam.primaryColor,
        secondaryColor: row.homeTeam.secondaryColor,
        lineupSlots: homeSlots as [string, string, string, string, string, string],
      },
      away: {
        teamId: row.awayTeam.id,
        teamName: row.awayTeam.schoolName,
        teamAbbr: row.awayTeam.abbr,
        primaryColor: row.awayTeam.primaryColor,
        secondaryColor: row.awayTeam.secondaryColor,
        lineupSlots: awaySlots as [string, string, string, string, string, string],
      },
      boxScore,
      pbp,
      timeline,
      sets: row.sets.map((s) => ({
        index: s.index,
        home: s.home,
        away: s.away,
        durationSec: s.durationSec,
      })),
    },
  };
}
