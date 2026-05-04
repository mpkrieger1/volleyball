// Date/week assignment. Greedy first-fit across (week, date) slots subject to:
//   - No team plays two matches on the same ISO date.
//   - Non-conference pairings: weeks 0..NON_CONF_LAST_WEEK ONLY (Sprint 28).
//   - Conference pairings: weeks CONF_WEEK_START..13 ONLY (Sprint 28).
//
// Sprint 28 change: strict week separation. Non-con games never appear after
// the non-con block ends, and conf games never appear before. If a match
// can't be placed within its block, the assigner throws — caller is expected
// to keep per-team game counts within block-capacity (10 non-con / 18 conf
// per team fits comfortably in 5 / 9 weeks × 3 dates each).

import type { Rng } from '../rng';
import type { ConferencePairing } from './conferencePairings';
import type { NonConferencePairing } from './nonConferencePairings';
import type { SeasonCalendar } from './seasonCalendar';

export type ScheduledMatch = {
  homeTeamId: string;
  awayTeamId: string;
  isoDate: string;
  weekIndex: number;
  isConference: boolean;
  isTournament: boolean;
  isNeutralSite: boolean;
};

/** Non-con block: weeks 0..NON_CONF_LAST_WEEK inclusive (5 weeks, 15 dates/team). */
export const NON_CONF_LAST_WEEK = 4;
/** Conference block: weeks CONF_WEEK_START..13 inclusive (9 weeks, 27 dates/team). */
export const CONF_WEEK_START = 5;

type UnassignedPairing =
  | { kind: 'conf'; homeTeamId: string; awayTeamId: string; roundIndex: number }
  | { kind: 'nonconf'; homeTeamId: string; awayTeamId: string };

export function assignDatesAndWeeks(
  confPairings: ConferencePairing[],
  nonConfPairings: NonConferencePairing[],
  calendar: SeasonCalendar,
  rng: Rng,
): ScheduledMatch[] {
  const results: ScheduledMatch[] = [];
  // Per-team set of ISO dates already scheduled.
  const busy = new Map<string, Set<string>>();
  const markBusy = (team: string, iso: string) => {
    if (!busy.has(team)) busy.set(team, new Set());
    busy.get(team)!.add(iso);
  };
  const isBusy = (team: string, iso: string) => busy.get(team)?.has(iso) ?? false;

  // Shuffle both pools for determinism under the RNG seed while keeping the
  // conf-round ordering stable by using a stable secondary sort.
  const confPool: UnassignedPairing[] = shuffle(
    confPairings.map((p) => ({
      kind: 'conf' as const,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      roundIndex: p.roundIndex,
    })),
    rng,
  );
  const nonConfPool: UnassignedPairing[] = shuffle(
    nonConfPairings.map((p) => ({
      kind: 'nonconf' as const,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
    })),
    rng,
  );

  // Non-conf: weeks 0..NON_CONF_LAST_WEEK ONLY. No fallback into the conf block.
  for (const p of nonConfPool) {
    const slot = findSlot(calendar, 0, NON_CONF_LAST_WEEK, p.homeTeamId, p.awayTeamId, isBusy);
    if (!slot) throw new Error(`Couldn't place non-conf pairing ${p.homeTeamId} vs ${p.awayTeamId}`);
    results.push({
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      isoDate: slot.isoDate,
      weekIndex: slot.weekIndex,
      isConference: false,
      isTournament: false, // flagged post-assignment below
      isNeutralSite: false,
    });
    markBusy(p.homeTeamId, slot.isoDate);
    markBusy(p.awayTeamId, slot.isoDate);
  }

  // Conference: weeks CONF_WEEK_START..13 ONLY. No fallback into the non-con block.
  for (const p of confPool) {
    const slot = findSlot(calendar, CONF_WEEK_START, 13, p.homeTeamId, p.awayTeamId, isBusy);
    if (!slot) throw new Error(`Couldn't place conf pairing ${p.homeTeamId} vs ${p.awayTeamId}`);
    results.push({
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      isoDate: slot.isoDate,
      weekIndex: slot.weekIndex,
      isConference: true,
      isTournament: false,
      isNeutralSite: false,
    });
    markBusy(p.homeTeamId, slot.isoDate);
    markBusy(p.awayTeamId, slot.isoDate);
  }

  // Mark pre-season tournament matches: any match in week 0 where the
  // home team has ≥ 2 matches the same week qualifies as "tournament cluster".
  // (Restricted to week 0 to avoid mis-flagging week-1+ regular non-con games.)
  const homeWeekCount = new Map<string, number>();
  for (const m of results) {
    if (m.weekIndex !== 0 || m.isConference) continue;
    const key = `${m.homeTeamId}:${m.weekIndex}`;
    homeWeekCount.set(key, (homeWeekCount.get(key) ?? 0) + 1);
  }
  for (const m of results) {
    if (m.weekIndex !== 0 || m.isConference) continue;
    const key = `${m.homeTeamId}:${m.weekIndex}`;
    if ((homeWeekCount.get(key) ?? 0) >= 2) {
      m.isTournament = true;
      m.isNeutralSite = true;
    }
  }

  // Sort results for deterministic output.
  results.sort((a, b) =>
    a.isoDate.localeCompare(b.isoDate) ||
    a.homeTeamId.localeCompare(b.homeTeamId) ||
    a.awayTeamId.localeCompare(b.awayTeamId),
  );
  return results;
}

function findSlot(
  calendar: SeasonCalendar,
  weekStart: number,
  weekEnd: number,
  home: string,
  away: string,
  isBusy: (team: string, iso: string) => boolean,
): { weekIndex: number; isoDate: string } | null {
  for (let w = weekStart; w <= weekEnd; w++) {
    const week = calendar.weeks[w];
    if (!week) continue;
    for (const d of week.dates) {
      if (!isBusy(home, d.isoDate) && !isBusy(away, d.isoDate)) {
        return { weekIndex: w, isoDate: d.isoDate };
      }
    }
  }
  return null;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
