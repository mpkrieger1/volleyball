-- Sprint 14: portal state machine + pursuit + budget tables.

-- TransferPortal additions
ALTER TABLE "TransferPortal" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TransferPortal" ADD COLUMN "enteredAtWeek" INTEGER;
ALTER TABLE "TransferPortal" ADD COLUMN "nilOfferAmount" INTEGER;
CREATE INDEX "TransferPortal_status_idx" ON "TransferPortal"("status");

-- Season additions
ALTER TABLE "Season" ADD COLUMN "portalWeek" INTEGER NOT NULL DEFAULT 0;

-- PortalInterest
CREATE TABLE "PortalInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferPortalId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "actionsSpent" INTEGER NOT NULL DEFAULT 0,
    "lastNilOffer" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PortalInterest_transferPortalId_fkey" FOREIGN KEY ("transferPortalId") REFERENCES "TransferPortal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PortalInterest_transferPortalId_teamId_key" ON "PortalInterest"("transferPortalId", "teamId");
CREATE INDEX "PortalInterest_teamId_idx" ON "PortalInterest"("teamId");

-- PortalBudget
CREATE TABLE "PortalBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "PortalBudget_teamId_week_key" ON "PortalBudget"("teamId", "week");
CREATE INDEX "PortalBudget_teamId_idx" ON "PortalBudget"("teamId");
