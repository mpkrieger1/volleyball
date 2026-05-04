// Circle-method round-robin, capped at MAX_CONF_ROUNDS_PER_TEAM rounds before
// mirroring. Each team plays `min(N-1, MAX_CONF_ROUNDS_PER_TEAM)` distinct
// opponents; then we mirror to double the games (home/away swapped).
//
// Sprint 28 change: cap = 9 rounds → 18 conf games per team for any conf with
// ≥10 members. Smaller confs play (N-1)*2 games (full double round-robin).
// Replaces the strict double round-robin invariant from Sprint 7.
//
// Deterministic under a seeded RNG (used only to shuffle the team list at the
// start — the circle method itself is deterministic).

import type { Rng } from '../rng';

export type ConferencePairing = {
  homeTeamId: string;
  awayTeamId: string;
  /** 0-indexed round within the conference's pairing schedule. */
  roundIndex: number;
  conferenceId: string;
};

export const MAX_CONF_ROUNDS_PER_TEAM = 9;

/** Fisher-Yates shuffle using the seeded RNG. */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function generateConferencePairings(
  teamIds: string[],
  conferenceId: string,
  rng: Rng,
): ConferencePairing[] {
  if (teamIds.length < 2) return [];
  // Copy and shuffle once so the "who is fixed" rotation is seed-dependent.
  let ids: Array<string | null> = shuffle(teamIds, rng);
  // Odd N: add a bye sentinel.
  const byeAdded = ids.length % 2 === 1;
  if (byeAdded) ids = [...ids, null];

  const n = ids.length;
  // Cap rounds at MAX_CONF_ROUNDS_PER_TEAM so confs ≥10 teams play 18 games
  // after mirroring; smaller confs play (N-1) rounds = full single round-robin.
  const rounds = Math.min(n - 1, MAX_CONF_ROUNDS_PER_TEAM);
  const pairings: ConferencePairing[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]!;
      const b = ids[n - 1 - i]!;
      if (a === null || b === null) continue;
      // Alternate home/away by (round + position) parity so each team's
      // first-half home count is balanced.
      const homeFirst = (r + i) % 2 === 0;
      pairings.push({
        homeTeamId: homeFirst ? a : b,
        awayTeamId: homeFirst ? b : a,
        roundIndex: r,
        conferenceId,
      });
    }
    // Rotate: keep ids[0] fixed, rotate the rest right by 1.
    const fixed = ids[0]!;
    const rest = ids.slice(1);
    rest.unshift(rest.pop()!);
    ids = [fixed, ...rest];
  }

  // Mirror half: same pairs, home/away swapped, rounds continue.
  const mirror = pairings.map((p, idx) => ({
    homeTeamId: p.awayTeamId,
    awayTeamId: p.homeTeamId,
    roundIndex: rounds + p.roundIndex,
    conferenceId: p.conferenceId,
    // idx silences unused; we rely on the sorted ordering.
    _idx: idx,
  }));
  return [...pairings, ...mirror.map(({ _idx: _idx, ...rest }) => rest)];
}
