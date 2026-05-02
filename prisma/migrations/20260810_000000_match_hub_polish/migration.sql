-- AlterTable
ALTER TABLE "Match" ADD COLUMN "timelineJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolName" TEXT NOT NULL,
    "abbr" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "logoPath" TEXT NOT NULL,
    "prestige" INTEGER NOT NULL DEFAULT 55,
    "region" TEXT NOT NULL DEFAULT 'CENTRAL',
    "conferenceId" TEXT NOT NULL,
    "operatingBudgetCents" INTEGER NOT NULL DEFAULT 5000000,
    "preferredSystem" TEXT NOT NULL DEFAULT '5-1',
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("abbr", "conferenceId", "id", "logoPath", "operatingBudgetCents", "prestige", "primaryColor", "region", "schoolName", "secondaryColor") SELECT "abbr", "conferenceId", "id", "logoPath", "operatingBudgetCents", "prestige", "primaryColor", "region", "schoolName", "secondaryColor" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_schoolName_key" ON "Team"("schoolName");
CREATE UNIQUE INDEX "Team_abbr_key" ON "Team"("abbr");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
