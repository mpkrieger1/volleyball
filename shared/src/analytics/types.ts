// Sprint 20: zod schemas for chart datasets. All chart computations are
// pure functions of `MatchPbp` + `MatchBoxScore` (+ opponent block ratings
// for chart 2). PRD §5 Sprint 20: charts must render from box score + PBP
// alone (no separate storage).

import { z } from 'zod';

// --- Chart 1: Rotation-by-rotation hitting% --------------------------------

export const RotationHittingPctDataSchema = z.object({
  /** 6-element array; index = rotation 0..5; value = hitting% scaled ×1000 (matches Sprint 18). */
  home: z.array(z.number().int()).length(6),
  away: z.array(z.number().int()).length(6),
  /** Per-rotation kill / error / total-attack counts (for tooltips and cross-validation). */
  homeCounts: z
    .array(z.object({ kills: z.number().int(), errors: z.number().int(), totalAttacks: z.number().int() }))
    .length(6),
  awayCounts: z
    .array(z.object({ kills: z.number().int(), errors: z.number().int(), totalAttacks: z.number().int() }))
    .length(6),
});
export type RotationHittingPctData = z.infer<typeof RotationHittingPctDataSchema>;

// --- Chart 2: K/set vs opponent block scatter ------------------------------

export const KPerSetVsBlockPointSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
  isHome: z.boolean(),
  killsPerSet: z.number(),
  /** Average opponent lineup block rating (per-match scalar). */
  opponentBlockAvg: z.number(),
  /** Total kills (used for scatter point size). */
  kills: z.number().int().nonnegative(),
});
export type KPerSetVsBlockPoint = z.infer<typeof KPerSetVsBlockPointSchema>;

export const KPerSetVsBlockDataSchema = z.array(KPerSetVsBlockPointSchema);
export type KPerSetVsBlockData = z.infer<typeof KPerSetVsBlockDataSchema>;

// --- Chart 3: Reception grade histogram per player -------------------------

export const ReceptionGradeHistogramRowSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  isHome: z.boolean(),
  /** Counts of reception events per grade (0 = error, 3 = perfect). */
  grade0: z.number().int().nonnegative(),
  grade1: z.number().int().nonnegative(),
  grade2: z.number().int().nonnegative(),
  grade3: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type ReceptionGradeHistogramRow = z.infer<typeof ReceptionGradeHistogramRowSchema>;

export const ReceptionGradeHistogramDataSchema = z.array(ReceptionGradeHistogramRowSchema);
export type ReceptionGradeHistogramData = z.infer<typeof ReceptionGradeHistogramDataSchema>;

// --- Chart 4: Serve location heat map (6-zone court) -----------------------
// Sprint 20 deviation: ServeEvent has no location field. We use the
// receiver's slot as a proxy for where the serve was received (≈ where it
// landed). Slots 0..5 → zones 1..6 via SLOT_TO_ZONE.

export const ServeZoneHeatmapCellSchema = z.object({
  servingTeam: z.enum(['home', 'away']),
  /** Court zones 1..6. Zone 0 reserved for "ace/error pile" (no reception). */
  zone: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  count: z.number().int().nonnegative(),
  aces: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
});
export type ServeZoneHeatmapCell = z.infer<typeof ServeZoneHeatmapCellSchema>;

export const ServeZoneHeatmapDataSchema = z.array(ServeZoneHeatmapCellSchema);
export type ServeZoneHeatmapData = z.infer<typeof ServeZoneHeatmapDataSchema>;

/** Slot 0..5 → court zone 1..6. Mirrors traditional volleyball numbering. */
export const SLOT_TO_ZONE: Record<0 | 1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 5 | 6> = {
  0: 6, // back-middle (server's starting position)
  1: 1, // back-right
  2: 2, // front-right
  3: 3, // front-middle
  4: 4, // front-left
  5: 5, // back-left
};

// --- Chart 5: Rally length distribution + point differential ---------------

export const RALLY_LENGTH_BUCKETS = ['1-3', '4-6', '7-10', '11-15', '16+'] as const;
export type RallyLengthBucket = (typeof RALLY_LENGTH_BUCKETS)[number];

export const RallyLengthBucketRowSchema = z.object({
  bucket: z.enum(RALLY_LENGTH_BUCKETS),
  count: z.number().int().nonnegative(),
  homePoints: z.number().int().nonnegative(),
  awayPoints: z.number().int().nonnegative(),
});
export type RallyLengthBucketRow = z.infer<typeof RallyLengthBucketRowSchema>;

export const RallyLengthDataSchema = z.array(RallyLengthBucketRowSchema);
export type RallyLengthData = z.infer<typeof RallyLengthDataSchema>;
