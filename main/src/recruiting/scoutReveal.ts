// Sprint 35 Task 35.6 — scout-tier reveal projection.
//
// Maps the existing `RecruitInterest.scoutLevel` (0..3, advanced by SCOUT
// actions) to a 3-tier reveal that strips fields from the IPC payload so
// the renderer doesn't see information it hasn't earned:
//   0    → LOCKED  (position + stars + height + hometown only)
//   1    → PARTIAL (+ top-3 ratings by value + potential RANGE)
//   2-3+ → FULL    (+ all 9 ratings + exact potential)
//
// Pure projection — no IO. Consumed by `recruitingHandlers.ts` in Sprint 36
// when the modal extension wires the UI.

export type ScoutTier = 'LOCKED' | 'PARTIAL' | 'FULL';

export interface RecruitForReveal {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  stars: number;
  height: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  hometownRegion: string | null;
  potential: number | null;
  commitState: string;
  commitmentStatus: string;
  ratingsJson: string;
}

export interface RatingEntry {
  key: string;
  value: number;
}

export interface PotentialRange {
  lo: number;
  hi: number;
}

export interface RecruitDetailProjection {
  tier: ScoutTier;
  // Always present:
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  stars: number;
  height: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  hometownRegion: string | null;
  commitState: string;
  commitmentStatus: string;

  // PARTIAL-only:
  topRatings?: RatingEntry[];
  potentialRange?: PotentialRange;

  // FULL-only:
  ratings?: Record<string, number>;
  potential?: number;
}

const POTENTIAL_RANGE_WINDOW = 50;

function tierFromScoutLevel(scoutLevel: number): ScoutTier {
  if (scoutLevel <= 0) return 'LOCKED';
  if (scoutLevel === 1) return 'PARTIAL';
  return 'FULL';
}

export function projectRecruitDetail(args: {
  recruit: RecruitForReveal;
  scoutLevel: number;
}): RecruitDetailProjection {
  const tier = tierFromScoutLevel(args.scoutLevel);
  const r = args.recruit;
  const base: RecruitDetailProjection = {
    tier,
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    position: r.position,
    stars: r.stars,
    height: r.height,
    hometownCity: r.hometownCity,
    hometownState: r.hometownState,
    hometownRegion: r.hometownRegion,
    commitState: r.commitState,
    commitmentStatus: r.commitmentStatus,
  };

  if (tier === 'LOCKED') return base;

  let ratings: Record<string, number> = {};
  try {
    ratings = JSON.parse(r.ratingsJson) as Record<string, number>;
  } catch {
    // malformed ratings JSON → keep as locked-equivalent
    return base;
  }

  if (tier === 'PARTIAL') {
    // Top-3 ratings by value (alphabetical tiebreak for determinism).
    const entries: RatingEntry[] = Object.entries(ratings)
      .map(([key, value]) => ({ key, value: Number(value) }))
      .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
      .slice(0, 3);
    const potentialRange: PotentialRange | undefined =
      r.potential !== null && r.potential !== undefined
        ? clampedPotentialRange(r.potential)
        : undefined;
    return {
      ...base,
      topRatings: entries,
      ...(potentialRange && { potentialRange }),
    };
  }

  // FULL
  return {
    ...base,
    ratings,
    ...(r.potential !== null && r.potential !== undefined && { potential: r.potential }),
  };
}

function clampedPotentialRange(potential: number): PotentialRange {
  // Symmetric ±25 window clamped to [0, 100].
  const half = POTENTIAL_RANGE_WINDOW / 2;
  let lo = Math.max(0, potential - half);
  let hi = Math.min(100, potential + half);
  // If clamped, slide the window to preserve the requested width when possible.
  if (hi - lo < POTENTIAL_RANGE_WINDOW) {
    if (lo === 0) hi = Math.min(100, lo + POTENTIAL_RANGE_WINDOW);
    if (hi === 100) lo = Math.max(0, hi - POTENTIAL_RANGE_WINDOW);
  }
  return { lo: Math.round(lo), hi: Math.round(hi) };
}
