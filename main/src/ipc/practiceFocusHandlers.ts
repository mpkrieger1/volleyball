// Sprint 34 — practiceFocus IPC handlers.
//
// getWeekState: resolve current pick (or auto-suggestion) + opponent summary
// setPick:      upsert the user team's pick, guarded by WEEK_ALREADY_PLAYED.

import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { practiceFocusIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { resolvePicksForTeam } from '../practiceFocus/loadPicks';

export function registerPracticeFocusHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(
    practiceFocusIpc.PRACTICE_FOCUS_IPC_CHANNELS.getWeekState,
    async (_e, raw: unknown) => {
      try {
        const req = practiceFocusIpc.GetWeekStateRequest.parse(raw);
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

          // Find the upcoming match for this team in the requested week.
          // If no match exists, return a fallback payload (still useful so
          // the renderer can show "no upcoming match this week").
          const match = await client.match.findFirst({
            where: {
              week: req.week,
              winnerId: null,
              OR: [{ homeTeamId: req.teamId }, { awayTeamId: req.teamId }],
            },
          });
          let opponentTeamId: string | null = null;
          if (match) {
            opponentTeamId =
              match.homeTeamId === req.teamId ? match.awayTeamId : match.homeTeamId;
          }

          // If no opponent (no upcoming match), fall back to a synthetic
          // self-summary so the picker can render with sensible defaults.
          const resolveAgainst = opponentTeamId ?? req.teamId;
          const resolved = await resolvePicksForTeam(
            client,
            season.year,
            req.week,
            req.teamId,
            resolveAgainst,
          );

          return {
            ok: true as const,
            week: req.week,
            offenseFocus: resolved.offenseFocus,
            defenseFocus: resolved.defenseFocus,
            autoOffenseSuggestion: resolved.autoOffenseSuggestion,
            autoDefenseSuggestion: resolved.autoDefenseSuggestion,
            opponentSummary: resolved.opponentSummary,
            fromUserPick: resolved.fromUserPick,
            hasUpcomingMatch: opponentTeamId !== null,
            opponentTeamId,
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

  ipcMain.handle(
    practiceFocusIpc.PRACTICE_FOCUS_IPC_CHANNELS.setPick,
    async (_e, raw: unknown) => {
      try {
        const req = practiceFocusIpc.SetPickRequest.parse(raw);
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

          // Sprint 34: WEEK_ALREADY_PLAYED guard. If the season has
          // advanced past the requested week, the pick can't influence
          // already-simmed matches.
          if (season.currentWeek > req.week) {
            return {
              ok: false as const,
              error: {
                code: 'WEEK_ALREADY_PLAYED' as const,
                message: `Week ${req.week} already played (currentWeek=${season.currentWeek}).`,
              },
            };
          }

          await client.practiceFocusPick.upsert({
            where: {
              seasonYear_week_teamId: {
                seasonYear: season.year,
                week: req.week,
                teamId: req.teamId,
              },
            },
            create: {
              seasonYear: season.year,
              week: req.week,
              teamId: req.teamId,
              offenseFocus: req.offenseFocus,
              defenseFocus: req.defenseFocus,
            },
            update: {
              offenseFocus: req.offenseFocus,
              defenseFocus: req.defenseFocus,
            },
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
}
