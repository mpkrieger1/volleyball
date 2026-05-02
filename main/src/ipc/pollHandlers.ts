import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { pollIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';

export function registerPollHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(pollIpc.POLL_IPC_CHANNELS.latest, async (_e, raw: unknown) => {
    try {
      const req = pollIpc.GetLatestPollRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        // Find the latest week that has poll rows.
        const latest = await client.poll.findFirst({ orderBy: { week: 'desc' } });
        if (!latest) {
          return { ok: true as const, week: 0, rows: [] };
        }
        const week = latest.week;
        const rows = await client.poll.findMany({
          where: { week },
          orderBy: { rank: 'asc' },
          include: { team: true },
        });

        // Compute per-team record from completed matches for display.
        const played = await client.match.findMany({
          where: { winnerId: { not: null } },
          select: { homeTeamId: true, awayTeamId: true, winnerId: true },
        });
        const recordByTeam = new Map<string, { w: number; l: number }>();
        for (const m of played) {
          const winner = m.winnerId!;
          const loser = m.homeTeamId === winner ? m.awayTeamId : m.homeTeamId;
          const rw = recordByTeam.get(winner) ?? { w: 0, l: 0 };
          rw.w += 1;
          recordByTeam.set(winner, rw);
          const rl = recordByTeam.get(loser) ?? { w: 0, l: 0 };
          rl.l += 1;
          recordByTeam.set(loser, rl);
        }

        return {
          ok: true as const,
          week,
          rows: rows.map((r) => {
            const rec = recordByTeam.get(r.teamId) ?? { w: 0, l: 0 };
            const delta =
              r.prevRank == null
                ? 'NEW'
                : r.prevRank === r.rank
                  ? '—'
                  : r.prevRank > r.rank
                    ? `↑${r.prevRank - r.rank}`
                    : `↓${r.rank - r.prevRank}`;
            return {
              rank: r.rank,
              teamId: r.teamId,
              teamSchool: r.team.schoolName,
              teamAbbr: r.team.abbr,
              record: `${rec.w}-${rec.l}`,
              firstPlaceVotes: r.firstPlaceVotes,
              prevRank: r.prevRank,
              delta,
            };
          }),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}
