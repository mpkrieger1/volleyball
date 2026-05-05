import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { offseasonIpc, season as seasonNs, offseason as offseasonNs } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { runOffseason } from '../offseason/runOffseason';
import { startRegular } from '../season/startRegular';
import { advanceOffseasonEvent } from '../offseason/advanceOffseasonEvent';
import { pickAiFocusesForCoach } from '../offseason/aiFocusHeuristic';

export function registerOffseasonHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.run, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.RunRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await runOffseason({ dbPath });
      return {
        ok: true as const,
        playersGraduated: r.playersGraduated,
        playersCut: r.playersCut,
        teamsUpdated: r.teamsUpdated,
        newSeasonYear: r.newSeasonYear,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.toggleRedshirt, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.ToggleRedshirtRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const player = await client.player.findUnique({ where: { id: req.playerId } });
        if (!player || player.teamId !== req.teamId) {
          return {
            ok: false as const,
            error: { code: 'PLAYER_NOT_ON_TEAM' as const, message: 'Player not on team.' },
          };
        }
        if (player.redshirtLocked) {
          return {
            ok: false as const,
            error: {
              code: 'REDSHIRT_LOCKED' as const,
              message: 'Redshirt locked for this season (player has played).',
            },
          };
        }
        await client.player.update({
          where: { id: req.playerId },
          data: { redshirtUsed: req.redshirtUsed },
        });
        return { ok: true as const, redshirtUsed: req.redshirtUsed };
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

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.preseasonState, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.PreseasonStateRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
        if (!season) {
          return {
            ok: false as const,
            error: { code: 'NO_SEASON' as const, message: 'No Season row.' },
          };
        }
        const players = await client.player.findMany({
          where: { teamId: req.teamId },
          orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
        });
        const roster = players.map((p) => ({
          playerId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          classYear: p.classYear,
          overall: Math.round(
            (p.ratingAttack +
              p.ratingBlock +
              p.ratingServe +
              p.ratingPass +
              p.ratingSet +
              p.ratingDig +
              p.ratingAthleticism +
              p.ratingIq +
              p.ratingStamina) /
              9,
          ),
          redshirtUsed: p.redshirtUsed,
          redshirtLocked: p.redshirtLocked,
        }));
        return {
          ok: true as const,
          phase: season.phase,
          year: season.year,
          roster,
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

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.startRegular, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.StartRegularRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await startRegular({ dbPath });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return { ok: true as const, phase: r.phase, year: r.year };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 33: event-aware advance.
  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.advanceEvent, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.AdvanceEventRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await advanceOffseasonEvent({ dbPath, userTeamId: req.teamId ?? null });
      if (!r.ok) {
        return { ok: false as const, error: { code: 'INTERNAL' as const, message: r.message } };
      }
      return {
        ok: true as const,
        event: r.event,
        cursorAfter: r.cursorAfter,
        summary: r.summary,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 33: read event state for the renderer.
  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.getEventState, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.EventStateRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
        if (!season) {
          return {
            ok: false as const,
            error: { code: 'NO_SEASON' as const, message: 'No Season row.' },
          };
        }
        const event = seasonNs.getCurrentEvent({
          phase: season.phase as seasonNs.SeasonPhase,
          phaseWeek: season.phaseWeek,
        });

        let trainingFocus: offseasonIpc.EventStateResponse extends { trainingFocus: infer T } ? T : null = null;
        if (event === 'TRAINING_FOCUS') {
          const [team, coaches, players, picks] = await Promise.all([
            client.team.findUnique({
              where: { id: req.teamId },
              select: { facilitiesLevel: true },
            }),
            client.coach.findMany({
              where: { teamId: req.teamId },
              orderBy: { role: 'asc' },
            }),
            client.player.findMany({ where: { teamId: req.teamId } }),
            client.trainingFocusPick.findMany({
              where: { seasonYear: season.year, teamId: req.teamId },
            }),
          ]);
          if (team) {
            const coachInfos: offseasonIpc.CoachSlotInfo[] = [];
            for (const role of ['HC', 'AHC', 'AC'] as const) {
              const c = coaches.find((x) => x.role === role);
              if (!c) continue;
              const validFocuses = offseasonNs.getValidTrainingFocuses(role);
              const defaults = pickAiFocusesForCoach({
                role,
                roster: players,
                facilitiesLevel: team.facilitiesLevel,
              });
              const currentPicks: Array<offseasonNs.TrainableSkill | null> = [
                null,
                null,
                null,
              ];
              const picksForCoach = picks.filter((p) => p.coachId === c.id);
              for (const p of picksForCoach) {
                if (p.slotIndex >= 0 && p.slotIndex < 3) {
                  currentPicks[p.slotIndex] = p.attribute as never;
                }
              }
              coachInfos.push({
                coachId: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                role,
                ratingDevelop: c.ratingDevelop,
                validFocuses,
                defaultPicks: defaults,
                currentPicks: currentPicks as never,
              });
            }
            trainingFocus = {
              coaches: coachInfos,
              facilitiesLevel: team.facilitiesLevel,
            } as never;
          }
        }

        return {
          ok: true as const,
          phase: season.phase,
          phaseWeek: season.phaseWeek,
          year: season.year,
          event,
          trainingFocus,
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

  // Sprint 33: persist a single training-focus pick.
  ipcMain.handle(
    offseasonIpc.OFFSEASON_IPC_CHANNELS.setTrainingFocusPick,
    async (_e, raw: unknown) => {
      try {
        const req = offseasonIpc.SetTrainingFocusPickRequest.parse(raw);
        const dbPath = await findSlotDbPathById(deps, req.slotId);
        if (!dbPath) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
          };
        }
        const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
        try {
          const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
          if (!season) {
            return {
              ok: false as const,
              error: { code: 'NO_SEASON' as const, message: 'No Season row.' },
            };
          }
          await client.trainingFocusPick.upsert({
            where: {
              seasonYear_teamId_coachId_slotIndex: {
                seasonYear: season.year,
                teamId: req.teamId,
                coachId: req.coachId,
                slotIndex: req.slotIndex,
              },
            },
            create: {
              seasonYear: season.year,
              teamId: req.teamId,
              coachId: req.coachId,
              slotIndex: req.slotIndex,
              attribute: req.attribute,
            },
            update: { attribute: req.attribute },
          });
          return { ok: true as const };
        } finally {
          await client.$disconnect();
        }
      } catch (err) {
        return {
          ok: false as const,
          error: { code: 'INTERNAL' as const, message: (err as Error).message },
        };
      }
    },
  );

  // Sprint 33: list training-result entries for the renderer.
  ipcMain.handle(
    offseasonIpc.OFFSEASON_IPC_CHANNELS.listTrainingResults,
    async (_e, raw: unknown) => {
      try {
        const req = offseasonIpc.ListTrainingResultsRequest.parse(raw);
        const dbPath = await findSlotDbPathById(deps, req.slotId);
        if (!dbPath) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
          };
        }
        const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
        try {
          const entries = await client.trainingResultEntry.findMany({
            where: { teamId: req.teamId, seasonYear: req.seasonYear },
            include: {
              player: { select: { firstName: true, lastName: true } },
            },
          });
          return {
            ok: true as const,
            rows: entries.map((e) => ({
              playerId: e.playerId,
              playerName: `${e.player.firstName} ${e.player.lastName}`,
              attribute: e.attribute,
              gainApplied: e.gainApplied,
              wasBreakthrough: e.wasBreakthrough,
            })),
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
    },
  );
}
