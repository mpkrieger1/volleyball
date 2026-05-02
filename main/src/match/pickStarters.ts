// Sprint 18: pick 6 starters per team, in slot order, deterministically.
//
// `lineupFromTeam` (Sprint 6 placeholder) generates synthetic ratings for
// six slots based purely on team prestige + a seed. Persisting box-score
// stats to `PlayerMatchStat` requires real `Player.id` per slot. This
// helper resolves that mapping by picking the team's six "starters" from
// real Player rows.
//
// Slot mapping (matches lineupFromTeam slot 0 = setter convention):
//   slot 0 → S
//   slot 1 → OH (best, by overall rating)
//   slot 2 → MB (best)
//   slot 3 → OPP (or fallback OH/MB)
//   slot 4 → MB (2nd) (or fallback OPP/OH)
//   slot 5 → L  (or fallback DS/OH)
//
// Fallbacks ensure every team produces 6 distinct ids even if a position
// is missing from the roster. The selection is purely rating-based with
// player-id tiebreak — same 6 starters every match for the season.

import type { Prisma, PrismaClient } from '@prisma/client';

type ClientLike = PrismaClient | Prisma.TransactionClient;

const ROSTER_SELECT = {
  id: true,
  position: true,
  isLibero: true,
  ratingAttack: true,
  ratingBlock: true,
  ratingServe: true,
  ratingPass: true,
  ratingSet: true,
  ratingDig: true,
  ratingAthleticism: true,
  ratingIq: true,
  ratingStamina: true,
} as const;

type RosterRow = {
  id: string;
  position: string;
  isLibero: boolean;
  ratingAttack: number;
  ratingBlock: number;
  ratingServe: number;
  ratingPass: number;
  ratingSet: number;
  ratingDig: number;
  ratingAthleticism: number;
  ratingIq: number;
  ratingStamina: number;
};

function overall(p: RosterRow): number {
  return (
    p.ratingAttack +
    p.ratingBlock +
    p.ratingServe +
    p.ratingPass +
    p.ratingSet +
    p.ratingDig +
    p.ratingAthleticism +
    p.ratingIq +
    p.ratingStamina
  ) / 9;
}

export type StarterIds = readonly [string, string, string, string, string, string];

/** Pick 6 starters in slot order from a team's active Player rows. */
export async function pickStartersForTeam(client: ClientLike, teamId: string): Promise<StarterIds> {
  const players: RosterRow[] = await client.player.findMany({
    where: { teamId },
    select: ROSTER_SELECT,
    orderBy: { id: 'asc' },
  });
  return pickStartersFromRoster(teamId, players);
}

/** Batched variant: load N teams' rosters in one query. */
export async function pickStartersForTeams(
  client: ClientLike,
  teamIds: readonly string[],
): Promise<Map<string, StarterIds>> {
  if (teamIds.length === 0) return new Map();
  const players: (RosterRow & { teamId: string })[] = await client.player.findMany({
    where: { teamId: { in: [...teamIds] } },
    select: { ...ROSTER_SELECT, teamId: true },
    orderBy: { id: 'asc' },
  });
  const byTeam = new Map<string, RosterRow[]>();
  for (const p of players) {
    let list = byTeam.get(p.teamId);
    if (!list) {
      list = [];
      byTeam.set(p.teamId, list);
    }
    list.push(p);
  }
  const result = new Map<string, StarterIds>();
  for (const teamId of teamIds) {
    result.set(teamId, pickStartersFromRoster(teamId, byTeam.get(teamId) ?? []));
  }
  return result;
}

/** Pure picker — exposed for tests. */
export function pickStartersFromRoster(teamId: string, roster: RosterRow[]): StarterIds {
  if (roster.length < 6) {
    throw new Error(
      `Team ${teamId} has only ${roster.length} active players — need at least 6 for a lineup.`,
    );
  }

  const byPos = new Map<string, RosterRow[]>();
  for (const p of roster) {
    const key = p.isLibero ? 'L' : p.position;
    let list = byPos.get(key);
    if (!list) {
      list = [];
      byPos.set(key, list);
    }
    list.push(p);
  }
  for (const list of byPos.values()) {
    list.sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id));
  }

  const used = new Set<string>();
  const take = (preferred: string, fallbacks: readonly string[] = []): string | null => {
    for (const pos of [preferred, ...fallbacks]) {
      const pool = byPos.get(pos) ?? [];
      for (const cand of pool) {
        if (!used.has(cand.id)) {
          used.add(cand.id);
          return cand.id;
        }
      }
    }
    return null;
  };
  const takeAny = (): string | null => {
    for (const pool of byPos.values()) {
      for (const cand of pool) {
        if (!used.has(cand.id)) {
          used.add(cand.id);
          return cand.id;
        }
      }
    }
    return null;
  };

  const slots: (string | null)[] = [
    take('S', ['OPP', 'OH']),
    take('OH', ['DS', 'OPP']),
    take('MB', ['OPP', 'OH']),
    take('OPP', ['OH', 'MB']),
    take('MB', ['OPP', 'OH', 'DS']),
    take('L', ['DS', 'OH']),
  ];
  for (let i = 0; i < 6; i++) {
    if (slots[i] == null) slots[i] = takeAny();
  }

  if (slots.some((s) => s == null)) {
    throw new Error(`Team ${teamId} could not fill all 6 lineup slots.`);
  }
  return slots as unknown as StarterIds;
}
