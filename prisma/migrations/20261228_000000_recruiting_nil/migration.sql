-- Sprint 36 Task 36.1: NIL budget + per-recruit offer fields.
--
-- Team.nilBudgetCents     — annual NIL pool, refreshed at SIGNING_DAY each
--                            cycle (deriveNilBudget(prestige) — see
--                            shared/src/seed/leagueSeed.ts).
-- Team.nilBudgetUsedCents — running spend across the cycle. Reset to 0 at
--                            SIGNING_DAY when budget refreshes.
-- RecruitInterest.nilOfferCents — per-recruit money offer that converts to
--                            interest points via convertNilOfferToPoints.
ALTER TABLE "Team" ADD COLUMN "nilBudgetCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "nilBudgetUsedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RecruitInterest" ADD COLUMN "nilOfferCents" INTEGER NOT NULL DEFAULT 0;
