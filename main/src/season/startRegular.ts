// Sprint 16: transition Season.phase PRESEASON → REGULAR. Completes the
// state machine (previously only PRESEASON→REGULAR was missing).

import { PrismaClient } from '@prisma/client';

export type StartRegularInput = { dbPath: string };
export type StartRegularResult =
  | { ok: true; phase: 'REGULAR'; year: number }
  | { ok: false; code: 'NOT_IN_PRESEASON' | 'NO_SEASON'; message: string };

export async function startRegular(input: StartRegularInput): Promise<StartRegularResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) return { ok: false, code: 'NO_SEASON', message: 'No Season row.' };
    if (season.phase !== 'PRESEASON') {
      return {
        ok: false,
        code: 'NOT_IN_PRESEASON',
        message: `Season.phase must be PRESEASON (got ${season.phase}).`,
      };
    }
    await client.season.update({
      where: { id: season.id },
      data: { phase: 'REGULAR' },
    });
    return { ok: true, phase: 'REGULAR', year: season.year };
  } finally {
    await client.$disconnect();
  }
}
