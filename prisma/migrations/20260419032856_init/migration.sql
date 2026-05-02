-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "abbr" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "autoBidEligible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolName" TEXT NOT NULL,
    "abbr" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "logoPath" TEXT NOT NULL,
    "prestige" INTEGER NOT NULL DEFAULT 55,
    "conferenceId" TEXT NOT NULL,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "classYear" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "jersey" INTEGER NOT NULL,
    "ratingAttack" INTEGER NOT NULL,
    "ratingBlock" INTEGER NOT NULL,
    "ratingServe" INTEGER NOT NULL,
    "ratingPass" INTEGER NOT NULL,
    "ratingSet" INTEGER NOT NULL,
    "ratingDig" INTEGER NOT NULL,
    "ratingAthleticism" INTEGER NOT NULL,
    "ratingIq" INTEGER NOT NULL,
    "ratingStamina" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "redshirtUsed" BOOLEAN NOT NULL DEFAULT false,
    "isLibero" BOOLEAN NOT NULL DEFAULT false,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    "contractYears" INTEGER NOT NULL DEFAULT 1,
    "salary" INTEGER NOT NULL DEFAULT 0,
    "ratingRecruit" INTEGER NOT NULL DEFAULT 50,
    "ratingDevelop" INTEGER NOT NULL DEFAULT 50,
    "ratingStrategy" INTEGER NOT NULL DEFAULT 50,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recruit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "ratingsJson" TEXT NOT NULL,
    "commitTeamId" TEXT
);

-- CreateTable
CREATE TABLE "TransferPortal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "enteredDate" DATETIME NOT NULL,
    "newTeamId" TEXT,
    CONSTRAINT "TransferPortal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NilDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "teamRestrictionLevel" TEXT NOT NULL,
    CONSTRAINT "NilDeal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "week" INTEGER NOT NULL,
    "isConference" BOOLEAN NOT NULL DEFAULT false,
    "isTournament" BOOLEAN NOT NULL DEFAULT false,
    "winnerId" TEXT,
    "boxScoreJson" TEXT,
    "pbpJson" TEXT,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Set" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "home" INTEGER NOT NULL,
    "away" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    CONSTRAINT "Set_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMatchStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "totalAttacks" INTEGER NOT NULL DEFAULT 0,
    "hittingPct" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "serviceAces" INTEGER NOT NULL DEFAULT 0,
    "serviceErrors" INTEGER NOT NULL DEFAULT 0,
    "receptionErrors" INTEGER NOT NULL DEFAULT 0,
    "digs" INTEGER NOT NULL DEFAULT 0,
    "blockSolos" INTEGER NOT NULL DEFAULT 0,
    "blockAssists" INTEGER NOT NULL DEFAULT 0,
    "rotationMinutes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "prevRank" INTEGER,
    "firstPlaceVotes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Poll_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RPISnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "rpi" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "sos" INTEGER NOT NULL,
    "q1Wins" INTEGER NOT NULL,
    "q2Wins" INTEGER NOT NULL,
    "q3Wins" INTEGER NOT NULL,
    "q4Wins" INTEGER NOT NULL,
    CONSTRAINT "RPISnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "userTeamId" TEXT,
    "currentWeek" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonYear" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "team" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Booster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "collectiveBudget" INTEGER NOT NULL DEFAULT 0,
    "enthusiasm" INTEGER NOT NULL DEFAULT 50,
    CONSTRAINT "Booster_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaveSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dynastyYear" INTEGER NOT NULL DEFAULT 2026
);

-- CreateIndex
CREATE UNIQUE INDEX "Conference_name_key" ON "Conference"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Conference_abbr_key" ON "Conference"("abbr");

-- CreateIndex
CREATE INDEX "Conference_tier_idx" ON "Conference"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Team_schoolName_key" ON "Team"("schoolName");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbr_key" ON "Team"("abbr");

-- CreateIndex
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Coach_teamId_idx" ON "Coach"("teamId");

-- CreateIndex
CREATE INDEX "TransferPortal_playerId_idx" ON "TransferPortal"("playerId");

-- CreateIndex
CREATE INDEX "NilDeal_playerId_idx" ON "NilDeal"("playerId");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "Match_date_idx" ON "Match"("date");

-- CreateIndex
CREATE INDEX "Set_matchId_idx" ON "Set"("matchId");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_playerId_idx" ON "PlayerMatchStat"("playerId");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_matchId_idx" ON "PlayerMatchStat"("matchId");

-- CreateIndex
CREATE INDEX "Poll_week_idx" ON "Poll"("week");

-- CreateIndex
CREATE UNIQUE INDEX "Poll_week_teamId_key" ON "Poll"("week", "teamId");

-- CreateIndex
CREATE INDEX "RPISnapshot_week_idx" ON "RPISnapshot"("week");

-- CreateIndex
CREATE UNIQUE INDEX "RPISnapshot_week_teamId_key" ON "RPISnapshot"("week", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");

-- CreateIndex
CREATE INDEX "Award_seasonYear_idx" ON "Award"("seasonYear");

-- CreateIndex
CREATE UNIQUE INDEX "Booster_teamId_key" ON "Booster"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SaveSlot_name_key" ON "SaveSlot"("name");
