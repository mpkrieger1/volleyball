-- CreateTable
CREATE TABLE "BracketEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonYear" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "autoBid" BOOLEAN NOT NULL DEFAULT false,
    "metricRank" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketEntry_seasonYear_region_seed_key" ON "BracketEntry"("seasonYear", "region", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "BracketEntry_seasonYear_teamId_key" ON "BracketEntry"("seasonYear", "teamId");

-- CreateIndex
CREATE INDEX "BracketEntry_seasonYear_idx" ON "BracketEntry"("seasonYear");
