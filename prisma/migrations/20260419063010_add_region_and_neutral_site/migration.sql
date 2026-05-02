-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "week" INTEGER NOT NULL,
    "isConference" BOOLEAN NOT NULL DEFAULT false,
    "isTournament" BOOLEAN NOT NULL DEFAULT false,
    "isNeutralSite" BOOLEAN NOT NULL DEFAULT false,
    "winnerId" TEXT,
    "boxScoreJson" TEXT,
    "pbpJson" TEXT,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("awayTeamId", "boxScoreJson", "date", "homeTeamId", "id", "isConference", "isTournament", "pbpJson", "week", "winnerId") SELECT "awayTeamId", "boxScoreJson", "date", "homeTeamId", "id", "isConference", "isTournament", "pbpJson", "week", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");
CREATE INDEX "Match_date_idx" ON "Match"("date");
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
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("abbr", "conferenceId", "id", "logoPath", "prestige", "primaryColor", "schoolName", "secondaryColor") SELECT "abbr", "conferenceId", "id", "logoPath", "prestige", "primaryColor", "schoolName", "secondaryColor" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_schoolName_key" ON "Team"("schoolName");
CREATE UNIQUE INDEX "Team_abbr_key" ON "Team"("abbr");
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
