import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { scheduleIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { generateAndPersistSchedule, ScheduleError } from '../schedule/generateAndPersist';

function toIpcError(err: unknown) {
  if (err instanceof ScheduleError) {
    return { ok: false as const, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: (err as Error).message },
  };
}

export function registerScheduleHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(scheduleIpc.SCHEDULE_IPC_CHANNELS.generate, async (_e, raw: unknown) => {
    try {
      const req = scheduleIpc.GenerateScheduleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await generateAndPersistSchedule({
        dbPath,
        seasonYear: req.seasonYear,
        seed: req.seed,
      });
      return { ok: true as const, stats: result.stats };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(scheduleIpc.SCHEDULE_IPC_CHANNELS.listForTeam, async (_e, raw: unknown) => {
    try {
      const req = scheduleIpc.ListTeamScheduleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const rows = await client.match.findMany({
          where: {
            OR: [{ homeTeamId: req.teamId }, { awayTeamId: req.teamId }],
          },
          orderBy: [{ date: 'asc' }],
          include: {
            homeTeam: true,
            awayTeam: true,
            // Sprint 28: include Set rows so we can derive sets-won counts
            // for completed matches. Persisted by simulateAndPersist via
            // the per-set scoreboard.
            sets: { select: { home: true, away: true } },
          },
        });
        // Sprint 37 (post-launch UAT): pre-compute team overall (avg of
        // player overalls) for every team that appears in this schedule.
        // One findMany per team is too chatty; pull all relevant teams'
        // players in a single query and group in memory.
        const teamIds = new Set<string>();
        for (const m of rows) {
          teamIds.add(m.homeTeamId);
          teamIds.add(m.awayTeamId);
        }
        const allPlayers = await client.player.findMany({
          where: { teamId: { in: Array.from(teamIds) } },
          select: {
            teamId: true,
            ratingAttack: true,
            ratingBlock: true,
            ratingServe: true,
            ratingPass: true,
            ratingSet: true,
            ratingDig: true,
            ratingAthleticism: true,
            ratingIq: true,
            ratingStamina: true,
          },
        });
        const overallByTeam = new Map<string, number>();
        const sumByTeam = new Map<string, { sum: number; n: number }>();
        for (const p of allPlayers) {
          const ovr =
            (p.ratingAttack +
              p.ratingBlock +
              p.ratingServe +
              p.ratingPass +
              p.ratingSet +
              p.ratingDig +
              p.ratingAthleticism +
              p.ratingIq +
              p.ratingStamina) /
            9;
          const cur = sumByTeam.get(p.teamId) ?? { sum: 0, n: 0 };
          sumByTeam.set(p.teamId, { sum: cur.sum + ovr, n: cur.n + 1 });
        }
        for (const [tid, { sum, n }] of sumByTeam) {
          overallByTeam.set(tid, Math.round(sum / n));
        }
        return {
          ok: true as const,
          rows: rows.map((m) => {
            const isHome = m.homeTeamId === req.teamId;
            const opp = isHome ? m.awayTeam : m.homeTeam;
            // Sprint 28: derive sets won from the Set rows. Returns null
            // when match is unplayed (winnerId === null) so the renderer
            // can render "—" instead of "0–0".
            let homeSetsWon: number | null = null;
            let awaySetsWon: number | null = null;
            if (m.winnerId) {
              homeSetsWon = 0;
              awaySetsWon = 0;
              for (const s of m.sets) {
                if (s.home > s.away) homeSetsWon += 1;
                else if (s.away > s.home) awaySetsWon += 1;
              }
            }
            return {
              matchId: m.id,
              weekIndex: m.week,
              isoDate: m.date.toISOString().slice(0, 10),
              opponentId: opp.id,
              opponentSchool: opp.schoolName,
              opponentAbbr: opp.abbr,
              isHome,
              isConference: m.isConference,
              isTournament: m.isTournament,
              isNeutralSite: m.isNeutralSite,
              winnerId: m.winnerId,
              homeSetsWon,
              awaySetsWon,
              tournamentRound: m.tournamentRound,
              opponentOverall: overallByTeam.get(opp.id) ?? null,
            };
          }),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return toIpcError(err);
    }
  });
}
