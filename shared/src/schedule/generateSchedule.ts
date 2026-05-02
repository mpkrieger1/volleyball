// Orchestrates the Sprint 7 scheduler end-to-end:
//   1. Group teams by conference → generateConferencePairings per conference.
//   2. generateNonConferencePairings across all teams + conf pairings.
//   3. buildSeasonCalendar + assignDatesAndWeeks → ScheduledMatch[].
//
// Deterministic under a seed: same teams+seed → byte-identical output.

import { createRng } from '../rng';
import { generateConferencePairings, type ConferencePairing } from './conferencePairings';
import {
  generateNonConferencePairings,
  type TeamForScheduling,
  DEFAULT_NONCONF_CONSTRAINTS,
  type NonConferenceConstraints,
} from './nonConferencePairings';
import { buildSeasonCalendar } from './seasonCalendar';
import { assignDatesAndWeeks, type ScheduledMatch } from './dateAssignment';

export type GenerateScheduleInput = {
  teams: TeamForScheduling[];
  seasonYear: number;
  seed: number | string;
  nonConfConstraints?: NonConferenceConstraints;
};

export type GenerateScheduleResult = {
  matches: ScheduledMatch[];
  stats: {
    totalMatches: number;
    confMatches: number;
    nonConfMatches: number;
    tournamentMatches: number;
  };
};

export function generateSchedule(input: GenerateScheduleInput): GenerateScheduleResult {
  const root = createRng(input.seed);

  // Conference pairings, grouped by conferenceId.
  const byConf = new Map<string, string[]>();
  for (const t of input.teams) {
    if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
    byConf.get(t.conferenceId)!.push(t.id);
  }
  const confPairings: ConferencePairing[] = [];
  // Iterate sorted by conferenceId for deterministic RNG fork ordering.
  const confIds = [...byConf.keys()].sort();
  for (const cid of confIds) {
    const ids = byConf.get(cid)!;
    confPairings.push(...generateConferencePairings(ids, cid, root.fork(`conf:${cid}`)));
  }

  const nonConfPairings = generateNonConferencePairings(
    input.teams,
    confPairings,
    root.fork('nonconf'),
    input.nonConfConstraints ?? DEFAULT_NONCONF_CONSTRAINTS,
  );

  const calendar = buildSeasonCalendar(input.seasonYear);
  const matches = assignDatesAndWeeks(
    confPairings,
    nonConfPairings,
    calendar,
    root.fork('dates'),
  );

  let conf = 0;
  let nonconf = 0;
  let tournament = 0;
  for (const m of matches) {
    if (m.isConference) conf += 1;
    else nonconf += 1;
    if (m.isTournament) tournament += 1;
  }

  return {
    matches,
    stats: {
      totalMatches: matches.length,
      confMatches: conf,
      nonConfMatches: nonconf,
      tournamentMatches: tournament,
    },
  };
}
