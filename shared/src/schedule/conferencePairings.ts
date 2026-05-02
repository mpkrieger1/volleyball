// Circle-method double round-robin. For N teams:
//   - If N is even: N-1 rounds of N/2 matches each = single round-robin.
//   - If N is odd: N rounds of (N-1)/2 matches (one team sits out per round).
// Double round-robin = mirror with home/away swapped.
//
// Deterministic under a seeded RNG (used only to shuffle the team list at the
// start — the circle method itself is deterministic).

import type { Rng } from '../rng';

export type ConferencePairing = {
  homeTeamId: string;
  awayTeamId: string;
  /** 0-indexed round within the conference's double round-robin. */
  roundIndex: number;
  conferenceId: string;
};

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
  const rounds = n - 1;
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
