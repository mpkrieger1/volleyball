// Sprint 33 — TRAINING_RESULTS (preseason) event handler.
//
// Calls `applyTrainingResults` (Task 33.4). Idempotency lives inside
// applyTrainingResults: it counts existing TrainingResultEntry rows for
// the season and skips if any exist.

import type { PrismaClient } from '@prisma/client';
import { applyTrainingResults } from '../applyTrainingResults';

export type TrainingResultsResult = {
  event: 'TRAINING_RESULTS';
  teamsProcessed: number;
  playersUpdated: number;
  breakthroughs: number;
};

export async function trainingResults(
  client: PrismaClient,
  seasonYear: number,
): Promise<TrainingResultsResult> {
  const result = await applyTrainingResults({ client, seasonYear });
  return {
    event: 'TRAINING_RESULTS',
    teamsProcessed: result.teamsProcessed,
    playersUpdated: result.playersUpdated,
    breakthroughs: result.breakthroughs,
  };
}
