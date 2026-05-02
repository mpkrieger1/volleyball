// Pure box-score computation from a completed match's rally events.
//
// Invariants enforced downstream by tests (PRD S6 exit test 1):
//   - Σ player.kills == team.kills
//   - Σ player.errors == team.errors
//   - Σ player.totalAttacks == team.totalAttacks
//
// Sprint 6 note: "rotation minutes" is approximated as "rallies the slot was
// in the lineup". Since Sprint 4's substitution ledger isn't exercised yet,
// every slot is on-court every rally — all 6 players get `rotationMinutes =
// rallyCount`. Sprint 17 replaces this with real on-court tracking.

import { z } from 'zod';
import type { RallyEvent } from './rallyEvents';
import type { TeamSide } from './lineup';

const intNN = z.number().int().nonnegative();

export const PlayerBoxScoreSchema = z.object({
  slotIndex: z.number().int().min(0).max(5),
  kills: intNN,
  errors: intNN,
  totalAttacks: intNN,
  /** Hitting % scaled ×1000 so we stay in int-land per CLAUDE.md conventions. */
  hittingPctMilli: z.number().int(),
  assists: intNN,
  serviceAces: intNN,
  serviceErrors: intNN,
  receptionErrors: intNN,
  digs: intNN,
  blockSolos: intNN,
  blockAssists: intNN,
  rotationMinutes: intNN,
});
export type PlayerBoxScore = z.infer<typeof PlayerBoxScoreSchema>;

export const TeamBoxScoreSchema = z.object({
  team: z.enum(['home', 'away']),
  players: z.array(PlayerBoxScoreSchema).length(6),
  totals: PlayerBoxScoreSchema.omit({ slotIndex: true }).extend({
    slotIndex: z.literal(-1),
  }),
});
export type TeamBoxScore = z.infer<typeof TeamBoxScoreSchema>;

export const MatchBoxScoreSchema = z.object({
  home: TeamBoxScoreSchema,
  away: TeamBoxScoreSchema,
  homeSetsWon: z.number().int().min(0).max(3),
  awaySetsWon: z.number().int().min(0).max(3),
  winner: z.enum(['home', 'away']),
});
export type MatchBoxScore = z.infer<typeof MatchBoxScoreSchema>;

// ─────────────────────────────────────────────────────────────

function emptyPlayerRow(slotIndex: number): PlayerBoxScore {
  return {
    slotIndex,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    hittingPctMilli: 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 0,
  };
}

/**
 * Shared walker used by computeBoxScore AND replayPbp. Given a pre-initialized
 * stat frame and an array of RallyEvent[], mutate the frame with per-event
 * stat attribution.
 */
export function applyEventsToFrame(
  events: RallyEvent[],
  home: PlayerBoxScore[],
  away: PlayerBoxScore[],
): void {
  const rowsOf = (team: TeamSide): PlayerBoxScore[] => (team === 'home' ? home : away);

  // Track the most recent `set` setter per team; if the next attack is a kill
  // by an attacker on the same team, credit that setter with 1 assist.
  const lastSetter: Record<TeamSide, number | null> = { home: null, away: null };

  for (const e of events) {
    switch (e.kind) {
      case 'serve': {
        const r = rowsOf(e.team)[e.server]!;
        if (e.quality === 'ace') r.serviceAces += 1;
        else if (e.quality === 'error') r.serviceErrors += 1;
        break;
      }
      case 'reception': {
        // Grade 0 = shanked / ball not recovered → reception error.
        if (e.grade === 0) rowsOf(e.team)[e.receiver]!.receptionErrors += 1;
        break;
      }
      case 'set': {
        lastSetter[e.team] = e.setter;
        break;
      }
      case 'attack': {
        const r = rowsOf(e.team)[e.attacker]!;
        r.totalAttacks += 1;
        if (e.outcome === 'kill') {
          r.kills += 1;
          const setter = lastSetter[e.team];
          if (setter !== null && setter !== e.attacker) {
            rowsOf(e.team)[setter]!.assists += 1;
          }
        } else if (e.outcome === 'error') {
          r.errors += 1;
        } else if (e.outcome === 'blocked') {
          r.errors += 1;
          // Blocker = a front-row defender. We don't record who blocked the
          // ball in the event (not modeled per-blocker), so credit a block-
          // assist would double-count. Leave BS/BA to a future sprint that
          // tracks the actual blocker slot.
        }
        lastSetter[e.team] = null; // attack consumes the set context
        break;
      }
      case 'dig': {
        if (e.grade > 0) rowsOf(e.team)[e.digger]!.digs += 1;
        break;
      }
      case 'point':
        // No direct stat; terminal event.
        break;
    }
  }
}

/** Sums the `players` array into the team's totals row. */
export function computeTotals(players: PlayerBoxScore[]): TeamBoxScore['totals'] {
  const sum = (key: keyof Omit<PlayerBoxScore, 'slotIndex'>): number =>
    players.reduce((acc, p) => acc + (p[key] as number), 0);
  const kills = sum('kills');
  const errors = sum('errors');
  const totalAttacks = sum('totalAttacks');
  return {
    slotIndex: -1,
    kills,
    errors,
    totalAttacks,
    hittingPctMilli: totalAttacks > 0 ? Math.round(((kills - errors) / totalAttacks) * 1000) : 0,
    assists: sum('assists'),
    serviceAces: sum('serviceAces'),
    serviceErrors: sum('serviceErrors'),
    receptionErrors: sum('receptionErrors'),
    digs: sum('digs'),
    blockSolos: sum('blockSolos'),
    blockAssists: sum('blockAssists'),
    rotationMinutes: sum('rotationMinutes'),
  };
}

export type MatchLike = {
  winner: TeamSide;
  homeSetsWon: number;
  awaySetsWon: number;
  sets: Array<{ rallies: Array<{ events: RallyEvent[] }> }>;
};

export function computeBoxScore(match: MatchLike): MatchBoxScore {
  const home: PlayerBoxScore[] = Array.from({ length: 6 }, (_, i) => emptyPlayerRow(i));
  const away: PlayerBoxScore[] = Array.from({ length: 6 }, (_, i) => emptyPlayerRow(i));

  let rallyCount = 0;
  for (const s of match.sets) {
    for (const rally of s.rallies) {
      applyEventsToFrame(rally.events, home, away);
      rallyCount += 1;
    }
  }

  // Rotation minutes — Sprint 6 placeholder: every slot on-court every rally.
  for (const row of home) row.rotationMinutes = rallyCount;
  for (const row of away) row.rotationMinutes = rallyCount;

  // Per-player hitting% finalize.
  for (const row of home) {
    row.hittingPctMilli = row.totalAttacks > 0
      ? Math.round(((row.kills - row.errors) / row.totalAttacks) * 1000)
      : 0;
  }
  for (const row of away) {
    row.hittingPctMilli = row.totalAttacks > 0
      ? Math.round(((row.kills - row.errors) / row.totalAttacks) * 1000)
      : 0;
  }

  return {
    home: { team: 'home', players: home, totals: computeTotals(home) },
    away: { team: 'away', players: away, totals: computeTotals(away) },
    homeSetsWon: match.homeSetsWon,
    awaySetsWon: match.awaySetsWon,
    winner: match.winner,
  };
}
