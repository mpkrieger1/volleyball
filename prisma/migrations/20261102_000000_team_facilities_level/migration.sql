-- Sprint 32 Task 32.1: per-team facilities level (1..10).
--
-- Feeds the floor of the FCCD-style training-gain range
-- (see `shared/src/offseason/trainingGain.ts:getFacilitiesBaseGain`).
-- Default 3 = mid-tier baseline (gives a base gain of 1 for non-focused
-- attribute drift). Legacy saves get the prestige-derived value via
-- `backfillFacilitiesLevel` after `applyMigrations` in `openSaveSlot`.
ALTER TABLE "Team" ADD COLUMN "facilitiesLevel" INTEGER NOT NULL DEFAULT 3;
