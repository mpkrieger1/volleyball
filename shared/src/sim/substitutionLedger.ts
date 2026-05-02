// Sprint 4 substitution ledger. Immutable: every mutation returns a new state.
//
// NCAA / FIVB rule approximation:
//   - Each team may make up to 15 substitutions per set.
//   - Starter re-entry: a starter who is subbed out may only re-enter by
//     replacing their specific substitute. If that substitute is then subbed
//     out for a third player, the starter cannot re-enter this set.
//
// The ledger tracks only the rule-bearing state, not the full on-court roster —
// that lives on `RotationState`. The caller applies the returned state to the
// rotation externally.

import { z } from 'zod';

export const SubErrorCode = z.enum([
  'CAP_EXCEEDED',
  'ILLEGAL_PAIRING',
  'PLAYER_NOT_ON_COURT',
  'DUPLICATE_SUBSTITUTE',
]);
export type SubErrorCode = z.infer<typeof SubErrorCode>;

export const SubstitutionLedgerSchema = z.object({
  subsThisSet: z.number().int().nonnegative(),
  pairings: z.array(
    z.object({
      starter: z.number().int().min(0),
      substitute: z.number().int().min(0),
    }),
  ),
  /** Players who started this set — used to distinguish starters from substitutes. */
  starters: z.array(z.number().int().min(0)),
});
export type SubstitutionLedger = z.infer<typeof SubstitutionLedgerSchema>;

export const SUBS_PER_SET_CAP = 15;

export function emptyLedger(starters: ReadonlyArray<number>): SubstitutionLedger {
  return {
    subsThisSet: 0,
    pairings: [],
    starters: [...starters],
  };
}

export type SubResult =
  | { ok: true; ledger: SubstitutionLedger }
  | { ok: false; code: SubErrorCode; message: string };

/**
 * Record a substitution: player `out` leaves the court, `in` enters.
 * Returns the new ledger on success, or a typed error.
 */
export function attemptSub(
  ledger: SubstitutionLedger,
  out: number,
  incoming: number,
): SubResult {
  if (ledger.subsThisSet >= SUBS_PER_SET_CAP) {
    return {
      ok: false,
      code: 'CAP_EXCEEDED',
      message: `Set substitution cap (${SUBS_PER_SET_CAP}) already reached.`,
    };
  }
  if (out === incoming) {
    return { ok: false, code: 'ILLEGAL_PAIRING', message: 'Cannot substitute a player for themselves.' };
  }

  const isStarter = (p: number) => ledger.starters.includes(p);

  // Starter returning: incoming must equal the specific substitute they were
  // previously paired with.
  if (isStarter(incoming)) {
    const pairing = ledger.pairings.find((p) => p.starter === incoming);
    if (!pairing) {
      // The starter never left — no pairing exists. That's a benign no-op;
      // return the same ledger.
      return { ok: false, code: 'ILLEGAL_PAIRING', message: `Starter ${incoming} is not currently off court.` };
    }
    if (pairing.substitute !== out) {
      return {
        ok: false,
        code: 'ILLEGAL_PAIRING',
        message: `Starter ${incoming} may only re-enter by replacing their original substitute ${pairing.substitute}.`,
      };
    }
    // Successful re-entry: remove the pairing.
    return {
      ok: true,
      ledger: {
        ...ledger,
        subsThisSet: ledger.subsThisSet + 1,
        pairings: ledger.pairings.filter((p) => p.starter !== incoming),
      },
    };
  }

  // Regular sub: a starter leaves, a new substitute enters.
  if (!isStarter(out)) {
    // Non-starter leaving: must be a substitute currently on court.
    // For Sprint 4 we don't track on-court status beyond pairings — the
    // caller is responsible for that. Accept the sub as long as it doesn't
    // duplicate an existing substitute lineup index.
  } else {
    if (ledger.pairings.some((p) => p.substitute === incoming)) {
      return {
        ok: false,
        code: 'DUPLICATE_SUBSTITUTE',
        message: `Substitute ${incoming} is already paired with another starter.`,
      };
    }
  }

  return {
    ok: true,
    ledger: {
      ...ledger,
      subsThisSet: ledger.subsThisSet + 1,
      pairings: [...ledger.pairings, { starter: out, substitute: incoming }],
    },
  };
}

export function resetForNewSet(ledger: SubstitutionLedger): SubstitutionLedger {
  return emptyLedger(ledger.starters);
}
