// Sprint 18: AVCA All-American team composition.
//
// Locked spike: PRD §5 Sprint 18 wording was ambiguous ("1 MB × 2 or OPP").
// User selected the standard AVCA composition: 2 OH + 2 MB + 1 OPP + 1 S + 1 L
// per team = 7 players. Four teams (1st / 2nd / 3rd / Honorable Mention) =
// 28 unique selections per season.

export const AA_COMPOSITION = {
  OH: 2,
  MB: 2,
  OPP: 1,
  S: 1,
  L: 1,
} as const;

export const AA_TEAM_SIZE = (Object.values(AA_COMPOSITION) as number[]).reduce((s, n) => s + n, 0);

export const AA_TEAMS = ['first', 'second', 'third', 'hm'] as const;
export type AaTeam = (typeof AA_TEAMS)[number];

export const AA_CATEGORY = {
  first: 'AA_FIRST',
  second: 'AA_SECOND',
  third: 'AA_THIRD',
  hm: 'AA_HM',
} as const;
export type AaCategory = (typeof AA_CATEGORY)[AaTeam];

/** Total selections per season = AA_TEAM_SIZE × AA_TEAMS.length. */
export const AA_TOTAL_SELECTIONS = AA_TEAM_SIZE * AA_TEAMS.length;
