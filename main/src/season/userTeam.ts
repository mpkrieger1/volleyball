// Sprint 21: read/write Season.userTeamId. Closes the user-team-picker
// gap from Sprints 13/14/15 — RecruitingBoard / PortalView / NilView
// hardcoded `teams[0]` until now.

import type { Prisma, PrismaClient } from '@prisma/client';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type GetUserTeamResult = { userTeamId: string | null };
export type SetUserTeamResult = { userTeamId: string };

/** Read the user's chosen team for the latest Season row, or null. */
export async function getUserTeam(client: ClientLike): Promise<GetUserTeamResult | null> {
  const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
  if (!season) return null;
  return { userTeamId: season.userTeamId };
}

/** Set the user's team. Idempotent: subsequent calls overwrite. */
export async function setUserTeam(
  client: ClientLike,
  teamId: string,
): Promise<SetUserTeamResult | { error: 'NOT_FOUND' | 'TEAM_NOT_FOUND' }> {
  const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
  if (!season) return { error: 'NOT_FOUND' };
  const team = await client.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) return { error: 'TEAM_NOT_FOUND' };
  const updated = await client.season.update({
    where: { id: season.id },
    data: { userTeamId: teamId },
    select: { userTeamId: true },
  });
  return { userTeamId: updated.userTeamId! };
}
