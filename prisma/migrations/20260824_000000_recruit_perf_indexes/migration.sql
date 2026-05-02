-- CreateIndex
CREATE INDEX "Recruit_position_idx" ON "Recruit"("position");

-- CreateIndex
CREATE INDEX "Recruit_stars_idx" ON "Recruit"("stars");

-- CreateIndex
CREATE INDEX "Recruit_seasonYear_position_stars_idx" ON "Recruit"("seasonYear", "position", "stars");
