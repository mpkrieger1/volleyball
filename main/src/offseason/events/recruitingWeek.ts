// Sprint 33 — RECRUITING_1 / RECRUITING_2 / RECRUITING_3 event handler.
//
// Thin shell delegating to the existing recruiting service (Sprint 13).
// Sprint 35 deepens these with priority-driven interest, scout reveal, and
// recruiter quality. v1.2 keeps the implementation 3-5 LOC per the
// Sprint 33 spec mandate.
//
// RECRUITING_1: opens the cycle if not yet open, then advances week 1.
// RECRUITING_2/_3: just advance.

import { PrismaClient } from '@prisma/client';
import { openRecruitingCycle } from '../../recruiting/openRecruitingCycle';
import { advanceRecruitingWeek } from '../../recruiting/advanceRecruitingWeek';

export type RecruitingWeekResult = {
  event: 'RECRUITING_1' | 'RECRUITING_2' | 'RECRUITING_3';
  recruitsCreated: number;
  weekIndex: number;
};

export async function recruitingWeek(
  dbPath: string,
  seasonYear: number,
  eventName: 'RECRUITING_1' | 'RECRUITING_2' | 'RECRUITING_3',
): Promise<RecruitingWeekResult> {
  let recruitsCreated = 0;
  if (eventName === 'RECRUITING_1') {
    // Open the cycle on the first event (idempotent: openRecruitingCycle
    // is itself a fresh-class generator; if rows exist for the season,
    // skip the open step).
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    let alreadyOpen = false;
    try {
      const existing = await client.recruit.count();
      if (existing > 0) alreadyOpen = true;
    } finally {
      await client.$disconnect();
    }
    if (!alreadyOpen) {
      const opened = await openRecruitingCycle({ dbPath, seasonYear });
      recruitsCreated = opened.recruitsCreated;
      // openRecruitingCycle already wrote phase=RECRUITING + recruitingWeek=1.
      // Reset phase to OFFSEASON for orchestrator continuity.
      const c2 = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const s = await c2.season.findFirst({ orderBy: { year: 'desc' } });
        if (s) {
          await c2.season.update({
            where: { id: s.id },
            data: { phase: 'OFFSEASON' },
          });
        }
      } finally {
        await c2.$disconnect();
      }
      return { event: eventName, recruitsCreated, weekIndex: 1 };
    }
  }

  const advanced = await advanceRecruitingWeek({
    dbPath,
    seed: `recruit-adv:${seasonYear}:${eventName}`,
  });
  return { event: eventName, recruitsCreated: 0, weekIndex: advanced.week };
}
