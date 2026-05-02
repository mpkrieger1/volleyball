-- Sprint 25 (P1.2): add onDelete:Cascade from PlayerMatchStat → Player.
-- Pre-Sprint-25, the FK was RESTRICT; every Player-deletion path had to
-- manually `tx.playerMatchStat.deleteMany` first. Latent footgun for any
-- future deletion code (transfer portal, manual roster prune).
--
-- SQLite doesn't support `ALTER TABLE` to change FK actions, so we follow
-- Prisma's standard table-rebuild pattern: create a new table with the
-- correct FK, copy data, drop old, rename, recreate indexes.

PRAGMA foreign_keys = OFF;

CREATE TABLE "new_PlayerMatchStat" (
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
    CONSTRAINT "PlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PlayerMatchStat" (
    "id", "playerId", "matchId",
    "kills", "errors", "totalAttacks", "hittingPct", "assists",
    "serviceAces", "serviceErrors", "receptionErrors", "digs",
    "blockSolos", "blockAssists", "rotationMinutes"
)
SELECT
    "id", "playerId", "matchId",
    "kills", "errors", "totalAttacks", "hittingPct", "assists",
    "serviceAces", "serviceErrors", "receptionErrors", "digs",
    "blockSolos", "blockAssists", "rotationMinutes"
FROM "PlayerMatchStat";

DROP TABLE "PlayerMatchStat";
ALTER TABLE "new_PlayerMatchStat" RENAME TO "PlayerMatchStat";

CREATE INDEX "PlayerMatchStat_playerId_idx" ON "PlayerMatchStat"("playerId");
CREATE INDEX "PlayerMatchStat_matchId_idx" ON "PlayerMatchStat"("matchId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
