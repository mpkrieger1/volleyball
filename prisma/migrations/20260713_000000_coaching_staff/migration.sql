-- Sprint 17: coaching staff + hiring pool + buyout ledger.

-- Team.operatingBudgetCents
ALTER TABLE "Team" ADD COLUMN "operatingBudgetCents" INTEGER NOT NULL DEFAULT 5000000;

-- Coach.hireSeason + (teamId, role) index
ALTER TABLE "Coach" ADD COLUMN "hireSeason" INTEGER NOT NULL DEFAULT 2026;
CREATE INDEX "Coach_teamId_role_idx" ON "Coach"("teamId", "role");

-- CoachingPool
CREATE TABLE "CoachingPool" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "ratingRecruit" INTEGER NOT NULL,
  "ratingDevelop" INTEGER NOT NULL,
  "ratingStrategy" INTEGER NOT NULL,
  "askingSalaryCents" INTEGER NOT NULL,
  "preferredRole" TEXT NOT NULL,
  "ageYears" INTEGER NOT NULL,
  "seasonAvailable" INTEGER NOT NULL
);
CREATE INDEX "CoachingPool_seasonAvailable_idx" ON "CoachingPool"("seasonAvailable");

-- CoachBuyout
CREATE TABLE "CoachBuyout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "coachId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "seasonYear" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachBuyout_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachBuyout_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CoachBuyout_teamId_idx" ON "CoachBuyout"("teamId");
CREATE INDEX "CoachBuyout_coachId_idx" ON "CoachBuyout"("coachId");
