-- Sprint 33 Task 33.1: offseason event-calendar substrate.
--
-- 1. Season.phaseWeek tracks the index within the current phase's event
--    sequence (0 = first event; OFFSEASON has 11, PRESEASON has 5). The
--    user advances one event at a time via `advanceOffseasonEvent`.
-- 2. TrainingFocusPick persists user-chosen coach attribute focuses for
--    the upcoming TRAINING_RESULTS event. 9 picks per team (3 coaches × 3
--    slots). AI teams generate picks lazily inside `applyTrainingResults`.
-- 3. TrainingResultEntry is the audit trail: one row per (player, attribute)
--    pair that received a gain at TRAINING_RESULTS. Doubles as the
--    idempotency key — `applyTrainingResults` is a no-op if rows already
--    exist for the season.
ALTER TABLE "Season" ADD COLUMN "phaseWeek" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TrainingFocusPick" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "seasonYear" INTEGER NOT NULL,
  "teamId" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "attribute" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingFocusPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE,
  CONSTRAINT "TrainingFocusPick_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "TrainingFocusPick_seasonYear_teamId_coachId_slotIndex_key"
  ON "TrainingFocusPick"("seasonYear", "teamId", "coachId", "slotIndex");
CREATE INDEX "TrainingFocusPick_seasonYear_teamId_idx"
  ON "TrainingFocusPick"("seasonYear", "teamId");

CREATE TABLE "TrainingResultEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "seasonYear" INTEGER NOT NULL,
  "teamId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "attribute" TEXT NOT NULL,
  "gainApplied" INTEGER NOT NULL,
  "wasBreakthrough" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingResultEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE,
  CONSTRAINT "TrainingResultEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE
);

CREATE INDEX "TrainingResultEntry_seasonYear_teamId_idx"
  ON "TrainingResultEntry"("seasonYear", "teamId");
CREATE INDEX "TrainingResultEntry_playerId_idx"
  ON "TrainingResultEntry"("playerId");
