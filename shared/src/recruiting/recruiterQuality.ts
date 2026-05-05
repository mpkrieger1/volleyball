// Sprint 36 Task 36.4 — recruiter-quality tier derivation.
//
// Pure helper that maps Coach.ratingRecruit to a 4-tier label and a
// multiplier. Consumed by `computeRecruitTeamInterest` (Sprint 35) so
// each coach's contribution to recruit interest scales with their
// recruiting skill.
//
// FCCD parallel: getRecruiterQuality / recruiterQualityMultiplier
// (constants pulled from coreWorker.js module 11671).

export type RecruiterQuality = 'ACE' | 'GREAT' | 'GOOD' | 'MEDIOCRE';

export function getRecruiterQuality(coachRatingRecruit: number): RecruiterQuality {
  if (coachRatingRecruit >= 85) return 'ACE';
  if (coachRatingRecruit >= 70) return 'GREAT';
  if (coachRatingRecruit >= 55) return 'GOOD';
  return 'MEDIOCRE';
}

export const RECRUITER_QUALITY_MULTIPLIER: Record<RecruiterQuality, number> = {
  ACE: 2.0,
  GREAT: 1.66,
  GOOD: 1.33,
  MEDIOCRE: 1.0,
};
