// Sprint 33 — TRAINING_FOCUS (preseason) event handler.
//
// No backend mutation: just renders the picker UI. The "advance" press
// validates that picks are complete (or lets AI auto-fill if user team
// has no preference) and increments phaseWeek. AI teams DO NOT need
// TrainingFocusPick rows — `applyTrainingResults` (next event) generates
// them lazily from the AI heuristic.
//
// Idempotent: pure read-only. Returns counts so the renderer can show
// "X of 9 picks made."

import type { PrismaClient } from '@prisma/client';

export type TrainingFocusResult = {
  event: 'TRAINING_FOCUS';
  userTeamPicksMade: number;
};

export async function trainingFocus(
  client: PrismaClient,
  seasonYear: number,
  userTeamId: string | null,
): Promise<TrainingFocusResult> {
  if (!userTeamId) {
    return { event: 'TRAINING_FOCUS', userTeamPicksMade: 0 };
  }
  const userTeamPicksMade = await client.trainingFocusPick.count({
    where: { seasonYear, teamId: userTeamId },
  });
  return { event: 'TRAINING_FOCUS', userTeamPicksMade };
}
