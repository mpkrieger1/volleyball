// 64 simulated AVCA voters with bias profiles. Seed-deterministic.

import type { Rng } from '../rng';
import { createRng } from '../rng';

export type VoterProfile = {
  id: string;
  homeConferenceId: string;
  /** Bonus multiplier in [0, 0.3] for teams from the voter's home conference. */
  conferenceLoyalty: number;
  /** Weight in [0, 0.4] on the team's last-3 record. */
  recencyWeight: number;
  /** Weight in [0, 0.25] on team prestige (blue-blood preference). */
  bluebloodWeight: number;
  /** Amplitude in [0, 0.03] for seeded per-team jitter. */
  noise: number;
};

export const VOTER_COUNT = 64;

/**
 * Deterministic voter-pool factory. Real AVCA voter rosters skew P4 — we
 * mimic that by concentrating home-conference assignments on the P4
 * conferences listed in `p4ConferenceIds`.
 */
export function makeVoters(
  seed: number | string,
  conferenceIds: string[],
  p4ConferenceIds: string[] = ['acc', 'big12', 'bigten', 'sec'],
): VoterProfile[] {
  const rng = createRng(seed);
  const voters: VoterProfile[] = [];
  const p4Set = new Set(p4ConferenceIds);
  const p4Only = conferenceIds.filter((c) => p4Set.has(c));
  const nonP4 = conferenceIds.filter((c) => !p4Set.has(c));
  // ~60% of voters have a P4 home conference.
  for (let i = 0; i < VOTER_COUNT; i++) {
    const isP4Voter = rng.next() < 0.6;
    const pool = isP4Voter && p4Only.length > 0 ? p4Only : nonP4.length > 0 ? nonP4 : conferenceIds;
    const home = pool[Math.floor(rng.next() * pool.length)]!;
    voters.push({
      id: `voter-${i.toString().padStart(2, '0')}`,
      homeConferenceId: home,
      conferenceLoyalty: round3(rng.next() * 0.3),
      recencyWeight: round3(rng.next() * 0.4),
      bluebloodWeight: round3(rng.next() * 0.25),
      noise: round3(rng.next() * 0.03),
    });
  }
  return voters;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Seed-stable jitter for a (voter, team) pair. Used inside ballot scoring. */
export function voterTeamJitter(voter: VoterProfile, teamId: string): number {
  const r = createRng(`${voter.id}:${teamId}`) as Rng;
  return (r.next() - 0.5) * 2 * voter.noise;
}
