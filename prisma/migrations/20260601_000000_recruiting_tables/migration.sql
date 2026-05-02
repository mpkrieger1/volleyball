-- Sprint 13: recruiting-cycle state + interest + budget tables.

-- Recruit additions
ALTER TABLE "Recruit" ADD COLUMN "commitState" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Recruit" ADD COLUMN "committedAtWeek" INTEGER;
ALTER TABLE "Recruit" ADD COLUMN "seasonYear" INTEGER;
CREATE INDEX "Recruit_commitState_idx" ON "Recruit"("commitState");
CREATE INDEX "Recruit_seasonYear_idx" ON "Recruit"("seasonYear");

-- Season additions
ALTER TABLE "Season" ADD COLUMN "recruitingWeek" INTEGER NOT NULL DEFAULT 0;

-- RecruitInterest
CREATE TABLE "RecruitInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recruitId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "actionsSpent" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RecruitInterest_recruitId_fkey" FOREIGN KEY ("recruitId") REFERENCES "Recruit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecruitInterest_recruitId_teamId_key" ON "RecruitInterest"("recruitId", "teamId");
CREATE INDEX "RecruitInterest_teamId_idx" ON "RecruitInterest"("teamId");

-- RecruitingBudget
CREATE TABLE "RecruitingBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "RecruitingBudget_teamId_week_key" ON "RecruitingBudget"("teamId", "week");
CREATE INDEX "RecruitingBudget_teamId_idx" ON "RecruitingBudget"("teamId");
