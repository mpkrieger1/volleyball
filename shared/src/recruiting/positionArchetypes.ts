// Sprint 12: per-position rating multipliers + height distribution.
//
// The generator picks a base rating from the star-tier curve, then applies
// these multipliers to each of the 9 player ratings (attack/block/serve/
// pass/set/dig/athleticism/iq/stamina). The result is clamped to [1, 99].
//
// Height means are rough NCAA D-I averages (inches→cm). Real NCAA data
// would refine OPP and DS specifically; revisit post-v1.
//
// Position distribution weights mirror a realistic 15-roster mix:
//   OH 30%, MB 20%, OPP 15%, S 10%, L 10%, DS 15%.

import type { PlayerRatings } from '../sim/ratings';
import type { Position } from './types';

export type RatingMultipliers = Record<keyof PlayerRatings, number>;

export type PositionArchetype = {
  position: Position;
  ratingMultipliers: RatingMultipliers;
  heightMeanCm: number;
  heightSdCm: number;
};

const FLAT: RatingMultipliers = {
  attack: 1.0,
  block: 1.0,
  serve: 1.0,
  pass: 1.0,
  set: 1.0,
  dig: 1.0,
  athleticism: 1.0,
  iq: 1.0,
  stamina: 1.0,
};

function override(base: RatingMultipliers, patch: Partial<RatingMultipliers>): RatingMultipliers {
  return { ...base, ...patch };
}

export const POSITION_ARCHETYPES: Record<Position, PositionArchetype> = {
  OH: {
    position: 'OH',
    ratingMultipliers: override(FLAT, {
      attack: 1.15,
      pass: 1.10,
      serve: 1.05,
      dig: 1.05,
      block: 0.90,
      set: 0.75,
    }),
    heightMeanCm: 185, // ~6'1"
    heightSdCm: 5.5,
  },
  MB: {
    position: 'MB',
    ratingMultipliers: override(FLAT, {
      block: 1.25,
      attack: 1.10,
      athleticism: 1.05,
      pass: 0.70,
      dig: 0.65,
      set: 0.60,
    }),
    heightMeanCm: 191, // ~6'3"
    heightSdCm: 5.0,
  },
  OPP: {
    position: 'OPP',
    ratingMultipliers: override(FLAT, {
      attack: 1.20,
      block: 1.05,
      serve: 1.05,
      pass: 0.80,
      set: 0.70,
      dig: 0.80,
    }),
    heightMeanCm: 188, // ~6'2"
    heightSdCm: 5.5,
  },
  S: {
    position: 'S',
    ratingMultipliers: override(FLAT, {
      set: 1.55,
      iq: 1.15,
      serve: 1.05,
      attack: 0.70,
      block: 0.85,
      dig: 0.95,
    }),
    heightMeanCm: 180, // ~5'11"
    heightSdCm: 5.5,
  },
  L: {
    position: 'L',
    ratingMultipliers: override(FLAT, {
      pass: 1.35,
      dig: 1.30,
      athleticism: 1.10,
      iq: 1.05,
      attack: 0.40,
      block: 0.35,
      set: 0.90,
    }),
    heightMeanCm: 168, // ~5'6"
    heightSdCm: 5.0,
  },
  DS: {
    position: 'DS',
    ratingMultipliers: override(FLAT, {
      pass: 1.25,
      dig: 1.20,
      athleticism: 1.05,
      attack: 0.50,
      block: 0.40,
      set: 0.90,
    }),
    heightMeanCm: 168, // ~5'6"
    heightSdCm: 5.0,
  },
};

export const POSITION_DISTRIBUTION: Array<{ position: Position; weight: number }> = [
  { position: 'OH', weight: 30 },
  { position: 'MB', weight: 20 },
  { position: 'OPP', weight: 15 },
  { position: 'S', weight: 10 },
  { position: 'L', weight: 10 },
  { position: 'DS', weight: 15 },
];
