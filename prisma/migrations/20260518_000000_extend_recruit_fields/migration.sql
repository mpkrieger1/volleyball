-- Sprint 12: extend Recruit with physical + hometown fields.
ALTER TABLE "Recruit" ADD COLUMN "height" INTEGER;
ALTER TABLE "Recruit" ADD COLUMN "hometownCity" TEXT;
ALTER TABLE "Recruit" ADD COLUMN "hometownState" TEXT;
ALTER TABLE "Recruit" ADD COLUMN "hometownRegion" TEXT;
ALTER TABLE "Recruit" ADD COLUMN "potential" INTEGER;
