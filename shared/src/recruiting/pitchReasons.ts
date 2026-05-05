// Sprint 36 Task 36.2 — pitch reasons.
//
// Two reason types fire per (team, recruit):
//   - COACH_PEDIGREE: HC's career national + conference championship history.
//   - COACH_CONNECTION: best of HC/AHC/AC hometownState vs recruit hometownState.
//
// Each reason returns 0..50 pts. Total active points capped at
// MAX_TOTAL_PITCH_BONUS=75 (matches FCCD constant exactly).
//
// Active flags are deterministic per recruit.id so a save-reload produces
// the same set of "what does this recruit care about?" decisions.
//
// Pure module — no IO, no Prisma. The IPC handler computes the
// `ChampionshipsHistory` from `Season.nationalChampionTeamId` +
// `Match.tournamentRound==='CT_F'` rows and passes it in.

import { createRng } from '../rng';

export type PitchReasonType = 'COACH_PEDIGREE' | 'COACH_CONNECTION';

export interface PitchReasonResult {
  type: PitchReasonType;
  active: boolean;
  points: number;
  flavorText: string;
}

export interface ChampionshipsHistory {
  coachId: string;
  nationalChampYears: number[];
  confChampYears: number[];
}

export interface PitchCoach {
  id: string;
  role: 'HC' | 'AHC' | 'AC';
  hometownState: string | null;
}

export interface PitchRecruit {
  id: string;
  stars: number;
  hometownState: string;
  hometownRegion: string;
}

export interface PitchTeam {
  id: string;
  region: string;
}

export interface ComputePitchReasonsArgs {
  team: PitchTeam;
  coaches: PitchCoach[];
  hcChampionships: ChampionshipsHistory | null;
  recruit: PitchRecruit;
}

/** FCCD constant: max total pitch bonus across both reasons. */
export const MAX_TOTAL_PITCH_BONUS = 75;

/** Per-reason caps. */
const PEDIGREE_NAT_CAP = 30;
const PEDIGREE_CONF_CAP = 25;
const CONNECTION_SAME_STATE = 20;
const CONNECTION_SAME_REGION = 10;

function computePedigreePoints(history: ChampionshipsHistory | null): number {
  if (!history) return 0;
  const nat = Math.min(PEDIGREE_NAT_CAP, 10 * history.nationalChampYears.length);
  const conf = Math.min(PEDIGREE_CONF_CAP, 5 * history.confChampYears.length);
  return nat + conf;
}

function pedigreeFlavor(history: ChampionshipsHistory | null, hcCoach: PitchCoach | null): string {
  if (!history || !hcCoach) {
    return "Coach hasn't built a championship resume yet.";
  }
  const nat = history.nationalChampYears.length;
  const conf = history.confChampYears.length;
  if (nat === 0 && conf === 0) {
    return "Coach hasn't won any titles yet.";
  }
  const parts: string[] = [];
  if (nat > 0) parts.push(`${nat} national championship${nat === 1 ? '' : 's'}`);
  if (conf > 0) parts.push(`${conf} conference championship${conf === 1 ? '' : 's'}`);
  return `Coach has won ${parts.join(' and ')}.`;
}

function computeConnectionPoints(args: {
  coaches: PitchCoach[];
  recruit: PitchRecruit;
}): { points: number; bestCoach: PitchCoach | null } {
  let best: { coach: PitchCoach; points: number } | null = null;
  for (const c of args.coaches) {
    if (!c.hometownState) continue;
    let points = 0;
    if (c.hometownState === args.recruit.hometownState) {
      points = CONNECTION_SAME_STATE;
    } else if (c.hometownState && hasSameRegion(c.hometownState, args.recruit.hometownRegion)) {
      points = CONNECTION_SAME_REGION;
    }
    if (!best || points > best.points) {
      best = { coach: c, points };
    }
  }
  return { points: best?.points ?? 0, bestCoach: best?.coach ?? null };
}

function connectionFlavor(args: {
  bestCoach: PitchCoach | null;
  points: number;
  recruit: PitchRecruit;
}): string {
  if (args.points === 0 || !args.bestCoach) {
    return `None of the staff has a connection to the recruit's home state of ${args.recruit.hometownState}.`;
  }
  if (args.points === CONNECTION_SAME_STATE) {
    return `${args.bestCoach.role} from ${args.bestCoach.hometownState} — the same state as the recruit.`;
  }
  return `${args.bestCoach.role} is from the same region as the recruit.`;
}

/**
 * State-region adjacency check. Reuses the region grouping from
 * `STATES_BY_REGION` (Sprint 35 in `shared/src/seed/leagueSeed.ts`). Two
 * states are "same region" if both fall into the same recruit-region bucket.
 *
 * v1.2 doesn't import the seed module here (would create a cyclic dep
 * because seed pulls types from recruiting). Hand-inline the lookup.
 */
const STATES_BY_REGION_LOCAL: Record<string, readonly string[]> = {
  EAST: ['MA', 'NY', 'NJ', 'PA', 'CT', 'RI', 'VT', 'NH', 'ME', 'MD', 'DE', 'VA', 'NC', 'SC', 'GA', 'FL', 'WV', 'DC'],
  CENTRAL: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA', 'TX', 'OK'],
  MOUNTAIN: ['MT', 'WY', 'CO', 'UT', 'ID', 'NV', 'AZ', 'NM'],
  PACIFIC: ['CA', 'OR', 'WA', 'AK', 'HI'],
};

function hasSameRegion(coachState: string, recruitRegion: string): boolean {
  const states = STATES_BY_REGION_LOCAL[recruitRegion];
  return Boolean(states && states.includes(coachState));
}

/**
 * Active-flag determinism: deterministic per recruit.id so save-reload
 * produces the same active set. FCCD active rules ported as:
 *   - WantsToWin recruits (~30% by id hash) → CoachPedigree always active
 *   - 4★+ recruit not WantsToWin → 30% chance Pedigree active
 *   - ≤3★ recruit not WantsToWin → 50% chance Pedigree active
 *   - All recruits: CoachConnection 75% chance active (high-school baseline)
 */
function deriveActiveFlags(
  recruit: PitchRecruit,
): { pedigreeActive: boolean; connectionActive: boolean } {
  const rng = createRng(`pitch:${recruit.id}`);
  const wantsToWin = rng.next() < 0.3;
  const pedigreeRoll = rng.next();
  const connectionRoll = rng.next();
  const pedigreeActive = wantsToWin || (recruit.stars >= 4 ? pedigreeRoll < 0.3 : pedigreeRoll < 0.5);
  const connectionActive = connectionRoll < 0.75;
  return { pedigreeActive, connectionActive };
}

export function computePitchReasons(args: ComputePitchReasonsArgs): {
  reasons: PitchReasonResult[];
  totalActivePoints: number;
} {
  const hcCoach = args.coaches.find((c) => c.role === 'HC') ?? null;
  const flags = deriveActiveFlags(args.recruit);

  const pedigreePoints = computePedigreePoints(args.hcChampionships);
  const connectionResult = computeConnectionPoints({
    coaches: args.coaches,
    recruit: args.recruit,
  });

  const pedigree: PitchReasonResult = {
    type: 'COACH_PEDIGREE',
    active: flags.pedigreeActive,
    points: pedigreePoints,
    flavorText: pedigreeFlavor(args.hcChampionships, hcCoach),
  };
  const connection: PitchReasonResult = {
    type: 'COACH_CONNECTION',
    active: flags.connectionActive,
    points: connectionResult.points,
    flavorText: connectionFlavor({
      bestCoach: connectionResult.bestCoach,
      points: connectionResult.points,
      recruit: args.recruit,
    }),
  };

  let totalActive = 0;
  if (pedigree.active) totalActive += pedigree.points;
  if (connection.active) totalActive += connection.points;
  totalActive = Math.min(MAX_TOTAL_PITCH_BONUS, totalActive);

  return { reasons: [pedigree, connection], totalActivePoints: totalActive };
}
