// advanceWeek: the Sprint 8 core service.
//   1. Load Season row; determine currentWeek.
//   2. Find unplayed Match rows with week === currentWeek.
//   3. Generate lineups; dispatch one WorkerSimRequest per match.
//   4. Collect all responses. Respect cancellation — if cancelled, no DB writes.
//   5. Atomic transaction: update Match rows with winner + pbp + boxScore,
//      create Set rows, bump Season.currentWeek.

import { PrismaClient } from '@prisma/client';
import { sim, perf, type seasonIpc } from '@vcd/shared';
import { lineupFromTeam } from '../match/lineupFromTeam';
import { pickStartersForTeams, type StarterIds } from '../match/pickStarters';
import { SimWorkerPool } from './workerPool';
import { CancellationToken } from './cancellationToken';
import { runPollForWeek } from '../poll/runPollForWeek';

export type AdvanceWeekInput = {
  dbPath: string;
  pool: SimWorkerPool;
  cancellation?: CancellationToken;
  onProgress?: (evt: Omit<seasonIpc.SeasonProgressEvent, 'cancellationId'>) => void;
  seed?: string;
};

export type AdvanceWeekResult =
  | { ok: true; week: number; matchesPlayed: number; elapsedMs: number }
  | { ok: false; code: 'CANCELLED' | 'NOT_FOUND' | 'INTERNAL'; message: string };

export async function advanceWeek(input: AdvanceWeekInput): Promise<AdvanceWeekResult> {
  return perf.recordPerfAsync('advanceWeek', () => advanceWeekImpl(input));
}

async function advanceWeekImpl(input: AdvanceWeekInput): Promise<AdvanceWeekResult> {
  const start = Date.now();
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) {
      return { ok: false, code: 'NOT_FOUND', message: 'No Season row in save DB.' };
    }
    const week = season.currentWeek;

    const matches = await client.match.findMany({
      where: { week, winnerId: null },
      include: { homeTeam: true, awayTeam: true },
    });

    // Empty week — still bump and return.
    if (matches.length === 0) {
      await client.season.update({
        where: { id: season.id },
        data: { currentWeek: { increment: 1 } },
      });
      input.onProgress?.({
        week,
        totalMatches: 0,
        completedMatches: 0,
        phase: 'done',
      });
      return { ok: true, week, matchesPlayed: 0, elapsedMs: Date.now() - start };
    }

    const total = matches.length;
    input.onProgress?.({ week, totalMatches: total, completedMatches: 0, phase: 'sim' });

    const weekSeed = input.seed ?? `advance:${season.year}:${week}`;

    // Sprint 18: pick real starters for every team in the week before sim
    // dispatch. Held in a Map<matchId, {home,away}: StarterIds> and zipped
    // into PlayerMatchStat rows at persistence time. One bulk roster query.
    const teamIds = Array.from(new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
    const startersByTeamId = await pickStartersForTeams(client, teamIds);
    const startersByMatchId = new Map<string, { home: StarterIds; away: StarterIds }>();
    for (const m of matches) {
      const homeIds = startersByTeamId.get(m.homeTeamId);
      const awayIds = startersByTeamId.get(m.awayTeamId);
      if (!homeIds || !awayIds) {
        return {
          ok: false,
          code: 'INTERNAL',
          message: `Could not pick starters for match ${m.id}`,
        };
      }
      startersByMatchId.set(m.id, { home: homeIds, away: awayIds });
    }

    const responses: seasonIpc.WorkerSimResponse[] = [];

    // Submit all jobs to the pool. Track completion for progress.
    let completed = 0;
    const promises = matches.map((m, idx) => {
      const home = lineupFromTeam(
        { id: m.homeTeam.id, abbr: m.homeTeam.abbr, prestige: m.homeTeam.prestige },
        `${weekSeed}:${idx}`,
        'home',
      );
      const away = lineupFromTeam(
        { id: m.awayTeam.id, abbr: m.awayTeam.abbr, prestige: m.awayTeam.prestige },
        `${weekSeed}:${idx}`,
        'away',
      );
      return input.pool
        .submit({
          matchId: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeLineup: home,
          awayLineup: away,
          seed: `${weekSeed}:${idx}`,
        })
        .then((res) => {
          responses.push(res);
          completed += 1;
          input.onProgress?.({
            week,
            totalMatches: total,
            completedMatches: completed,
            phase: 'sim',
          });
          return res;
        });
    });

    // Wait for all. If cancellation trips, cancel queued jobs in the pool and
    // bail out BEFORE writing anything.
    const allDone = Promise.all(promises);
    const cancelWatch = waitForCancellation(input.cancellation);
    const racer = await Promise.race([allDone.then(() => 'all' as const), cancelWatch]);
    if (racer === 'cancelled') {
      input.pool.cancelQueued();
      // Let in-flight settle to avoid dangling promise rejections.
      await Promise.allSettled(promises);
      return { ok: false, code: 'CANCELLED', message: 'Advance cancelled mid-week.' };
    }

    // Check for any worker error responses.
    const errors = responses.filter((r) => !r.ok);
    if (errors.length > 0) {
      return {
        ok: false,
        code: 'INTERNAL',
        message: `${errors.length} worker(s) reported errors.`,
      };
    }

    // All success → atomic write.
    input.onProgress?.({
      week,
      totalMatches: total,
      completedMatches: total,
      phase: 'persist',
    });

    await client.$transaction(
      async (tx) => {
        for (const r of responses) {
          if (!r.ok) continue;
          // Sprint 23: gzip + base64 PBP at the worker→DB boundary so
          // multi-season saves stay under PRD §3.5's 25 MB budget.
          const encoded = sim.encodePbpJsonString(r.pbpJson);
          await tx.match.update({
            where: { id: r.matchId },
            data: {
              winnerId: r.winnerId,
              pbpJson: encoded.payload,
              pbpEncoding: encoded.encoding,
              boxScoreJson: JSON.stringify(r.boxScore),
              timelineJson: JSON.stringify(r.timeline),
            },
          });
          // Replace any prior Set rows for this match (idempotent regen).
          await tx.set.deleteMany({ where: { matchId: r.matchId } });
          for (let i = 0; i < r.setScores.length; i++) {
            const s = r.setScores[i]!;
            await tx.set.create({
              data: {
                matchId: r.matchId,
                index: i,
                home: s.home,
                away: s.away,
                durationSec: 1200,
              },
            });
          }
          // Sprint 18: per-player stat rows. Idempotent re-run replaces.
          await tx.playerMatchStat.deleteMany({ where: { matchId: r.matchId } });
          const ids = startersByMatchId.get(r.matchId);
          if (ids) {
            await tx.playerMatchStat.createMany({
              data: sim.buildPlayerMatchStatRows({
                matchId: r.matchId,
                homePlayerIds: ids.home,
                awayPlayerIds: ids.away,
                boxScore: r.boxScore,
              }),
            });
          }
        }
        await tx.season.update({
          where: { id: season.id },
          data: { currentWeek: { increment: 1 } },
        });
      },
      // Writing ~500 matches + their set rows in one atomic op can exceed
      // Prisma's 5s defaults on slower CI hardware.
      { maxWait: 30_000, timeout: 60_000 },
    );

    // Run the voter-model poll for the week that just finished.
    try {
      await runPollForWeek({ dbPath: input.dbPath, week, seed: `poll:${weekSeed}` });
    } catch (err) {
      // Poll failure shouldn't roll back the week — matches are already
      // persisted. Surface as a warning via progress event.
      // eslint-disable-next-line no-console
      console.error(`[advanceWeek] poll for week ${week} failed: ${(err as Error).message}`);
    }

    input.onProgress?.({
      week,
      totalMatches: total,
      completedMatches: total,
      phase: 'done',
    });

    return {
      ok: true,
      week,
      matchesPlayed: total,
      elapsedMs: Date.now() - start,
    };
  } finally {
    await client.$disconnect();
  }
}

function waitForCancellation(token?: CancellationToken): Promise<'cancelled'> {
  if (!token) return new Promise(() => {}); // never resolves
  return new Promise((resolve) => {
    const tick = () => {
      if (token.cancelled) resolve('cancelled');
      else setTimeout(tick, 20);
    };
    tick();
  });
}
