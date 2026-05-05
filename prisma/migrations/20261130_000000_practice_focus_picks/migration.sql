-- Sprint 34 Task 34.1: per-week practice focus picks (user team only).
--
-- Each regular-season week, the user picks one offensive + one defensive
-- focus that gives a small (~3-5%) sim modifier on the upcoming match.
-- AI teams' picks are NOT persisted — they're computed on the fly
-- (deterministic per `seasonYear:teamId:week`) inside applyTrainingResults
-- and the per-match dispatch path.
--
-- Practice focus does NOT mutate Player.rating*; it's a per-match buff
-- only. CLAUDE.md §Critical rules #4 (Sprint 34 invariant).
CREATE TABLE "PracticeFocusPick" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "seasonYear" INTEGER NOT NULL,
  "week" INTEGER NOT NULL,
  "teamId" TEXT NOT NULL,
  "offenseFocus" TEXT NOT NULL,
  "defenseFocus" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeFocusPick_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "PracticeFocusPick_seasonYear_week_teamId_key"
  ON "PracticeFocusPick"("seasonYear", "week", "teamId");
CREATE INDEX "PracticeFocusPick_seasonYear_teamId_idx"
  ON "PracticeFocusPick"("seasonYear", "teamId");
