// Sprint 15: revoke the Team-Collective NilDeal for a player on the
// user's team. Does not touch portal-sourced NilDeal rows (brand
// 'Portal NIL') — those are immutable contracts from a past commit.

import { PrismaClient } from '@prisma/client';

const TEAM_COLLECTIVE_BRAND = 'Team Collective';

export type RevokeNilInput = {
  dbPath: string;
  teamId: string;
  playerId: string;
};

export type RevokeNilResult =
  | { ok: true; removed: boolean }
  | { ok: false; code: 'PLAYER_NOT_ON_TEAM'; message: string };

export async function revokeNil(input: RevokeNilInput): Promise<RevokeNilResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const player = await client.player.findUnique({ where: { id: input.playerId } });
    if (!player || player.teamId !== input.teamId) {
      return {
        ok: false,
        code: 'PLAYER_NOT_ON_TEAM',
        message: 'Player is not on this team.',
      };
    }
    const result = await client.nilDeal.deleteMany({
      where: { playerId: input.playerId, brand: TEAM_COLLECTIVE_BRAND },
    });
    return { ok: true, removed: result.count > 0 };
  } finally {
    await client.$disconnect();
  }
}
