// Sprint 35 Task 35.3 — legacy-save backfill for the recruiting core.
//
// Three idempotent passes:
//   1. Recruit.prioritiesJson + wantsToLeaveHome — generated from
//      recruit.id via priorityFromId; idempotent (skip rows already set).
//   2. Team.academicsLevel — bumped from default 50 only when the
//      academics CSV has a value > 50; idempotent (skip rows already
//      above 50, since they were either CSV-bumped or hand-edited).
//   3. Coach.hometownState — synthesized via deriveCoachHometownState
//      using the team's region; idempotent (skip rows already set).
//
// Mirrors Sprint 32 backfillFacilitiesLevel pattern.

import type { PrismaClient } from '@prisma/client';
import { recruiting, createRng } from '@vcd/shared';
import { loadTeamAcademics, deriveCoachHometownState } from '@vcd/shared/seed';

export type BackfillRecruitingCoreResult = {
  recruitsBackfilled: number;
  teamsBackfilled: number;
  coachesBackfilled: number;
};

export async function backfillRecruitingCore(
  client: PrismaClient,
  repoRoot: string,
): Promise<BackfillRecruitingCoreResult> {
  // ── 1. Recruit priorities ──────────────────────────────────────
  const recruitsToFix = await client.recruit.findMany({
    where: { prioritiesJson: null },
    select: { id: true },
  });
  let recruitsBackfilled = 0;
  if (recruitsToFix.length > 0) {
    const updates: Array<{ id: string; prioritiesJson: string; wantsToLeaveHome: boolean }> = [];
    for (const r of recruitsToFix) {
      const p = recruiting.priorityFromId(r.id);
      updates.push({
        id: r.id,
        prioritiesJson: JSON.stringify(p.priorities),
        wantsToLeaveHome: p.wantsToLeaveHome,
      });
    }
    // CLAUDE.md "From Sprint 13": no Promise.all of 100+ writes; use
    // $transaction array form, chunked.
    const CHUNK = 200;
    for (let off = 0; off < updates.length; off += CHUNK) {
      const slice = updates.slice(off, off + CHUNK);
      await client.$transaction(
        slice.map((u) =>
          client.recruit.update({
            where: { id: u.id },
            data: {
              prioritiesJson: u.prioritiesJson,
              wantsToLeaveHome: u.wantsToLeaveHome,
            },
          }),
        ),
      );
    }
    recruitsBackfilled = updates.length;
  }

  // ── 2. Team academicsLevel ─────────────────────────────────────
  const academicsByAbbr = loadTeamAcademics(repoRoot);
  const teamsToFix = await client.team.findMany({
    where: { academicsLevel: 50 },
    select: { id: true, abbr: true },
  });
  let teamsBackfilled = 0;
  for (const t of teamsToFix) {
    const target = academicsByAbbr.get(t.abbr);
    if (target === undefined || target === 50) continue;
    await client.team.update({
      where: { id: t.id },
      data: { academicsLevel: target },
    });
    teamsBackfilled += 1;
  }

  // ── 3. Coach hometownState ─────────────────────────────────────
  const coachesToFix = await client.coach.findMany({
    where: { hometownState: null, teamId: { not: null } },
    select: {
      id: true,
      teamId: true,
      role: true,
      firstName: true,
      lastName: true,
      team: { select: { region: true } },
    },
  });
  let coachesBackfilled = 0;
  if (coachesToFix.length > 0) {
    const updates: Array<{ id: string; hometownState: string }> = [];
    for (const c of coachesToFix) {
      const region = c.team?.region ?? 'CENTRAL';
      const rng = createRng(`coach-home:${c.teamId}:${c.role}:${c.firstName}:${c.lastName}`);
      updates.push({ id: c.id, hometownState: deriveCoachHometownState(rng, region) });
    }
    const CHUNK = 200;
    for (let off = 0; off < updates.length; off += CHUNK) {
      const slice = updates.slice(off, off + CHUNK);
      await client.$transaction(
        slice.map((u) =>
          client.coach.update({
            where: { id: u.id },
            data: { hometownState: u.hometownState },
          }),
        ),
      );
    }
    coachesBackfilled = updates.length;
  }

  return { recruitsBackfilled, teamsBackfilled, coachesBackfilled };
}
