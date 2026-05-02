// Sprint 11: tournament round labels and ordering.

export const TOURNAMENT_ROUNDS = [
  'CT_R1',
  'CT_SF',
  'CT_F',
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
  'NCAA_FF',
  'NCAA_CHAMP',
] as const;
export type TournamentRound = (typeof TOURNAMENT_ROUNDS)[number];

export const CT_ROUNDS: TournamentRound[] = ['CT_R1', 'CT_SF', 'CT_F'];
export const NCAA_ROUNDS: TournamentRound[] = [
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
  'NCAA_FF',
  'NCAA_CHAMP',
];

export function isCtRound(r: TournamentRound): boolean {
  return r.startsWith('CT_');
}
export function isNcaaRound(r: TournamentRound): boolean {
  return r.startsWith('NCAA_');
}

/** Returns the round that follows `r` in the progression, or null at the end. */
export function nextRound(r: TournamentRound): TournamentRound | null {
  const seq = isCtRound(r) ? CT_ROUNDS : NCAA_ROUNDS;
  const i = seq.indexOf(r);
  if (i === -1 || i === seq.length - 1) return null;
  return seq[i + 1]!;
}

/** The literal string used for NCAA global-round bracketGroupKey. */
export const NCAA_GLOBAL_GROUP = 'NCAA';
