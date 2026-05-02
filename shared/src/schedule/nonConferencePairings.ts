// Non-conference matchups. Greedy pairing with soft constraints:
//   - Total-match budget: aim for 30, allow [28, 40].
//   - Travel sanity: ≤ 3 cross-region away trips per team (soft; relaxes if
//     otherwise unsatisfiable for small conferences).
//   - Home/away balance: within 2 of even across the season.
//
// The Sprint 7 algorithm is intentionally simple and deterministic under a
// seeded RNG. Optimality is future work; correctness (budget bands +
// byte-identical regeneration) is the Sprint 7 bar.

import type { Rng } from '../rng';
import type { TeamRegion } from '../seed/teamRegions';
import type { ConferencePairing } from './conferencePairings';

export type NonConferencePairing = {
  homeTeamId: string;
  awayTeamId: string;
};

export type TeamForScheduling = {
  id: string;
  conferenceId: string;
  region: TeamRegion;
};

export type NonConferenceConstraints = {
  targetTotal: number; // 30
  minTotal: number; // 28
  maxTotal: number; // 40
  maxCrossRegionTrips: number; // 3
};

export const DEFAULT_NONCONF_CONSTRAINTS: NonConferenceConstraints = {
  targetTotal: 30,
  minTotal: 28,
  maxTotal: 40,
  maxCrossRegionTrips: 3,
};

type TeamState = {
  id: string;
  conferenceId: string;
  region: TeamRegion;
  confCount: number;
  confHome: number;
  confAway: number;
  nonConfCount: number;
  nonConfHome: number;
  nonConfAway: number;
  crossRegionAway: number;
  /** opponentId -> number of times already paired */
  paired: Map<string, number>;
};

function initState(teams: TeamForScheduling[], confPairings: ConferencePairing[]): Map<string, TeamState> {
  const s = new Map<string, TeamState>();
  for (const t of teams) {
    s.set(t.id, {
      id: t.id,
      conferenceId: t.conferenceId,
      region: t.region,
      confCount: 0,
      confHome: 0,
      confAway: 0,
      nonConfCount: 0,
      nonConfHome: 0,
      nonConfAway: 0,
      crossRegionAway: 0,
      paired: new Map(),
    });
  }
  for (const p of confPairings) {
    const h = s.get(p.homeTeamId);
    const a = s.get(p.awayTeamId);
    if (h && a) {
      h.confCount += 1;
      h.confHome += 1;
      a.confCount += 1;
      a.confAway += 1;
      h.paired.set(p.awayTeamId, (h.paired.get(p.awayTeamId) ?? 0) + 1);
      a.paired.set(p.homeTeamId, (a.paired.get(p.homeTeamId) ?? 0) + 1);
    }
  }
  return s;
}

export function generateNonConferencePairings(
  teams: TeamForScheduling[],
  confPairings: ConferencePairing[],
  rng: Rng,
  constraints: NonConferenceConstraints = DEFAULT_NONCONF_CONSTRAINTS,
): NonConferencePairing[] {
  const state = initState(teams, confPairings);
  const pairings: NonConferencePairing[] = [];

  // Quota per team = how many non-conf matches we'd like to add.
  const quota = (t: TeamState): number =>
    Math.max(0, Math.min(constraints.maxTotal, constraints.targetTotal) - t.confCount - t.nonConfCount);

  // Deterministic team order: shuffled once per seed.
  const teamIds = teams.map((t) => t.id);
  for (let i = teamIds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [teamIds[i], teamIds[j]] = [teamIds[j]!, teamIds[i]!];
  }

  // Multi-pass: each pass, attempt one pairing per team with the deepest quota.
  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass++) {
    let progress = false;
    // Sort by remaining quota descending (teams that need matches go first).
    const ordered = [...teamIds].sort((a, b) => {
      const ta = state.get(a)!;
      const tb = state.get(b)!;
      return quota(tb) - quota(ta);
    });

    for (const id of ordered) {
      const me = state.get(id)!;
      if (quota(me) === 0) continue;
      const opp = pickOpponent(me, state, teamIds, constraints, rng);
      if (!opp) continue;
      // Decide home/away. Whichever has more home matches plays away.
      const meHome = me.confHome + me.nonConfHome;
      const oppHome = opp.confHome + opp.nonConfHome;
      const meIsHome = meHome <= oppHome;
      const home = meIsHome ? me : opp;
      const away = meIsHome ? opp : me;
      pairings.push({ homeTeamId: home.id, awayTeamId: away.id });

      me.nonConfCount += 1;
      opp.nonConfCount += 1;
      home.nonConfHome += 1;
      away.nonConfAway += 1;
      if (home.region !== away.region) {
        away.crossRegionAway += 1;
      }
      me.paired.set(opp.id, (me.paired.get(opp.id) ?? 0) + 1);
      opp.paired.set(me.id, (opp.paired.get(me.id) ?? 0) + 1);
      progress = true;
    }
    if (!progress) break;
  }

  return pairings;
}

function pickOpponent(
  me: TeamState,
  state: Map<string, TeamState>,
  allIds: string[],
  constraints: NonConferenceConstraints,
  _rng: Rng,
): TeamState | null {
  // Strict pass: same region, different conference, not already paired, travel OK.
  const candidates: TeamState[] = [];
  for (const id of allIds) {
    if (id === me.id) continue;
    const o = state.get(id)!;
    if (o.conferenceId === me.conferenceId) continue;
    if ((me.paired.get(o.id) ?? 0) >= 2) continue;
    const totalO = o.confCount + o.nonConfCount;
    if (totalO >= constraints.maxTotal) continue;
    const totalMe = me.confCount + me.nonConfCount;
    if (totalMe >= constraints.maxTotal) continue;
    const crossRegion = me.region !== o.region;
    // Pick the away team's cross-region count proactively (whoever ends up away).
    if (crossRegion) {
      const meWouldBeAway = me.confHome + me.nonConfHome > o.confHome + o.nonConfHome;
      if (meWouldBeAway && me.crossRegionAway >= constraints.maxCrossRegionTrips) continue;
      if (!meWouldBeAway && o.crossRegionAway >= constraints.maxCrossRegionTrips) continue;
    }
    candidates.push(o);
  }
  if (candidates.length === 0) return null;

  // Prefer: same region → neither team at travel cap → team with most
  // remaining quota. Stable sort for determinism.
  candidates.sort((a, b) => {
    const sameRegionA = a.region === me.region ? 0 : 1;
    const sameRegionB = b.region === me.region ? 0 : 1;
    if (sameRegionA !== sameRegionB) return sameRegionA - sameRegionB;
    const qa = constraints.targetTotal - a.confCount - a.nonConfCount;
    const qb = constraints.targetTotal - b.confCount - b.nonConfCount;
    if (qa !== qb) return qb - qa;
    return a.id.localeCompare(b.id);
  });
  return candidates[0]!;
}
