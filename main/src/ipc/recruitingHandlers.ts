import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { recruiting, recruitingIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { openRecruitingCycle } from '../recruiting/openRecruitingCycle';
import { performAction } from '../recruiting/performAction';
import { advanceRecruitingWeek } from '../recruiting/advanceRecruitingWeek';
import { closeRecruitingCycle } from '../recruiting/closeRecruitingCycle';

export function registerRecruitingHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.open, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.OpenCycleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await openRecruitingCycle({
        dbPath,
        seasonYear: req.seasonYear,
        ...(req.classSize ? { classSize: req.classSize } : {}),
      });
      return {
        ok: true as const,
        recruitsCreated: result.recruitsCreated,
        interestsSeeded: result.interestsSeeded,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.action, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.ActionRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await performAction({
        dbPath,
        teamId: req.teamId,
        recruitId: req.recruitId,
        action: req.action,
      });
      if (!result.ok) {
        return { ok: false as const, error: { code: result.code, message: result.message } };
      }
      return {
        ok: true as const,
        newInterest: result.newInterest,
        budgetRemaining: result.budgetRemaining,
        week: result.week,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.advance, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.AdvanceRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await advanceRecruitingWeek({
        dbPath,
        userTeamId: req.userTeamId ?? null,
      });
      return {
        ok: true as const,
        week: result.week,
        aiActionsApplied: result.aiActionsApplied,
        commitsResolved: result.commitsResolved,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.close, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.CloseRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await closeRecruitingCycle({ dbPath });
      return { ok: true as const, uncommittedCount: result.uncommittedCount };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.state, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.StateRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
        if (!season) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: 'No Season row.' },
          };
        }
        const week = season.recruitingWeek;
        const budget = await client.recruitingBudget.findUnique({
          where: { teamId_week: { teamId: req.teamId, week } },
        });
        // Sprint 28: budget scales with team staff.
        const staff = await client.coach.findMany({
          where: { teamId: req.teamId },
          select: { role: true, ratingRecruit: true },
        });
        const budgetCalc = recruiting.deriveWeeklyBudget({
          hcRecruit: staff.find((c) => c.role === 'HC')?.ratingRecruit ?? null,
          ahcRecruit: staff.find((c) => c.role === 'AHC')?.ratingRecruit ?? null,
          acRecruit: staff.find((c) => c.role === 'AC')?.ratingRecruit ?? null,
        });
        const budgetRemaining = budgetCalc.total - (budget?.pointsSpent ?? 0);
        // Sprint 28 fix: previously returned ONLY recruits with a
        // RecruitInterest row for this team — that's ~30 entries (the
        // initial board) plus AI replenishments, all skewed to top stars
        // because the Sprint 25 board-scoring fix prioritizes stars.
        // The user reported "only 50 5-stars" because they were seeing
        // their narrow board view, not the full ~3000-recruit class.
        //
        // Now we return:
        //   1. All recruits-with-interest for this team (board members)
        //   2. PLUS all PENDING recruits without an interest row, with
        //      interest=0 (so the user can pick from the full pool —
        //      filter / sort / commit on lower-tier recruits).
        // Renderer treats interest=0 as "off-board"; the existing
        // useTableState filter UI lets the user narrow by star, position,
        // region, etc.
        const [interests, allRecruits] = await Promise.all([
          client.recruitInterest.findMany({
            where: { teamId: req.teamId },
            include: { recruit: true },
            orderBy: [{ interest: 'desc' }],
          }),
          client.recruit.findMany({
            where: { seasonYear: season.year, commitState: 'PENDING' },
            // Recruit table indexes (position, stars, seasonYear) per
            // migration 20260824_000000_recruit_perf_indexes.
          }),
        ]);
        const interestByRecruitId = new Map(
          interests.map((i) => [i.recruit.id, i.interest]),
        );
        // Build a combined map keyed by recruitId — interests first
        // (preserving their source.recruit row), then any PENDING recruit
        // not already covered.
        // Use the same nullability shape as the underlying Recruit schema —
        // height / hometown* are nullable for pre-Sprint-12 saves but
        // every Sprint-12+ generated recruit has them populated. Coerce
        // nulls to safe defaults at the IPC boundary so the renderer's
        // zod schema (non-nullable strings/ints) accepts the response.
        // Sprint 28: also pull leader-team abbr for each recruit (highest
        // interest across all teams) and this team's actionsSpent.
        const allInterestsForLeader = await client.recruitInterest.findMany({
          where: { recruit: { commitState: 'PENDING' } },
          select: { recruitId: true, teamId: true, interest: true },
        });
        const leaderByRecruit = new Map<string, { teamId: string; interest: number }>();
        for (const row of allInterestsForLeader) {
          const cur = leaderByRecruit.get(row.recruitId);
          if (!cur || row.interest > cur.interest) {
            leaderByRecruit.set(row.recruitId, { teamId: row.teamId, interest: row.interest });
          }
        }
        const teamAbbrs = await client.team.findMany({
          select: { id: true, abbr: true },
        });
        const abbrByTeam = new Map(teamAbbrs.map((t) => [t.id, t.abbr]));
        const myActionsByRecruit = new Map<string, number>();
        for (const i of interests) {
          myActionsByRecruit.set(i.recruit.id, i.actionsSpent);
        }

        const combined = new Map<string, {
          recruitId: string;
          firstName: string;
          lastName: string;
          position: string;
          stars: number;
          height: number;
          hometownCity: string;
          hometownState: string;
          hometownRegion: string;
          commitState: string;
          commitTeamId: string | null;
          interest: number;
          actionsSpent: number;
          leaderAbbr: string | null;
        }>();
        const leaderAbbrFor = (recruitId: string): string | null => {
          const lead = leaderByRecruit.get(recruitId);
          if (!lead) return null;
          return abbrByTeam.get(lead.teamId) ?? null;
        };
        for (const i of interests) {
          combined.set(i.recruit.id, {
            recruitId: i.recruit.id,
            firstName: i.recruit.firstName,
            lastName: i.recruit.lastName,
            position: i.recruit.position,
            stars: i.recruit.stars,
            height: i.recruit.height ?? 0,
            hometownCity: i.recruit.hometownCity ?? '',
            hometownState: i.recruit.hometownState ?? '',
            hometownRegion: i.recruit.hometownRegion ?? 'CENTRAL',
            commitState: i.recruit.commitState,
            commitTeamId: i.recruit.commitTeamId,
            interest: i.interest,
            actionsSpent: i.actionsSpent,
            leaderAbbr: leaderAbbrFor(i.recruit.id),
          });
        }
        for (const r of allRecruits) {
          if (combined.has(r.id)) continue;
          combined.set(r.id, {
            recruitId: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            position: r.position,
            stars: r.stars,
            height: r.height ?? 0,
            hometownCity: r.hometownCity ?? '',
            hometownState: r.hometownState ?? '',
            hometownRegion: r.hometownRegion ?? 'CENTRAL',
            commitState: r.commitState,
            commitTeamId: r.commitTeamId,
            interest: interestByRecruitId.get(r.id) ?? 0,
            actionsSpent: myActionsByRecruit.get(r.id) ?? 0,
            leaderAbbr: leaderAbbrFor(r.id),
          });
        }
        return {
          ok: true as const,
          phase: season.phase,
          week,
          budgetRemaining,
          recruits: [...combined.values()],
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 28 Task 28.5B: budget snapshot.
  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.budget, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.BudgetRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
        if (!season) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: 'No Season row.' },
          };
        }
        const week = season.recruitingWeek;
        const staff = await client.coach.findMany({
          where: { teamId: req.teamId },
          select: { role: true, ratingRecruit: true },
        });
        const calc = recruiting.deriveWeeklyBudget({
          hcRecruit: staff.find((c) => c.role === 'HC')?.ratingRecruit ?? null,
          ahcRecruit: staff.find((c) => c.role === 'AHC')?.ratingRecruit ?? null,
          acRecruit: staff.find((c) => c.role === 'AC')?.ratingRecruit ?? null,
        });
        const budget = await client.recruitingBudget.findUnique({
          where: { teamId_week: { teamId: req.teamId, week } },
        });
        const spent = budget?.pointsSpent ?? 0;
        return {
          ok: true as const,
          total: calc.total,
          spent,
          remaining: calc.total - spent,
          breakdown: calc.breakdown,
          week,
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 28 Task 28.5B: roster gap signal.
  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.teamNeeds, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.TeamNeedsRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const players = await client.player.findMany({
          where: { teamId: req.teamId },
          select: { position: true, classYear: true },
        });
        const counts = new Map<string, { roster: number; graduating: number }>();
        const positions = ['S', 'OH', 'MB', 'OPP', 'L', 'DS'];
        for (const p of positions) counts.set(p, { roster: 0, graduating: 0 });
        for (const p of players) {
          const c = counts.get(p.position) ?? { roster: 0, graduating: 0 };
          c.roster += 1;
          if (p.classYear === 'SR' || p.classYear === 'GR') c.graduating += 1;
          counts.set(p.position, c);
        }
        const TARGET: Record<string, number> = { S: 2, OH: 4, MB: 3, OPP: 2, L: 1, DS: 2 };
        const needs = positions.map((pos) => {
          const c = counts.get(pos)!;
          const post = c.roster - c.graduating;
          const target = TARGET[pos] ?? 2;
          return {
            position: pos,
            rosterCount: c.roster,
            graduatingCount: c.graduating,
            thinness: Math.max(0, target - post),
          };
        });
        needs.sort((a, b) => b.thinness - a.thinness);
        return { ok: true as const, needs };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 28 Task 28.5B: full recruit detail (modal payload).
  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.detail, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.DetailRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const recruit = await client.recruit.findUnique({ where: { id: req.recruitId } });
        if (!recruit) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: 'Recruit not found.' },
          };
        }
        const interests = await client.recruitInterest.findMany({
          where: { recruitId: req.recruitId },
          orderBy: { interest: 'desc' },
          take: 5,
        });
        const myInterest = await client.recruitInterest.findUnique({
          where: { recruitId_teamId: { recruitId: req.recruitId, teamId: req.teamId } },
        });
        const teamAbbrs = await client.team.findMany({
          where: { id: { in: interests.map((i) => i.teamId) } },
          select: { id: true, abbr: true },
        });
        const abbrByTeam = new Map(teamAbbrs.map((t) => [t.id, t.abbr]));
        const interestMeter = interests.map((i) => ({
          teamId: i.teamId,
          teamAbbr: abbrByTeam.get(i.teamId) ?? '???',
          interest: i.interest,
          isUserTeam: i.teamId === req.teamId,
        }));

        const scoutLevel = myInterest?.scoutLevel ?? 0;
        const scoutReport = buildScoutReport(recruit.ratingsJson, scoutLevel);

        return {
          ok: true as const,
          detail: {
            recruitId: recruit.id,
            firstName: recruit.firstName,
            lastName: recruit.lastName,
            position: recruit.position,
            stars: recruit.stars,
            height: recruit.height ?? null,
            hometownCity: recruit.hometownCity ?? null,
            hometownState: recruit.hometownState ?? null,
            hometownRegion: recruit.hometownRegion ?? null,
            commitState: recruit.commitState,
            commitTeamId: recruit.commitTeamId,
            scoutLevel,
            scoutReport,
            interestMeter,
            actionsSpent: myInterest?.actionsSpent ?? 0,
          },
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}

function buildScoutReport(
  ratingsJson: string,
  scoutLevel: number,
): Array<{ skill: string; grade: 'A' | 'B' | 'C' | 'D' | 'F' | '?' }> {
  const SKILLS: Array<{ key: string; label: string }> = [
    { key: 'attack', label: 'Attack' },
    { key: 'block', label: 'Block' },
    { key: 'serve', label: 'Serve' },
    { key: 'pass', label: 'Pass' },
    { key: 'set', label: 'Set' },
    { key: 'dig', label: 'Dig' },
    { key: 'athleticism', label: 'Athleticism' },
    { key: 'iq', label: 'IQ' },
    { key: 'stamina', label: 'Stamina' },
  ];
  let parsed: Record<string, number> = {};
  try {
    parsed = JSON.parse(ratingsJson) as Record<string, number>;
  } catch {
    parsed = {};
  }
  const revealCount = scoutLevel === 0 ? 0 : scoutLevel === 1 ? 3 : scoutLevel === 2 ? 6 : 9;
  return SKILLS.map((s, idx) => {
    if (idx >= revealCount) return { skill: s.label, grade: '?' as const };
    const v = parsed[s.key] ?? 0;
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (v >= 85) grade = 'A';
    else if (v >= 75) grade = 'B';
    else if (v >= 60) grade = 'C';
    else if (v >= 45) grade = 'D';
    else grade = 'F';
    return { skill: s.label, grade };
  });
}
