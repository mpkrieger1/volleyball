// Sprint 14: user action on a portal target. Deducts weekly points
// budget and applies interest delta. OFFER_NIL additionally persists
// the offer amount for use at commit time.

import { PrismaClient } from '@prisma/client';
import { portal } from '@vcd/shared';

export type PerformPortalActionInput = {
  dbPath: string;
  teamId: string;
  transferPortalId: string;
  action: portal.PortalActionType;
  /** Required when action === 'OFFER_NIL'; cents. */
  nilAmountCents?: number;
};

export type PerformPortalActionResult =
  | {
      ok: true;
      newInterest: number;
      budgetRemaining: number;
      week: number;
    }
  | {
      ok: false;
      code:
        | 'INSUFFICIENT_BUDGET'
        | 'PORTAL_ENTRY_NOT_ACTIVE'
        | 'NOT_PORTAL_PHASE'
        | 'INVALID_NIL_AMOUNT';
      message: string;
    };

export async function performPortalAction(
  input: PerformPortalActionInput,
): Promise<PerformPortalActionResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season || season.phase !== 'PORTAL') {
      return { ok: false, code: 'NOT_PORTAL_PHASE', message: 'No active portal cycle.' };
    }
    const week = season.portalWeek;

    const tp = await client.transferPortal.findUnique({
      where: { id: input.transferPortalId },
    });
    if (!tp || tp.status !== 'ACTIVE') {
      return {
        ok: false,
        code: 'PORTAL_ENTRY_NOT_ACTIVE',
        message: `Portal entry not active (status ${tp?.status ?? 'missing'}).`,
      };
    }

    // Compute cost + delta for the action.
    let cost = 0;
    let delta = 0;
    let nilOffer = 0;
    if (input.action === 'OFFER_NIL') {
      if (!input.nilAmountCents || input.nilAmountCents < 0) {
        return {
          ok: false,
          code: 'INVALID_NIL_AMOUNT',
          message: 'nilAmountCents required and non-negative.',
        };
      }
      nilOffer = Math.min(input.nilAmountCents, portal.PORTAL_NIL_CAP_CENTS);
      cost = portal.OFFER_NIL_COST;
    } else {
      const def = portal.PORTAL_ACTIONS[input.action];
      cost = def.cost;
      delta = def.delta;
    }

    const budget = await client.portalBudget.findUnique({
      where: { teamId_week: { teamId: input.teamId, week } },
    });
    const spent = budget?.pointsSpent ?? 0;
    if (spent + cost > portal.PORTAL_WEEKLY_BUDGET) {
      return {
        ok: false,
        code: 'INSUFFICIENT_BUDGET',
        message: `Action costs ${cost}, only ${portal.PORTAL_WEEKLY_BUDGET - spent} remaining.`,
      };
    }

    const existing = await client.portalInterest.findUnique({
      where: {
        transferPortalId_teamId: {
          transferPortalId: input.transferPortalId,
          teamId: input.teamId,
        },
      },
    });
    const currentInterest = existing?.interest ?? 0;
    let nextInterest = currentInterest + delta;
    if (input.action === 'OFFER_NIL') {
      nextInterest = portal.applyNilBump(currentInterest, nilOffer);
    }
    nextInterest = Math.min(1000, Math.max(0, nextInterest));

    await client.$transaction(
      async (tx) => {
        await tx.portalInterest.upsert({
          where: {
            transferPortalId_teamId: {
              transferPortalId: input.transferPortalId,
              teamId: input.teamId,
            },
          },
          create: {
            transferPortalId: input.transferPortalId,
            teamId: input.teamId,
            interest: nextInterest,
            actionsSpent: 1,
            lastNilOffer: nilOffer,
          },
          update: {
            interest: nextInterest,
            actionsSpent: (existing?.actionsSpent ?? 0) + 1,
            ...(nilOffer > 0 ? { lastNilOffer: nilOffer } : {}),
          },
        });
        if (cost > 0) {
          await tx.portalBudget.upsert({
            where: { teamId_week: { teamId: input.teamId, week } },
            create: { teamId: input.teamId, week, pointsSpent: cost },
            update: { pointsSpent: spent + cost },
          });
        }
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    return {
      ok: true,
      newInterest: nextInterest,
      budgetRemaining: portal.PORTAL_WEEKLY_BUDGET - (spent + cost),
      week,
    };
  } finally {
    await client.$disconnect();
  }
}
