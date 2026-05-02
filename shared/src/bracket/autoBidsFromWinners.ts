// Sprint 11: derive NCAA auto-bids from actual conference tournament winners
// (replacing Sprint 10's top-RPI-per-conference stub).
//
// Input: CT_F matches with their winners + a map of teamId → conferenceId.
// Output: one AutoBidResult per conference whose tournament was completed.

import type { AutoBidResult } from './autoBids';

export type CtFinalMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerId: string;
  bracketGroupKey: string; // = conferenceId for CT matches
};

export function autoBidsFromTournamentWinners(
  ctFinals: CtFinalMatch[],
): AutoBidResult[] {
  const seen = new Set<string>();
  const out: AutoBidResult[] = [];
  for (const m of ctFinals) {
    if (!m.winnerId || seen.has(m.bracketGroupKey)) continue;
    seen.add(m.bracketGroupKey);
    out.push({ teamId: m.winnerId, conferenceId: m.bracketGroupKey });
  }
  return out;
}
