-- Sprint 23: per-row encoding tag for Match.pbpJson. Existing rows
-- default to 'json' (legacy plaintext). New writes use 'gzip-base64'.
-- The 'pruned' value indicates the retention utility cleared the row.
ALTER TABLE "Match" ADD COLUMN "pbpEncoding" TEXT NOT NULL DEFAULT 'json';
