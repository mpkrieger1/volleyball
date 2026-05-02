// Sprint 18: synthetic-season generator for AA exit tests.
//
// Generates per-player aggregate season stats directly (no per-match
// simulation) by sampling from position-specific Gaussian distributions.
// Used by Monte Carlo exit tests — fast (<1s for 25 teams × 8 players).

import { createRng, type Rng } from '@vcd/shared';
import type { awards } from '@vcd/shared';

export type SyntheticPlayer = {
  id: string;
  position: awards.PlayerPosition;
  teamId: string;
  isLibero: boolean;
};

export type SyntheticSeason = {
  players: SyntheticPlayer[];
  stats: Map<string, awards.AggregatedSeasonStats>;
  meta: Map<string, awards.PlayerMeta>;
};

export type SyntheticSeasonInput = {
  seed: string | number;
  /** Number of teams (default 25). */
  numTeams?: number;
};

const ROSTER_TEMPLATE: { position: awards.PlayerPosition; isLibero: boolean; count: number }[] = [
  { position: 'OH', isLibero: false, count: 4 },
  { position: 'MB', isLibero: false, count: 3 },
  { position: 'OPP', isLibero: false, count: 1 },
  { position: 'S', isLibero: false, count: 1 },
  { position: 'L', isLibero: true, count: 1 },
];

function gaussian(rng: Rng): number {
  // Box-Muller. u1 floored to avoid log(0).
  const u1 = Math.max(1e-9, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function statsForPosition(rng: Rng, pos: awards.PlayerPosition): awards.AggregatedSeasonStats {
  // setsPlayed: 75–120 baseline.
  const setsPlayed = Math.max(60, Math.round(95 + gaussian(rng) * 12));
  // Skill: 0..1 normal-ish, drives the position's primary metric.
  const skill = Math.max(0, Math.min(1, 0.55 + gaussian(rng) * 0.18));

  const id = `synthetic-player`; // placeholder; caller overrides
  const base: awards.AggregatedSeasonStats = {
    playerId: id,
    matchesPlayed: Math.max(20, Math.round(setsPlayed / 3.5)),
    setsPlayed,
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
  };
  switch (pos) {
    case 'OH': {
      const kPerSet = 1.5 + skill * 4.0; // 1.5..5.5
      base.kills = Math.round(kPerSet * setsPlayed);
      base.errors = Math.round(0.3 * setsPlayed);
      base.totalAttacks = Math.round(2.4 * base.kills);
      base.hittingPctMilli = base.totalAttacks > 0 ? Math.round(((base.kills - base.errors) / base.totalAttacks) * 1000) : 0;
      base.digs = Math.round((1.5 + skill * 1.5) * setsPlayed);
      base.serviceAces = Math.round(0.3 * setsPlayed);
      base.receptionErrors = Math.round(0.4 * setsPlayed);
      break;
    }
    case 'MB': {
      const blocksPerSet = 0.6 + skill * 1.2;
      base.blockSolos = Math.round(blocksPerSet * 0.4 * setsPlayed);
      base.blockAssists = Math.round(blocksPerSet * 1.2 * setsPlayed);
      base.kills = Math.round((1.0 + skill * 1.5) * setsPlayed);
      base.errors = Math.round(0.2 * setsPlayed);
      base.totalAttacks = Math.round(1.7 * base.kills);
      base.hittingPctMilli = base.totalAttacks > 0 ? Math.round(((base.kills - base.errors) / base.totalAttacks) * 1000) : 0;
      break;
    }
    case 'OPP': {
      const kPerSet = 2.0 + skill * 3.5;
      base.kills = Math.round(kPerSet * setsPlayed);
      base.errors = Math.round(0.4 * setsPlayed);
      base.totalAttacks = Math.round(2.2 * base.kills);
      base.hittingPctMilli = base.totalAttacks > 0 ? Math.round(((base.kills - base.errors) / base.totalAttacks) * 1000) : 0;
      base.blockSolos = Math.round(0.2 * setsPlayed);
      base.blockAssists = Math.round(0.5 * setsPlayed);
      base.serviceAces = Math.round(0.25 * setsPlayed);
      break;
    }
    case 'S': {
      base.assists = Math.round((6 + skill * 5) * setsPlayed);
      base.digs = Math.round(1.2 * setsPlayed);
      base.serviceAces = Math.round(0.2 * setsPlayed);
      // Setters take occasional dump shots
      base.kills = Math.round(0.2 * setsPlayed);
      base.errors = Math.round(0.05 * setsPlayed);
      base.totalAttacks = Math.round(2 * base.kills);
      base.hittingPctMilli = base.totalAttacks > 0 ? Math.round(((base.kills - base.errors) / base.totalAttacks) * 1000) : 0;
      break;
    }
    case 'L': {
      base.digs = Math.round((3 + skill * 3) * setsPlayed);
      base.receptionErrors = Math.max(0, Math.round((0.4 - skill * 0.3) * setsPlayed));
      break;
    }
    case 'DS': {
      base.digs = Math.round((1.5 + skill * 1.5) * setsPlayed);
      base.receptionErrors = Math.round(0.3 * setsPlayed);
      break;
    }
  }
  return base;
}

export function generateSyntheticSeason(input: SyntheticSeasonInput): SyntheticSeason {
  const rng = createRng(input.seed);
  const numTeams = input.numTeams ?? 25;
  const players: SyntheticPlayer[] = [];
  const stats = new Map<string, awards.AggregatedSeasonStats>();
  const meta = new Map<string, awards.PlayerMeta>();

  for (let t = 0; t < numTeams; t++) {
    const teamId = `T${t}`;
    let p = 0;
    for (const slot of ROSTER_TEMPLATE) {
      for (let n = 0; n < slot.count; n++) {
        const id = `${teamId}-P${p}`;
        const player: SyntheticPlayer = {
          id,
          position: slot.position,
          teamId,
          isLibero: slot.isLibero,
        };
        players.push(player);
        const s = statsForPosition(rng.fork(`stats:${id}`), slot.position);
        s.playerId = id;
        stats.set(id, s);
        meta.set(id, { teamId, position: slot.position, isLibero: slot.isLibero });
        p++;
      }
    }
  }
  return { players, stats, meta };
}

/**
 * Returns the top-N players by K/set across OH and OPP positions.
 */
export function topNHitters(stats: Map<string, awards.AggregatedSeasonStats>, meta: Map<string, awards.PlayerMeta>, n: number): string[] {
  const eligible: { id: string; kPerSet: number }[] = [];
  for (const [id, s] of stats) {
    const m = meta.get(id);
    if (!m) continue;
    if (m.position !== 'OH' && m.position !== 'OPP') continue;
    if (s.setsPlayed === 0) continue;
    eligible.push({ id, kPerSet: s.kills / s.setsPlayed });
  }
  eligible.sort((a, b) => b.kPerSet - a.kPerSet);
  return eligible.slice(0, n).map((e) => e.id);
}
