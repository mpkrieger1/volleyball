// Sprint 17: role-aware coach-rating selection.
//
// Different effects care about different slots:
//   - recruiting effect → AHC (lead recruiter) first, HC fallback
//   - development effect → HC first, AHC fallback
//   - strategy effect    → HC first, AHC fallback
// If no qualifying coach exists, return DEFAULT_RATING (50).

export type CoachLike = {
  role: string; // 'HC' | 'AHC' | 'AC'
  ratingRecruit: number;
  ratingDevelop: number;
  ratingStrategy: number;
};

export type CoachEffect = 'recruiting' | 'development' | 'strategy';

export const DEFAULT_RATING = 50;

const EFFECT_ORDER: Record<CoachEffect, Array<CoachLike['role']>> = {
  recruiting: ['AHC', 'HC', 'AC'],
  development: ['HC', 'AHC', 'AC'],
  strategy: ['HC', 'AHC', 'AC'],
};

const EFFECT_FIELD: Record<CoachEffect, keyof CoachLike> = {
  recruiting: 'ratingRecruit',
  development: 'ratingDevelop',
  strategy: 'ratingStrategy',
};

export function pickCoachRating(coaches: CoachLike[], effect: CoachEffect): number {
  const order = EFFECT_ORDER[effect];
  const field = EFFECT_FIELD[effect];
  for (const role of order) {
    const c = coaches.find((x) => x.role === role);
    if (c) return c[field] as number;
  }
  return DEFAULT_RATING;
}
