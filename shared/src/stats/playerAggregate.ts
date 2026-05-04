// Sprint 28 (Task 28.2): pure stat aggregation across PlayerMatchStat rows.
// Hitting % follows the volume-weighted formula from CLAUDE.md "From
// Sprint 22": (Σkills − Σerrors) / ΣtotalAttacks.

export type PlayerMatchStatRow = {
  kills: number;
  errors: number;
  totalAttacks: number;
  digs: number;
  blockSolos: number;
  blockAssists: number;
  serviceAces: number;
  assists: number;
  rotationMinutes: number;
};

export type PlayerStatsAggregate = {
  /** Approximated from rotationMinutes (proxy until per-set tracking lands). */
  setsPlayed: number;
  matchesPlayed: number;
  kills: number;
  errors: number;
  totalAttacks: number;
  hittingPctMilli: number; // hitting % × 1000
  digs: number;
  blocks: number;
  aces: number;
  assists: number;
};

export function aggregateStats(rows: readonly PlayerMatchStatRow[]): PlayerStatsAggregate {
  let rotationMinutes = 0;
  let kills = 0;
  let errors = 0;
  let totalAttacks = 0;
  let digs = 0;
  let blocks = 0;
  let aces = 0;
  let assists = 0;
  for (const r of rows) {
    rotationMinutes += r.rotationMinutes;
    kills += r.kills;
    errors += r.errors;
    totalAttacks += r.totalAttacks;
    digs += r.digs;
    // Each solo block = 1 block; each block-assist = 0.5 (volleyball convention).
    blocks += r.blockSolos + r.blockAssists * 0.5;
    aces += r.serviceAces;
    assists += r.assists;
  }
  const hittingPct = totalAttacks > 0 ? (kills - errors) / totalAttacks : 0;
  return {
    setsPlayed: rotationMinutes,
    matchesPlayed: rows.length,
    kills,
    errors,
    totalAttacks,
    hittingPctMilli: Math.round(hittingPct * 1000),
    digs,
    blocks: Math.round(blocks),
    aces,
    assists,
  };
}

/**
 * Position-relevant ratings averaged for a "scouting overall" number.
 * Used by the Roster screen for column display only — sim does not consume.
 */
export function deriveOverall(
  position: string,
  ratings: {
    attack: number;
    block: number;
    serve: number;
    pass: number;
    set: number;
    dig: number;
    athleticism: number;
    iq: number;
    stamina: number;
  },
): number {
  const all = ratings.athleticism + ratings.iq + ratings.stamina;
  let positionScore = 0;
  switch (position) {
    case 'OH':
      positionScore = ratings.attack + ratings.serve + ratings.pass + ratings.dig;
      break;
    case 'MB':
      positionScore = ratings.attack + ratings.block + ratings.athleticism;
      break;
    case 'OPP':
      positionScore = ratings.attack + ratings.block + ratings.serve;
      break;
    case 'S':
      positionScore = ratings.set + ratings.iq + ratings.serve;
      break;
    case 'L':
    case 'DS':
      positionScore = ratings.pass + ratings.dig + ratings.athleticism;
      break;
    default:
      positionScore = ratings.attack + ratings.athleticism;
  }
  // Mix: 70% position-specific, 30% all-around.
  const positionAvg = positionScore / (position === 'OH' ? 4 : 3);
  const allAvg = all / 3;
  return Math.round(positionAvg * 0.7 + allAvg * 0.3);
}
