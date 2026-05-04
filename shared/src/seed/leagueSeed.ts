// League seed for a save-slot DB. Invoked by (1) prisma/seed.ts via the
// standalone tsx script and (2) the main-process save-slot service when
// creating a new slot. Conferences + teams come from CSV; HCs are
// generated deterministically per team via seeded RNG (Sprint 13).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { ConferenceSchema, TeamSchema, type ConferenceInput, type TeamInput } from '../domain/team';
import { TEAM_REGION_OVERRIDES } from './teamRegions';
import { createRng } from '../rng';
import { FIRST_NAMES, LAST_NAMES } from '../recruiting/nameData';
import { weightedPick } from '../recruiting/ratings';
import { generateRosterForTeam } from '../roster/playerGenerator';

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const header = lines[0]!.split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((key, i) => (row[key] = (cells[i] ?? '').trim()));
    return row;
  });
}

export function loadConferencesFrom(repoRoot: string): ConferenceInput[] {
  const rows = parseCsv(readFileSync(resolve(repoRoot, 'prisma/seedData/conferences.csv'), 'utf8'));
  return rows.map((r) =>
    ConferenceSchema.parse({
      id: r.id,
      name: r.name,
      abbr: r.abbr,
      tier: r.tier,
      autoBidEligible: r.autoBidEligible === 'true',
    }),
  );
}

export function loadTeamsFrom(repoRoot: string): TeamInput[] {
  const rows = parseCsv(readFileSync(resolve(repoRoot, 'prisma/seedData/teams.csv'), 'utf8'));
  return rows.map((r) =>
    TeamSchema.parse({
      schoolName: r.schoolName,
      abbr: r.abbr,
      conferenceId: r.conferenceId,
      primaryColor: r.primaryColor,
      secondaryColor: r.secondaryColor,
      prestige: Number(r.prestige),
      logoPath: `placeholder:${r.abbr}`,
    }),
  );
}

/**
 * Sprint 13: derive a deterministic HC recruiting rating from team prestige.
 * Higher-prestige programs tend to have better recruiters; ±10 jitter
 * keeps things interesting. Clamped [30, 95].
 */
export function deriveCoachRecruitRating(teamAbbr: string, prestige: number): number {
  const rng = createRng(`coach-recruit:${teamAbbr}`);
  const jitter = rng.int(-10, 10);
  return Math.max(30, Math.min(95, prestige + jitter));
}

type SeededCoach = {
  firstName: string;
  lastName: string;
  teamId: string;
  role: 'HC' | 'AHC' | 'AC';
  ratingRecruit: number;
  ratingDevelop: number;
  ratingStrategy: number;
  /** Sprint 28: per-role contract value in cents. */
  salaryCents: number;
  /** Sprint 28: contract length in years (1..5 typical). */
  contractYears: number;
};

/**
 * Sprint 28: derive a coach's contract value (salary + years) from role
 * and team prestige. Salaries are modeled on NCAA Division-I women's
 * volleyball pay scales — top programs ($300k+ HC) down to mid-majors
 * ($80–150k HC). Assistants land at 30–60% of HC pay. Returned in cents
 * per CLAUDE.md money convention.
 *
 *   HC  : base $60k + prestige × $3k  (prestige 30 ≈ $150k, 55 ≈ $225k, 92 ≈ $336k)
 *   AHC : base $30k + prestige × $1k  (prestige 30 ≈ $60k,  55 ≈ $85k,  92 ≈ $122k)
 *   AC  : base $25k + prestige × $500 (prestige 30 ≈ $40k,  55 ≈ $52k,  92 ≈ $71k)
 *
 * Contract years: HC 4, AHC 3, AC 2 (uniform; offseason logic varies them
 * via renewals later).
 */
export function deriveCoachContract(
  role: 'HC' | 'AHC' | 'AC',
  prestige: number,
): { salaryCents: number; contractYears: number } {
  let dollars = 0;
  let years = 1;
  if (role === 'HC') {
    dollars = 60_000 + prestige * 3_000;
    years = 4;
  } else if (role === 'AHC') {
    dollars = 30_000 + prestige * 1_000;
    years = 3;
  } else {
    dollars = 25_000 + prestige * 500;
    years = 2;
  }
  return { salaryCents: Math.round(dollars * 100), contractYears: years };
}

/**
 * Generate a deterministic HC per team. Teams are passed AFTER Prisma has
 * assigned their IDs so we can reference them.
 */
export function buildHeadCoachesForTeams(
  teams: Array<{ id: string; abbr: string; prestige: number }>,
): SeededCoach[] {
  return teams.map((t) => {
    const rng = createRng(`coach:${t.abbr}`);
    const firstRng = rng.fork('first');
    const lastRng = rng.fork('last');
    const devRng = rng.fork('develop');
    const stratRng = rng.fork('strategy');
    const first = weightedPick(firstRng, FIRST_NAMES);
    const last = weightedPick(lastRng, LAST_NAMES);
    const contract = deriveCoachContract('HC', t.prestige);
    return {
      firstName: first.name,
      lastName: last.name,
      teamId: t.id,
      role: 'HC',
      ratingRecruit: deriveCoachRecruitRating(t.abbr, t.prestige),
      ratingDevelop: Math.max(30, Math.min(95, t.prestige + devRng.int(-15, 15))),
      ratingStrategy: Math.max(30, Math.min(95, t.prestige + stratRng.int(-15, 15))),
      salaryCents: contract.salaryCents,
      contractYears: contract.contractYears,
    };
  });
}

/**
 * Sprint 17: seed HC + AHC + AC per team. Assistant ratings center near
 * prestige with wider jitter than HC (assistants are a less-filtered pool).
 * Clamped [25, 90] so an elite program's AHC/AC is still competitive but
 * rarely tops their HC.
 */
export function buildStaffForTeams(
  teams: Array<{ id: string; abbr: string; prestige: number }>,
): SeededCoach[] {
  const hcs = buildHeadCoachesForTeams(teams);
  const out: SeededCoach[] = [...hcs];
  for (const role of ['AHC', 'AC'] as const) {
    for (const t of teams) {
      const rng = createRng(`coach:${t.abbr}:${role}`);
      const firstRng = rng.fork('first');
      const lastRng = rng.fork('last');
      const recRng = rng.fork('recruit');
      const devRng = rng.fork('develop');
      const stratRng = rng.fork('strategy');
      const first = weightedPick(firstRng, FIRST_NAMES);
      const last = weightedPick(lastRng, LAST_NAMES);
      // AHC slightly stronger than AC (lead assistant).
      const tilt = role === 'AHC' ? 0 : -5;
      const contract = deriveCoachContract(role, t.prestige);
      out.push({
        firstName: first.name,
        lastName: last.name,
        teamId: t.id,
        role,
        ratingRecruit: Math.max(25, Math.min(90, t.prestige + tilt + recRng.int(-18, 18))),
        ratingDevelop: Math.max(25, Math.min(90, t.prestige + tilt + devRng.int(-18, 18))),
        ratingStrategy: Math.max(25, Math.min(90, t.prestige + tilt + stratRng.int(-18, 18))),
        salaryCents: contract.salaryCents,
        contractYears: contract.contractYears,
      });
    }
  }
  return out;
}

/**
 * Sprint 17: seasonal operating-budget in cents. Used as the debit account
 * for coach firings. Formula: dollars = 100k + prestige × 5k
 *   prestige 30 → $250k
 *   prestige 55 → $375k
 *   prestige 92 → $560k
 */
export function deriveOperatingBudgetCents(prestige: number): number {
  const dollars = 100_000 + prestige * 5_000;
  return Math.round(dollars * 100);
}

/**
 * Sprint 15: derive a seasonal booster-collective budget (cents) from
 * team prestige. Blue-bloods get meaningful NIL budgets; low-majors
 * land in the low-five-figure range. Clamped [$20k, $550k].
 *
 * Formula: dollars = 20,000 + (prestige - 35) × 9,000
 *   prestige 35 →  $20,000 (clamped floor)
 *   prestige 55 → $200,000
 *   prestige 75 → $380,000
 *   prestige 90 → $515,000
 *   prestige 95 → $550,000 (capped)
 */
export function deriveBoosterBudgetCents(prestige: number): number {
  const dollars = 20_000 + (prestige - 35) * 9_000;
  const clamped = Math.max(20_000, Math.min(550_000, dollars));
  return Math.round(clamped * 100);
}

type SeededBooster = {
  teamId: string;
  collectiveBudget: number;
  enthusiasm: number;
};

/**
 * Build 1 Booster per team. Deterministic: given the same team set,
 * produces identical budgets. Enthusiasm starts at 50; Sprint 16
 * (offseason) adjusts it based on last-season performance.
 */
export function buildBoostersForTeams(
  teams: Array<{ id: string; prestige: number }>,
): SeededBooster[] {
  return teams.map((t) => ({
    teamId: t.id,
    collectiveBudget: deriveBoosterBudgetCents(t.prestige),
    enthusiasm: 50,
  }));
}

export async function seedLeagueInto(
  prisma: PrismaClient,
  repoRoot: string,
): Promise<{ conferences: number; teams: number; coaches: number; players: number; boosters: number }> {
  const confs = loadConferencesFrom(repoRoot);
  const teams = loadTeamsFrom(repoRoot);

  await prisma.booster.deleteMany();
  await prisma.player.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.team.deleteMany();
  await prisma.conference.deleteMany();

  await prisma.$transaction([
    prisma.conference.createMany({
      data: confs.map((c) => ({
        id: c.id,
        name: c.name,
        abbr: c.abbr,
        tier: c.tier,
        autoBidEligible: c.autoBidEligible,
      })),
    }),
    prisma.team.createMany({
      data: teams.map((t) => ({
        schoolName: t.schoolName,
        abbr: t.abbr,
        conferenceId: t.conferenceId,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        prestige: t.prestige,
        logoPath: t.logoPath,
        region: TEAM_REGION_OVERRIDES[t.abbr] ?? 'CENTRAL',
        operatingBudgetCents: deriveOperatingBudgetCents(t.prestige),
      })),
    }),
  ]);

  // Seed HC + AHC + AC per team (Sprint 17). Teams now have assigned ids.
  const persistedTeams = await prisma.team.findMany({
    select: { id: true, abbr: true, prestige: true },
  });
  const staff = buildStaffForTeams(persistedTeams);
  const staffChunk = 500;
  for (let off = 0; off < staff.length; off += staffChunk) {
    await prisma.coach.createMany({
      data: staff.slice(off, off + staffChunk).map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        teamId: c.teamId,
        ratingRecruit: c.ratingRecruit,
        ratingDevelop: c.ratingDevelop,
        ratingStrategy: c.ratingStrategy,
        // Sprint 28: real contract values seeded from role + prestige.
        // The Player schema stores `salary` (cents). hireSeason defaults
        // to 2026 in the schema.
        salary: c.salaryCents,
        contractYears: c.contractYears,
      })),
    });
  }

  // Sprint 14 / Sprint 28: seed 17 players per team (NCAA-realistic
  // composition; matches MAX_ROSTER_SIZE). Chunked createMany to avoid
  // SQLite parameter limits.
  const playerRows: Array<{
    teamId: string;
    firstName: string;
    lastName: string;
    position: string;
    classYear: string;
    height: number;
    jersey: number;
    ratingAttack: number;
    ratingBlock: number;
    ratingServe: number;
    ratingPass: number;
    ratingSet: number;
    ratingDig: number;
    ratingAthleticism: number;
    ratingIq: number;
    ratingStamina: number;
    potential: number;
    isLibero: boolean;
  }> = [];
  for (const team of persistedTeams) {
    const roster = generateRosterForTeam(team.abbr, team.prestige);
    for (const p of roster) {
      playerRows.push({
        teamId: team.id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        classYear: p.classYear,
        height: p.height,
        jersey: p.jersey,
        ratingAttack: p.ratings.attack,
        ratingBlock: p.ratings.block,
        ratingServe: p.ratings.serve,
        ratingPass: p.ratings.pass,
        ratingSet: p.ratings.set,
        ratingDig: p.ratings.dig,
        ratingAthleticism: p.ratings.athleticism,
        ratingIq: p.ratings.iq,
        ratingStamina: p.ratings.stamina,
        potential: p.potential,
        isLibero: p.isLibero,
      });
    }
  }
  const CHUNK = 500;
  for (let off = 0; off < playerRows.length; off += CHUNK) {
    await prisma.player.createMany({ data: playerRows.slice(off, off + CHUNK) });
  }

  // Sprint 15: seed 1 booster per team.
  const boosters = buildBoostersForTeams(persistedTeams);
  await prisma.booster.createMany({
    data: boosters.map((b) => ({
      teamId: b.teamId,
      collectiveBudget: b.collectiveBudget,
      enthusiasm: b.enthusiasm,
    })),
  });

  const [c, t, co, pl, bo] = await Promise.all([
    prisma.conference.count(),
    prisma.team.count(),
    prisma.coach.count(),
    prisma.player.count(),
    prisma.booster.count(),
  ]);
  return { conferences: c, teams: t, coaches: co, players: pl, boosters: bo };
}
