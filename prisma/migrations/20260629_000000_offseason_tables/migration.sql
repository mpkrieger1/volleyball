-- Sprint 16: offseason tables — redshirt lock + PlayerArchive.

ALTER TABLE "Player" ADD COLUMN "redshirtLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PlayerArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalPlayerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "finalTeamId" TEXT NOT NULL,
    "finalClassYear" TEXT NOT NULL,
    "finalRatingsJson" TEXT NOT NULL,
    "finalPotential" INTEGER NOT NULL,
    "seasonRetired" INTEGER NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PlayerArchive_originalPlayerId_key" ON "PlayerArchive"("originalPlayerId");
CREATE INDEX "PlayerArchive_finalTeamId_idx" ON "PlayerArchive"("finalTeamId");
CREATE INDEX "PlayerArchive_seasonRetired_idx" ON "PlayerArchive"("seasonRetired");
