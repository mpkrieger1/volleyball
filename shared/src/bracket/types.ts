// Shared types for Sprint 10 bracket pipeline.

export type BracketMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerId: string;
  /** True when the match was played at a neutral site (no H/A bonus). */
  isNeutralSite: boolean;
};

export type TeamRow = {
  id: string;
  abbr: string;
  schoolName: string;
  conferenceId: string;
  /** Used by seeder as a soft regional-host preference. */
  region: string;
};

export type ConferenceRow = {
  id: string;
  abbr: string;
  autoBidEligible: boolean;
};

export type MetricRank = {
  teamId: string;
  /** Scaled ×1000 integer. Higher is better. */
  metric: number;
  /** 1-based rank within the full metric-ranked field. */
  rank: number;
};

export const REGIONS = ['REGION_1', 'REGION_2', 'REGION_3', 'REGION_4'] as const;
export type BracketRegion = (typeof REGIONS)[number];

export type BracketEntryRow = {
  teamId: string;
  region: BracketRegion;
  seed: number; // 1..16
  autoBid: boolean;
  metricRank: number; // 1..N from the chosen metric
};
