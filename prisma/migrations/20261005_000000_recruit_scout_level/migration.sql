-- Sprint 28 Task 28.5B: scout-level reveal tracking.
--
-- Each SCOUT action increments scoutLevel (0..3). UI uses this to decide
-- which skill letter-grades to reveal in the recruit-detail modal.
ALTER TABLE "RecruitInterest" ADD COLUMN "scoutLevel" INTEGER NOT NULL DEFAULT 0;
