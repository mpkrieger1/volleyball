-- Sprint 29 Task 29.5: live-mode persistence columns.
--
-- liveStateJson:    serialized LiveMatchState when a live match is paused
--                   mid-play. Cleared on completion or "Sim Rest."
-- coachActionsJson: audit trail of coach actions for matches played in
--                   Live mode. NULL for sim-only matches; "[]" or non-empty
--                   JSON array otherwise.
--
-- Both columns are nullable + default NULL, so existing matches load
-- unchanged (CLAUDE.md §Critical rules #6 forward-compat).
ALTER TABLE "Match" ADD COLUMN "liveStateJson" TEXT;
ALTER TABLE "Match" ADD COLUMN "coachActionsJson" TEXT;
