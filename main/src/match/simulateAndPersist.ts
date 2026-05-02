// Orchestrates a single-match simulation against an open save-slot DB:
// generate lineups, run simulateMatch, compute box score, serialize PBP, write
// Match + PlayerMatchStat rows in a transaction, return the box score.

import { PrismaClient } from '@prisma/client';
import { sim, perf } from '@vcd/shared';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';
import { simulateMatch, buildMatchTimeline, type TeamMatchState } from '@vcd/workers';
import { lineupFromTeam } from './lineupFromTeam';
import { pickStartersForTeam } from './pickStarters';

export type SimulateAndPersistInput = {
  dbPath: string;
  homeTeamId: string;
  awayTeamId: string;
  seed: number | string;
};

export type SimulateAndPersistResult = {
  matchId: string;
  boxScore: sim.MatchBoxScore;
  pbpChars: number;
};

export class MatchError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_INPUT' | 'IO_ERROR' | 'INTERNAL',
    message: string,
  ) {
    super(message);
  }
}

export async function simulateAndPersistMatch(
  input: SimulateAndPersistInput,
): Promise<SimulateAndPersistResult> {
  if (input.homeTeamId === input.awayTeamId) {
    throw new MatchError('INVALID_INPUT', 'home and away teams must differ');
  }

  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [home, away, homeStarterIds, awayStarterIds] = await Promise.all([
      client.team.findUnique({ where: { id: input.homeTeamId } }),
      client.team.findUnique({ where: { id: input.awayTeamId } }),
      pickStartersForTeam(client, input.homeTeamId),
      pickStartersForTeam(client, input.awayTeamId),
    ]);
    if (!home || !away) throw new MatchError('NOT_FOUND', 'team(s) not found in slot DB');

    const homeLineup = lineupFromTeam(home, input.seed, 'home');
    const awayLineup = lineupFromTeam(away, input.seed, 'away');
    const homeTeam: TeamMatchState = {
      lineup: homeLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
    };
    const awayTeam: TeamMatchState = {
      lineup: awayLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
    };

    const match = simulateMatch({
      seed: input.seed,
      home: homeTeam,
      away: awayTeam,
      initialServer: 'home',
      useCoachAi: true,
    });

    const boxScore = sim.computeBoxScore(match);
    const pbp = sim.matchToPbp(match);
    const { payload: pbpJson, encoding: pbpEncoding } = pbpCodec.encodePbp(pbp);
    const timeline = buildMatchTimeline(match);

    const winnerId = match.winner === 'home' ? home.id : away.id;
    const result = await perf.recordPerfAsync('simulateAndPersist:dbWrite', () =>
      client.$transaction(async (tx) => {
        const matchRow = await tx.match.create({
          data: {
            homeTeamId: home.id,
            awayTeamId: away.id,
            date: new Date(),
            week: 0,
            isConference: false,
            isTournament: false,
            winnerId,
            pbpJson,
            pbpEncoding,
            boxScoreJson: JSON.stringify(boxScore),
            timelineJson: JSON.stringify(timeline),
          },
        });

        // Write a per-set row.
        for (let i = 0; i < match.sets.length; i++) {
          const s = match.sets[i]!;
          await tx.set.create({
            data: {
              matchId: matchRow.id,
              index: i,
              home: s.homeScore,
              away: s.awayScore,
              durationSec: s.rallies.length * 20, // ~20s/rally estimate; Sprint 19 replaces
            },
          });
        }

        // Sprint 18: persist per-player stat rows. `homeStarterIds`/`awayStarterIds`
        // map slotIndex (0..5) → real Player.id; the box score is slot-keyed.
        await tx.playerMatchStat.createMany({
          data: sim.buildPlayerMatchStatRows({
            matchId: matchRow.id,
            homePlayerIds: homeStarterIds,
            awayPlayerIds: awayStarterIds,
            boxScore,
          }),
        });
        return matchRow;
      }),
    );

    return { matchId: result.id, boxScore, pbpChars: pbpJson.length };
  } finally {
    await client.$disconnect();
  }
}
