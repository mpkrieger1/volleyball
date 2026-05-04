// Sprint 28 (Tasks 28.1 + 28.2): IPC handlers for the Roster screen and
// Player Profile modal.

import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { rosterIpc, stats } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';

function toIpcError(err: unknown) {
  return {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: (err as Error).message },
  };
}

export function registerRosterHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(rosterIpc.ROSTER_IPC_CHANNELS.listForTeam, async (_e, raw: unknown) => {
    try {
      const req = rosterIpc.ListRosterRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const players = await client.player.findMany({
          where: { teamId: req.teamId },
          orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
        });
        return {
          ok: true as const,
          players: players.map((p) => ({
            id: p.id,
            jersey: p.jersey,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position,
            classYear: p.classYear,
            height: p.height,
            isLibero: p.isLibero,
            isCaptain: p.isCaptain,
            redshirtUsed: p.redshirtUsed,
            overall: stats.deriveOverall(p.position, {
              attack: p.ratingAttack,
              block: p.ratingBlock,
              serve: p.ratingServe,
              pass: p.ratingPass,
              set: p.ratingSet,
              dig: p.ratingDig,
              athleticism: p.ratingAthleticism,
              iq: p.ratingIq,
              stamina: p.ratingStamina,
            }),
            potential: p.potential,
          })),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(rosterIpc.ROSTER_IPC_CHANNELS.getProfile, async (_e, raw: unknown) => {
    try {
      const req = rosterIpc.GetPlayerProfileRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const player = await client.player.findUnique({
          where: { id: req.playerId },
          include: {
            team: { select: { abbr: true, schoolName: true } },
            matchStats: {
              include: { match: { select: { date: true } } },
            },
            // Sprint 28: include active NIL deals so the profile can show
            // total NIL value. Sum the amount (cents) across all deals
            // for this player.
            nilDeals: { select: { amount: true } },
          },
        });
        if (!player) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: `player ${req.playerId} not found` },
          };
        }

        // Split stats by season-year. Match.date is a Date; year =
        // calendar year of the date. NCAA seasons span Aug→Dec so
        // the season-year is just the year of the first match.
        const allRows = player.matchStats.map((s) => ({
          kills: s.kills,
          errors: s.errors,
          totalAttacks: s.totalAttacks,
          digs: s.digs,
          blockSolos: s.blockSolos,
          blockAssists: s.blockAssists,
          serviceAces: s.serviceAces,
          assists: s.assists,
          rotationMinutes: s.rotationMinutes,
        }));
        // Find most recent season year from match dates.
        let mostRecentYear = 0;
        for (const s of player.matchStats) {
          const y = s.match.date.getUTCFullYear();
          if (y > mostRecentYear) mostRecentYear = y;
        }
        const currentRows = player.matchStats
          .filter((s) => s.match.date.getUTCFullYear() === mostRecentYear)
          .map((s) => ({
            kills: s.kills,
            errors: s.errors,
            totalAttacks: s.totalAttacks,
            digs: s.digs,
            blockSolos: s.blockSolos,
            blockAssists: s.blockAssists,
            serviceAces: s.serviceAces,
            assists: s.assists,
            rotationMinutes: s.rotationMinutes,
          }));

        const careerStats = stats.aggregateStats(allRows);
        const currentSeasonStats = stats.aggregateStats(currentRows);

        const ratings = {
          attack: player.ratingAttack,
          block: player.ratingBlock,
          serve: player.ratingServe,
          pass: player.ratingPass,
          set: player.ratingSet,
          dig: player.ratingDig,
          athleticism: player.ratingAthleticism,
          iq: player.ratingIq,
          stamina: player.ratingStamina,
        };

        return {
          ok: true as const,
          profile: {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            jersey: player.jersey,
            position: player.position,
            classYear: player.classYear,
            height: player.height,
            hometownCity: null, // Player schema doesn't track hometown yet
            hometownState: null,
            isLibero: player.isLibero,
            isCaptain: player.isCaptain,
            redshirtUsed: player.redshirtUsed,
            overall: stats.deriveOverall(player.position, ratings),
            potential: player.potential,
            ratings,
            teamAbbr: player.team.abbr,
            teamSchool: player.team.schoolName,
            currentSeasonStats,
            careerStats,
            nilCents: player.nilDeals.reduce(
              (sum: number, d: { amount: number }) => sum + d.amount,
              0,
            ),
          },
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return toIpcError(err);
    }
  });
}
