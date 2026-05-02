// Sprint 16: scholarship-cap enforcement. Cuts the weakest players when
// a team's roster exceeds SCHOLARSHIP_CAP. Pure deterministic function.

export const SCHOLARSHIP_CAP = 15;

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
