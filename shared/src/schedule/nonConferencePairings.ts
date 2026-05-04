// Non-conference matchups. Greedy pairing with soft constraints:
//   - Per-team budget: each team plays exactly NONCONF_GAMES_PER_TEAM (Sprint 28: 10).
//   - Travel sanity: ≤ 3 cross-region away trips per team (soft; relaxes if
//     otherwise unsatisfiable for small conferences).
//   - Home/away balance: within 2 of even across the season.
//
// Sprint 28 change: target is now PER-TEAM (10 each), not total-match budget.
// Replaces Sprint 7's "aim for 30 total" model. Conference count is no longer
// subtracted from the per-team target — every team plays exactly 10 non-con
// regardless of conference size.

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
  /** Sprint 28: each team plays exactly this many non-con games. */
  nonConfGamesPerTeam: number;
  maxCrossRegionTrips: number; // 3
};

export const NONCONF_GAMES_PER_TEAM = 10;

export const DEFAULT_NONCONF_CONSTRAINTS: NonConferenceConstraints = {
  nonConfGamesPerTeam: NONCONF_GAMES_PER_TEAM,
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

  // Quota per team = remaining non-con games to schedule.
  const quota = (t: TeamState): number =>
    Math.max(0, constraints.nonConfGamesPerTeam - t.nonConfCount);

  // Deterministic team order: shuffled once per seed.
  const teamIds = teams.map((t) => t.id);
  for (let i = teamIds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [teamIds[i], teamIds[j]] = [teamIds[j]!, teamIds[i]!];
  }

  // Multi-pass: each pass, attempt one pairing per team with the deepest quota.
  // strictness=0 = travel cap respected; strictness=1 = relaxed (cap ignored).
  // We do 20 strict passes, then if any team is still under-quota, run up to 20
  // relaxed passes to fill the gap.
  const runPasses = (strictness: 0 | 1): void => {
    const maxPasses = 20;
    for (let pass = 0; pass < maxPasses; pass++) {
      let progress = false;
      const ordered = [...teamIds].sort((a, b) => {
        const ta = state.get(a)!;
        const tb = state.get(b)!;
        return quota(tb) - quota(ta);
      });
      for (const id of ordered) {
        const me = state.get(id)!;
        if (quota(me) === 0) continue;
        const opp = pickOpponent(me, state, teamIds, constraints, rng, strictness);
        if (!opp) continue;
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
  };

  runPasses(0);
  // Any team still under quota? Run relaxed passes (drops the travel cap).
  if (teamIds.some((id) => quota(state.get(id)!) > 0)) runPasses(1);

  // Reconciliation phase 1: pair under-quota teams from different confs directly.
  for (let iter = 0; iter < 5; iter += 1) {
    const shorts = teamIds.filter((id) => quota(state.get(id)!) > 0);
    if (shorts.length === 0) break;
    let progress = false;
    for (let i = 0; i < shorts.length; i += 1) {
      for (let j = i + 1; j < shorts.length; j += 1) {
        const a = state.get(shorts[i]!)!;
        const b = state.get(shorts[j]!)!;
        if (quota(a) === 0 || quota(b) === 0) continue;
        if (a.conferenceId === b.conferenceId) continue;
        if ((a.paired.get(b.id) ?? 0) >= 3) continue;
        addPairing(a, b, pairings);
        progress = true;
      }
    }
    if (!progress) break;
  }

  // Reconciliation phase 2: 2-swap. Any two same-conf shorts (T1, T2) get rescued
  // by finding a pairing (X, Y) we can break to add (X, T1) and (Y, T2). X must
  // be in a different conf than T1, Y must be in a different conf than T2, and
  // X, Y must be in different confs from each other (already true since they
  // were a non-con pair).
  for (let iter = 0; iter < 10; iter += 1) {
    const shorts = teamIds.filter((id) => quota(state.get(id)!) > 0);
    if (shorts.length < 2) break;
    let progress = false;
    outer: for (let i = 0; i < shorts.length; i += 1) {
      for (let j = i + 1; j < shorts.length; j += 1) {
        const t1 = state.get(shorts[i]!)!;
        const t2 = state.get(shorts[j]!)!;
        if (quota(t1) === 0 || quota(t2) === 0) continue;
        // Try every existing pairing as donor.
        for (let k = 0; k < pairings.length; k += 1) {
          const p = pairings[k]!;
          const x = state.get(p.homeTeamId)!;
          const y = state.get(p.awayTeamId)!;
          // x assigned to t1, y assigned to t2 (try both orientations).
          if (canSwap(x, y, t1, t2)) {
            removePairing(x, y, pairings, k);
            addPairing(x, t1, pairings);
            addPairing(y, t2, pairings);
            progress = true;
            break outer;
          }
          if (canSwap(y, x, t1, t2)) {
            removePairing(x, y, pairings, k);
            addPairing(y, t1, pairings);
            addPairing(x, t2, pairings);
            progress = true;
            break outer;
          }
        }
      }
    }
    if (!progress) break;
  }

  return pairings;

  function canSwap(x: TeamState, y: TeamState, t1: TeamState, t2: TeamState): boolean {
    if (x.id === t1.id || x.id === t2.id || y.id === t1.id || y.id === t2.id) return false;
    if (x.conferenceId === t1.conferenceId) return false;
    if (y.conferenceId === t2.conferenceId) return false;
    if ((x.paired.get(t1.id) ?? 0) >= 3) return false;
    if ((y.paired.get(t2.id) ?? 0) >= 3) return false;
    return true;
  }

  function addPairing(a: TeamState, b: TeamState, list: NonConferencePairing[]): void {
    const aHome = a.confHome + a.nonConfHome;
    const bHome = b.confHome + b.nonConfHome;
    const aIsHome = aHome <= bHome;
    const home = aIsHome ? a : b;
    const away = aIsHome ? b : a;
    list.push({ homeTeamId: home.id, awayTeamId: away.id });
    a.nonConfCount += 1;
    b.nonConfCount += 1;
    home.nonConfHome += 1;
    away.nonConfAway += 1;
    if (home.region !== away.region) away.crossRegionAway += 1;
    a.paired.set(b.id, (a.paired.get(b.id) ?? 0) + 1);
    b.paired.set(a.id, (b.paired.get(a.id) ?? 0) + 1);
  }

  function removePairing(
    x: TeamState,
    y: TeamState,
    list: NonConferencePairing[],
    idx: number,
  ): void {
    const removed = list[idx]!;
    list.splice(idx, 1);
    x.nonConfCount -= 1;
    y.nonConfCount -= 1;
    if (removed.homeTeamId === x.id) {
      x.nonConfHome -= 1;
      y.nonConfAway -= 1;
      if (x.region !== y.region) y.crossRegionAway -= 1;
    } else {
      y.nonConfHome -= 1;
      x.nonConfAway -= 1;
      if (y.region !== x.region) x.crossRegionAway -= 1;
    }
    x.paired.set(y.id, (x.paired.get(y.id) ?? 0) - 1);
    y.paired.set(x.id, (y.paired.get(x.id) ?? 0) - 1);
  }
}

function pickOpponent(
  me: TeamState,
  state: Map<string, TeamState>,
  allIds: string[],
  constraints: NonConferenceConstraints,
  _rng: Rng,
  strictness: 0 | 1 = 0,
): TeamState | null {
  // Strict pass: same region, different conference, not already paired, travel OK.
  // Relaxed pass (strictness=1): drops the travel cap to fill quotas.
  const candidates: TeamState[] = [];
  // In the relaxed pass we still cap pair count at 3 (rather than 2) so we
  // never schedule the same pair more than three times across the season.
  const pairCap = strictness === 0 ? 2 : 3;
  for (const id of allIds) {
    if (id === me.id) continue;
    const o = state.get(id)!;
    if (o.conferenceId === me.conferenceId) continue;
    if ((me.paired.get(o.id) ?? 0) >= pairCap) continue;
    if (o.nonConfCount >= constraints.nonConfGamesPerTeam) continue;
    if (me.nonConfCount >= constraints.nonConfGamesPerTeam) continue;
    const crossRegion = me.region !== o.region;
    if (crossRegion && strictness === 0) {
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
    const qa = constraints.nonConfGamesPerTeam - a.nonConfCount;
    const qb = constraints.nonConfGamesPerTeam - b.nonConfCount;
    if (qa !== qb) return qb - qa;
    return a.id.localeCompare(b.id);
  });
  return candidates[0]!;
}
