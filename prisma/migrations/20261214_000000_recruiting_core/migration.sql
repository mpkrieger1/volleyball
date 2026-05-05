-- Sprint 35 Task 35.1: FCCD-style recruiting core substrate.
--
-- 5 column additions across 4 tables:
--   1. Team.academicsLevel    — 0..100; paired with Sprint 32 facilitiesLevel.
--                                Reserved priority slot for v1.3 (not yet a
--                                weighted priority in the v1.2 model).
--   2. Coach.hometownState    — 2-letter US state code; consumed by Sprint 36's
--                                CoachConnection pitch reason.
--   3. Recruit.prioritiesJson — JSON {playingTime, proximityToHome, prestige,
--                                facilities, nilDeal} per FCCD module 1392.
--                                Nullable so legacy rows survive the migration;
--                                backfill regenerates from recruit.id hash.
--   4. Recruit.wantsToLeaveHome — 15% of recruits flip proximity polarity.
--   5. Recruit.commitmentStatus — EXPLORING/NARROWING/FAVORITES/WILL_COMMIT_SOON/
--                                COMMITTED. Recomputed each weekly tick.
--
-- NOT added in this migration: a `scoutTier` column on RecruitInterest. The
-- existing `scoutLevel` column (Sprint 28 Task 28.5B; capped at 3 in
-- performAction.ts) already serves that purpose. Sprint 35 reuses it via the
-- 3-tier projection in `main/src/recruiting/scoutReveal.ts`.
ALTER TABLE "Team" ADD COLUMN "academicsLevel" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Coach" ADD COLUMN "hometownState" TEXT;
ALTER TABLE "Recruit" ADD COLUMN "prioritiesJson" TEXT;
ALTER TABLE "Recruit" ADD COLUMN "wantsToLeaveHome" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recruit" ADD COLUMN "commitmentStatus" TEXT NOT NULL DEFAULT 'EXPLORING';
