// Sprint 15: NIL assignment validator.
//
// Checks whether a proposed NIL assignment fits within the team's
// remaining booster budget (accounting for existing NIL deals).

export type ValidateResult =
  | { ok: true }
  | { ok: false; code: 'INSUFFICIENT_BUDGET' | 'INVALID_AMOUNT'; message: string };

export function validateAssignment(
  currentSpentCents: number,
  proposedCents: number,
  previousCents: number, // existing Team Collective deal for this player (replaced, not stacked)
  budgetCents: number,
): ValidateResult {
  if (proposedCents < 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'Amount must be non-negative.' };
  }
  const delta = proposedCents - previousCents;
  const newSpent = currentSpentCents + delta;
  if (newSpent > budgetCents) {
    const over = newSpent - budgetCents;
    return {
      ok: false,
      code: 'INSUFFICIENT_BUDGET',
      message: `Exceeds budget by ${over} cents.`,
    };
  }
  return { ok: true };
}
