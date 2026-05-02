// Sprint 6 placeholder: deterministic balanced-ish lineup derived from a team's
// abbreviation + prestige. Sprint 12 replaces this with real Player row
// reads. The `seed` parameter lets callers vary the lineup per-match if needed.

import { createRng, sim } from '@vcd/shared';

export type TeamLike = {
  id: string;
  abbr: string;
  prestige: number;
};

export function lineupFromTeam(team: TeamLike, seed: number | string, side: sim.TeamSide): sim.PlayerLineup {
  const rng = createRng(`${team.id}:${seed}:${side}`);
  // Base rating nudged by prestige (0–100). At prestige 55 the base = 50.
  const base = Math.round(50 + (team.prestige - 55) * 0.4);
  const players: sim.PlayerRatings[] = Array.from({ length: 6 }, (_, i) => {
    // Slot 0 and slot 3 are setters; bump their set rating, lower attack a hair.
    const isSetter = i === 0 || i === 3;
    const jitter = (key: string, range = 12): number => Math.round((rng.fork(`${key}:${i}`).next() - 0.5) * range);
    const clamp = (v: number): number => Math.max(1, Math.min(99, v));
    return {
      attack: clamp(base + jitter('att') + (isSetter ? -6 : 0)),
      block: clamp(base + jitter('blk')),
      serve: clamp(base + jitter('srv')),
      pass: clamp(base + jitter('pss')),
      set: clamp(base + jitter('set') + (isSetter ? 15 : -5)),
      dig: clamp(base + jitter('dig')),
      athleticism: clamp(base + jitter('ath')),
      iq: clamp(base + jitter('iq')),
      stamina: clamp(base + jitter('sta')),
    };
  });
  return { team: side, players: players as sim.PlayerLineup['players'] };
}
