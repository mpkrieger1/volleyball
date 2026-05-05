// Sprint 34 Task 34.5 — resolve practice-focus picks for a team's
// upcoming match. Used by both the IPC handler and (future) advanceWeek
// per-match dispatch.
//
// Resolution order:
//   1. If a PracticeFocusPick row exists for (seasonYear, week, teamId),
//      use its (offenseFocus, defenseFocus).
//   2. Else compute the auto-suggestion via the Sprint 34 auto-picker
//      against the opponent's OpponentSummary.

import type { Prisma, PrismaClient } from '@prisma/client';
import { season } from '@vcd/shared';
import { buildOpponentSummary } from './opponentSummary';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type ResolvedPicks = {
  offenseFocus: season.OffensePracticeFocus;
  defenseFocus: season.DefensePracticeFocus;
  autoOffenseSuggestion: season.OffensePracticeFocus;
  autoDefenseSuggestion: season.DefensePracticeFocus;
  opponentSummary: season.OpponentSummary;
  fromUserPick: boolean;
};

export async function resolvePicksForTeam(
  client: ClientLike,
  seasonYear: number,
  week: number,
  teamId: string,
  opponentTeamId: string,
): Promise<ResolvedPicks> {
  const opponentSummary = await buildOpponentSummary(client, opponentTeamId);
  const autoOffenseSuggestion = season.getAutoOffenseFocus(opponentSummary);
  const autoDefenseSuggestion = season.getAutoDefenseFocus(opponentSummary);

  const existing = await client.practiceFocusPick.findUnique({
    where: {
      seasonYear_week_teamId: { seasonYear, week, teamId },
    },
  });

  if (existing) {
    return {
      offenseFocus: existing.offenseFocus as season.OffensePracticeFocus,
      defenseFocus: existing.defenseFocus as season.DefensePracticeFocus,
      autoOffenseSuggestion,
      autoDefenseSuggestion,
      opponentSummary,
      fromUserPick: true,
    };
  }

  return {
    offenseFocus: autoOffenseSuggestion,
    defenseFocus: autoDefenseSuggestion,
    autoOffenseSuggestion,
    autoDefenseSuggestion,
    opponentSummary,
    fromUserPick: false,
  };
}
