// Sprint 16: scholarship-cap enforcement. Cuts the weakest players when
// a team's roster exceeds SCHOLARSHIP_CAP. Pure deterministic function.
//
// Sprint 37 (Task 37.5b): aligned to MAX_ROSTER_SIZE = 17 (Sprint 28).
// Pre-Sprint-28 the roster was ~12-15 players; Sprint 28 widened to 17
// per FCCD parity. The cap-enforcer is invoked during PLAYERS_LEAVING
// (post-graduation, pre-signing-day) so the post-cut roster ceiling
// equals the post-signing ceiling (no mid-offseason squeeze).
export const SCHOLARSHIP_CAP = 17;

export type CapPlayer = {
  id: string;
  overall: number; // 0..100
};

export type CapResult = {
  kept: CapPlayer[];
  cut: CapPlayer[];
};

/**
 * Enforce the cap by ranking players by overall desc (tiebreak by
 * playerId.localeCompare for determinism). Keep the top N; cut the rest.
 */
export function enforceScholarshipCap(roster: CapPlayer[], cap = SCHOLARSHIP_CAP): CapResult {
  const sorted = roster.slice().sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  return {
    kept: sorted.slice(0, cap),
    cut: sorted.slice(cap),
  };
}
