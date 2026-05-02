// Sprint 15: auto-distribute a booster budget across a roster.
//
// Allocates proportionally to player value, clipped to
// [MIN_DEAL_CENTS, MAX_DEAL_PER_PLAYER_CENTS], re-normalized so the
// total never exceeds the budget. Deterministic given inputs.

export const MIN_DEAL_CENTS = 500_00; // $500
export const MAX_DEAL_PER_PLAYER_CENTS = 100_000_00; // $100k

export type DistributeInput = {
  playerId: string;
  value: number; // cents
};

export type Allocation = {
  playerId: string;
  amountCents: number;
};

export function autoDistribute(budgetCents: number, players: DistributeInput[]): Allocation[] {
  if (budgetCents <= 0 || players.length === 0) return [];
  const totalValue = players.reduce((sum, p) => sum + p.value, 0);
  if (totalValue <= 0) return [];

  // First pass: proportional allocation with cap clipping.
  let remaining = budgetCents;
  const result: Allocation[] = [];
  const sorted = players
    .slice()
    .sort((a, b) => b.value - a.value || a.playerId.localeCompare(b.playerId));

  for (const p of sorted) {
    const share = p.value / totalValue;
    const proposed = Math.round(budgetCents * share);
    const capped = Math.min(proposed, MAX_DEAL_PER_PLAYER_CENTS, remaining);
    if (capped < MIN_DEAL_CENTS) continue;
    result.push({ playerId: p.playerId, amountCents: capped });
    remaining -= capped;
  }

  return result;
}
