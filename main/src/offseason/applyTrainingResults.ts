// Sprint 33 Task 33.4 — apply FCCD-style training gains to all teams.
//
// At TRAINING_RESULTS in the preseason, each team's 9 picks (3 coaches × 3
// slots) trigger rating gains for every roster player on the focused
// attribute via Sprint 32's curve. AI teams get picks generated lazily
// by `pickAiFocusesForCoach` if no TrainingFocusPick rows exist for them.
//
// Idempotency: keys on TrainingResultEntry rows for the season. If any
// exist, skip.
//
// Determinism: seeded RNG `training:${seasonYear}:${teamId}:${playerId}:${attribute}`.

import type { PrismaClient } from '@prisma/client';
import { createRng, offseason } from '@vcd/shared';
import { pickAiFocusesForCoach } from './aiFocusHeuristic';

type CoachRole = 'HC' | 'AHC' | 'AC';

export type ApplyTrainingResultsInput = {
  client: PrismaClient;
  seasonYear: number;
};

export type ApplyTrainingResultsResult = {
  teamsProcessed: number;
  playersUpdated: number;
  breakthroughs: number;
  skipped: boolean;
};

const RATING_FIELD: Record<offseason.TrainableSkill, keyof PlayerRow> = {
  attack: 'ratingAttack',
  block: 'ratingBlock',
  serve: 'ratingServe',
  pass: 'ratingPass',
  set: 'ratingSet',
  dig: 'ratingDig',
  athleticism: 'ratingAthleticism',
  iq: 'ratingIq',
  stamina: 'ratingStamina',
};

type PlayerRow = {
  id: string;
  teamId: string;
  potential: number;
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

type CoachRow = {
  id: string;
  teamId: string | null;
  role: string;
  ratingDevelop: number;
};

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export async function applyTrainingResults(
  input: ApplyTrainingResultsInput,
): Promise<ApplyTrainingResultsResult> {
  const { client, seasonYear } = input;

  const existing = await client.trainingResultEntry.count({ where: { seasonYear } });
  if (existing > 0) {
    return { teamsProcessed: 0, playersUpdated: 0, breakthroughs: 0, skipped: true };
  }

  const [teams, coaches, players, picks] = await Promise.all([
    client.team.findMany({ select: { id: true, facilitiesLevel: true } }),
    client.coach.findMany({
      where: { teamId: { not: null } },
      select: { id: true, teamId: true, role: true, ratingDevelop: true },
    }),
    client.player.findMany({
      select: {
        id: true,
        teamId: true,
        potential: true,
        ratingAttack: true,
        ratingBlock: true,
        ratingServe: true,
        ratingPass: true,
        ratingSet: true,
        ratingDig: true,
        ratingAthleticism: true,
        ratingIq: true,
        ratingStamina: true,
      },
    }),
    client.trainingFocusPick.findMany({ where: { seasonYear } }),
  ]);

  const playersByTeam = new Map<string, PlayerRow[]>();
  for (const p of players) {
    const arr = playersByTeam.get(p.teamId) ?? [];
    arr.push(p);
    playersByTeam.set(p.teamId, arr);
  }
  const coachesByTeamRole = new Map<string, CoachRow[]>();
  for (const c of coaches as CoachRow[]) {
    if (!c.teamId) continue;
    const k = `${c.teamId}:${c.role}`;
    const arr = coachesByTeamRole.get(k) ?? [];
    arr.push(c);
    coachesByTeamRole.set(k, arr);
  }
  const picksByTeamCoachSlot = new Map<string, string>();
  for (const p of picks) {
    picksByTeamCoachSlot.set(`${p.teamId}:${p.coachId}:${p.slotIndex}`, p.attribute);
  }

  const ROLES: CoachRole[] = ['HC', 'AHC', 'AC'];

  let teamsProcessed = 0;
  let playersUpdated = 0;
  let breakthroughs = 0;

  type ResultEntry = {
    seasonYear: number;
    teamId: string;
    playerId: string;
    attribute: string;
    gainApplied: number;
    wasBreakthrough: boolean;
  };
  type PlayerUpdate = { id: string; field: keyof PlayerRow; newValue: number };

  const allResults: ResultEntry[] = [];
  const allUpdates: PlayerUpdate[] = [];

  for (const team of teams) {
    const teamPlayers = playersByTeam.get(team.id) ?? [];
    if (teamPlayers.length === 0) continue;
    teamsProcessed += 1;

    // Collect 9 picks for this team in deterministic role+slot order.
    const teamPicks: Array<{ coach: CoachRow; slotIndex: number; attribute: offseason.TrainableSkill }> = [];
    for (const role of ROLES) {
      const roleCoaches = (coachesByTeamRole.get(`${team.id}:${role}`) ?? []).slice(0, 1);
      const coach = roleCoaches[0];
      if (!coach) continue; // missing coach for this role — skip its 3 slots
      const validFocuses = offseason.getValidTrainingFocuses(role);
      const aiFocuses = pickAiFocusesForCoach({
        role,
        roster: teamPlayers,
        facilitiesLevel: team.facilitiesLevel,
      });
      for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
        const userPick = picksByTeamCoachSlot.get(`${team.id}:${coach.id}:${slotIndex}`);
        const attribute =
          (userPick && validFocuses.includes(userPick as offseason.TrainableSkill)
            ? (userPick as offseason.TrainableSkill)
            : aiFocuses[slotIndex]) ?? validFocuses[0]!;
        teamPicks.push({ coach, slotIndex, attribute });
      }
    }

    // Track repeated-focus counts for each attribute as we apply picks.
    const repeatedCount = new Map<string, number>();

    for (const pick of teamPicks) {
      const repeats = repeatedCount.get(pick.attribute) ?? 0;
      repeatedCount.set(pick.attribute, repeats + 1);

      const repeatedMult = offseason.getRepeatedFocusMultiplier(repeats);
      const coachBonus = clamp((pick.coach.ratingDevelop - 50) / 5, 0, 30);

      const field = RATING_FIELD[pick.attribute];
      for (const player of teamPlayers) {
        const currentRating = player[field] as number;
        const range = offseason.getTrainingGainAmountRange({
          potential: player.potential,
          currentRating,
          facilitiesLevel: team.facilitiesLevel,
          isFocused: true,
        });
        const breakthroughChance = offseason.getTrainingBreakthroughChance({
          potential: player.potential,
          coachBreakthroughBonus: coachBonus,
          repeatedFocusCount: repeats,
        });
        const rng = createRng(
          `training:${seasonYear}:${team.id}:${player.id}:${pick.attribute}:${pick.slotIndex}`,
        );
        const rawGain = rng.int(range.min, range.max);
        const gain = Math.round(rawGain * repeatedMult);
        const wasBreakthrough = rng.chance(breakthroughChance);
        const breakthroughBonus = wasBreakthrough ? 2 : 0;
        const cap = Math.min(100, player.potential);
        const newValue = clamp(currentRating + gain + breakthroughBonus, 0, cap);

        const actualGain = newValue - currentRating;
        if (actualGain !== 0) {
          allUpdates.push({ id: player.id, field, newValue });
          (player[field] as number) = newValue;
        }
        allResults.push({
          seasonYear,
          teamId: team.id,
          playerId: player.id,
          attribute: pick.attribute,
          gainApplied: actualGain,
          wasBreakthrough,
        });
        if (wasBreakthrough) breakthroughs += 1;
      }
    }
  }

  // Apply player updates. Use $transaction array form for bulk writes
  // (CLAUDE.md "From Sprint 13": no Promise.all for >100 SQLite writes).
  if (allUpdates.length > 0) {
    const CHUNK = 200;
    for (let off = 0; off < allUpdates.length; off += CHUNK) {
      const slice = allUpdates.slice(off, off + CHUNK);
      await client.$transaction(
        slice.map((u) =>
          client.player.update({
            where: { id: u.id },
            data: { [u.field]: u.newValue },
          }),
        ),
      );
    }
    playersUpdated = new Set(allUpdates.map((u) => u.id)).size;
  }

  // Insert TrainingResultEntry rows in chunks.
  if (allResults.length > 0) {
    const CHUNK = 500;
    for (let off = 0; off < allResults.length; off += CHUNK) {
      await client.trainingResultEntry.createMany({
        data: allResults.slice(off, off + CHUNK),
      });
    }
  }

  return { teamsProcessed, playersUpdated, breakthroughs, skipped: false };
}
