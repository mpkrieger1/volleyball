-- Sprint 11: tournament round label + national champion + bracket slot/group.
ALTER TABLE "Match" ADD COLUMN "tournamentRound" TEXT;
ALTER TABLE "Match" ADD COLUMN "bracketSlot" INTEGER;
ALTER TABLE "Match" ADD COLUMN "bracketGroupKey" TEXT;
ALTER TABLE "Season" ADD COLUMN "nationalChampionTeamId" TEXT;
