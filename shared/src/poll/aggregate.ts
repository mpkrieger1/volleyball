// Aggregate 64 ballots into a top-25 poll.
// Points: 1st → 25, 2nd → 24, ..., 25th → 1.

import type { Ballot } from './ballot';

export type PollRow = {
  rank: number;
  teamId: string;
  points: number;
  firstPlaceVotes: number;
};

export function aggregatePoll(ballots: Ballot[]): PollRow[] {
  const points = new Map<string, number>();
  const firstPlace = new Map<string, number>();
  for (const b of ballots) {
    for (let i = 0; i < b.length; i++) {
      const id = b[i]!;
      points.set(id, (points.get(id) ?? 0) + (25 - i));
    }
    if (b.length > 0) {
      const first = b[0]!;
      firstPlace.set(first, (firstPlace.get(first) ?? 0) + 1);
    }
  }

  // Sort by points desc, then firstPlace desc, then teamId asc for determinism.
  const ranked = [...points.entries()]
    .map(([teamId, pts]) => ({
      teamId,
      points: pts,
      firstPlaceVotes: firstPlace.get(teamId) ?? 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.firstPlaceVotes !== a.firstPlaceVotes) return b.firstPlaceVotes - a.firstPlaceVotes;
      return a.teamId.localeCompare(b.teamId);
    });

  return ranked.slice(0, 25).map((r, i) => ({
    rank: i + 1,
    teamId: r.teamId,
    points: r.points,
    firstPlaceVotes: r.firstPlaceVotes,
  }));
}
