// Per-team per-set timeout ledger. 2 timeouts per set; resets on new set.

import { z } from 'zod';

export const TimeoutLedgerSchema = z.object({
  remaining: z.number().int().min(0).max(2),
  timeoutsCalled: z.array(z.object({ atRallyIdx: z.number().int().nonnegative() })),
});
export type TimeoutLedger = z.infer<typeof TimeoutLedgerSchema>;

export const TIMEOUTS_PER_SET = 2;

export function emptyTimeoutLedger(): TimeoutLedger {
  return { remaining: TIMEOUTS_PER_SET, timeoutsCalled: [] };
}

export type TimeoutResult =
  | { ok: true; ledger: TimeoutLedger }
  | { ok: false; code: 'NO_TIMEOUTS_LEFT'; message: string };

export function attemptTimeout(ledger: TimeoutLedger, rallyIdx: number): TimeoutResult {
  if (ledger.remaining <= 0) {
    return {
      ok: false,
      code: 'NO_TIMEOUTS_LEFT',
      message: `No timeouts remaining this set (used ${ledger.timeoutsCalled.length}).`,
    };
  }
  return {
    ok: true,
    ledger: {
      remaining: ledger.remaining - 1,
      timeoutsCalled: [...ledger.timeoutsCalled, { atRallyIdx: rallyIdx }],
    },
  };
}

export function resetTimeoutLedger(_prev: TimeoutLedger): TimeoutLedger {
  return emptyTimeoutLedger();
}
