// RPI with D-I home/away weighting.
//
//   RPI = 0.25 × weighted WP  +  0.50 × opponent WP  +  0.25 × opp-opp WP
//
// Weighted win/loss counting (per NCAA D-I volleyball convention):
//   Home win  = 0.6     Road win  = 1.4   Neutral win  = 1.0
//   Home loss = 1.4     Road loss = 0.6   Neutral loss = 1.0
//
// OppWP and OppOppWP use UNWEIGHTED records (per NCAA RPI formulation — only
// the team's own WP component is weighted). Output RPI is scaled ×1000 and
// rounded so the whole pipeline stays integer-safe for DB storage.
//
// Quadrant wins (Q1..Q4) are computed against opponent RPI rank + site:
//   Q1: Home vs  1–30  | Neutral vs  1–50 | Road vs  1–75
//   Q2: Home vs 31–75  | Neutral vs 51–100| Road vs 76–135
//   Q3: Home vs 76–160 | Neutral vs 101–200| Road vs 136–240
//   Q4: everything else

import type { BracketMatch } from './types';

export type RPIResult = {
  teamId: string;
  /** Scaled ×1000 integer, 0..1000. */
  rpi: number;
  wins: number;
  losses: number;
  /** Scaled ×1000: opponent WP × 2/3 + opp-opp WP × 1/3. */
  sos: number;
  q1Wins: number;
  q2Wins: number;
  q3Wins: number;
  q4Wins: number;
};

const HOME_W = 0.6;
const ROAD_W = 1.4;
const NEUTRAL_W = 1.0;

type Site = 'HOME' | 'ROAD' | 'NEUTRAL';

function siteFor(m: BracketMatch, teamId: string): Site {
  if (m.isNeutralSite) return 'NEUTRAL';
  return m.homeTeamId === teamId ? 'HOME' : 'ROAD';
}

function weightFor(site: Site, won: boolean): { winW: number; lossW: number } {
  // For wins: weight goes into the win bucket; losses add 0 to that bucket.
  if (site === 'HOME') return won ? { winW: HOME_W, lossW: 0 } : { winW: 0, lossW: ROAD_W };
  if (site === 'ROAD') return won ? { winW: ROAD_W, lossW: 0 } : { winW: 0, lossW: HOME_W };
  return won ? { winW: NEUTRAL_W, lossW: 0 } : { winW: 0, lossW: NEUTRAL_W };
}

function q1Bound(site: Site): number { return site === 'HOME' ? 30 : site === 'NEUTRAL' ? 50 : 75; }
function q2Bound(site: Site): number { return site === 'HOME' ? 75 : site === 'NEUTRAL' ? 100 : 135; }
function q3Bound(site: Site): number { return site === 'HOME' ? 160 : site === 'NEUTRAL' ? 200 : 240; }

function quadrant(site: Site, oppRank: number): 1 | 2 | 3 | 4 {
  if (oppRank <= q1Bound(site)) return 1;
  if (oppRank <= q2Bound(site)) return 2;
  if (oppRank <= q3Bound(site)) return 3;
  return 4;
}

const round3Int = (n: number): number => Math.round(n * 1000);

export function computeRPI(matches: BracketMatch[], teamIds: string[]): Map<string, RPIResult> {
  // Index matches by team.
  const byTeam = new Map<string, BracketMatch[]>();
  for (const id of teamIds) byTeam.set(id, []);
  for (const m of matches) {
    byTeam.get(m.homeTeamId)?.push(m);
    byTeam.get(m.awayTeamId)?.push(m);
  }

  // Pass 1: weighted WP + unweighted WP per team.
  type Pass1 = {
    weightedWins: number;
    weightedLosses: number;
    wins: number;
    losses: number;
    weightedWP: number;
    unweightedWP: number;
    opponents: string[];
  };
  const pass1 = new Map<string, Pass1>();
  for (const [id, list] of byTeam) {
    let wW = 0, wL = 0, w = 0, l = 0;
    const opponents: string[] = [];
    for (const m of list) {
      const site = siteFor(m, id);
      const won = m.winnerId === id;
      const { winW, lossW } = weightFor(site, won);
      wW += winW;
      wL += lossW;
      if (won) w += 1; else l += 1;
      opponents.push(m.homeTeamId === id ? m.awayTeamId : m.homeTeamId);
    }
    const weightedGames = wW + wL;
    const games = w + l;
    pass1.set(id, {
      weightedWins: wW,
      weightedLosses: wL,
      wins: w,
      losses: l,
      weightedWP: weightedGames > 0 ? wW / weightedGames : 0,
      unweightedWP: games > 0 ? w / games : 0,
      opponents,
    });
  }

  // Pass 2: opponent WP (OWP) excluding games vs self, and opp-opp WP (OOWP).
  // Standard RPI: OWP = mean over opponents of (opponent's unweighted WP
  // excluding games against me). OOWP = mean of opponents' OWP.
  const owpByTeam = new Map<string, number>();
  for (const [id, p] of pass1) {
    if (p.opponents.length === 0) { owpByTeam.set(id, 0); continue; }
    let sum = 0;
    for (const oid of p.opponents) {
      const opp = pass1.get(oid);
      if (!opp) continue;
      // Strip games the opponent played against `id`.
      const oppList = byTeam.get(oid) ?? [];
      let ow = 0, ol = 0;
      for (const m of oppList) {
        const otherSide = m.homeTeamId === oid ? m.awayTeamId : m.homeTeamId;
        if (otherSide === id) continue;
        if (m.winnerId === oid) ow += 1; else ol += 1;
      }
      const og = ow + ol;
      sum += og > 0 ? ow / og : 0;
    }
    owpByTeam.set(id, sum / p.opponents.length);
  }

  const oowpByTeam = new Map<string, number>();
  for (const [id, p] of pass1) {
    if (p.opponents.length === 0) { oowpByTeam.set(id, 0); continue; }
    let sum = 0;
    for (const oid of p.opponents) sum += owpByTeam.get(oid) ?? 0;
    oowpByTeam.set(id, sum / p.opponents.length);
  }

  // Final RPI (un-quadranted).
  type Pass3 = { teamId: string; rpi: number; sos: number; wins: number; losses: number };
  const pass3: Pass3[] = [];
  for (const [id, p] of pass1) {
    const owp = owpByTeam.get(id) ?? 0;
    const oowp = oowpByTeam.get(id) ?? 0;
    const rpi = p.weightedWP * 0.25 + owp * 0.5 + oowp * 0.25;
    const sos = owp * (2 / 3) + oowp * (1 / 3);
    pass3.push({ teamId: id, rpi, sos, wins: p.wins, losses: p.losses });
  }

  // Rank teams by RPI desc, teamId asc for determinism.
  pass3.sort((a, b) => b.rpi - a.rpi || a.teamId.localeCompare(b.teamId));
  const rankByTeam = new Map<string, number>();
  pass3.forEach((r, i) => rankByTeam.set(r.teamId, i + 1));

  // Pass 4: quadrant wins using opponent's RPI rank + my site.
  const out = new Map<string, RPIResult>();
  for (const r of pass3) {
    const list = byTeam.get(r.teamId) ?? [];
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    for (const m of list) {
      if (m.winnerId !== r.teamId) continue;
      const oppId = m.homeTeamId === r.teamId ? m.awayTeamId : m.homeTeamId;
      const oppRank = rankByTeam.get(oppId) ?? Number.MAX_SAFE_INTEGER;
      const q = quadrant(siteFor(m, r.teamId), oppRank);
      if (q === 1) q1 += 1;
      else if (q === 2) q2 += 1;
      else if (q === 3) q3 += 1;
      else q4 += 1;
    }
    out.set(r.teamId, {
      teamId: r.teamId,
      rpi: round3Int(r.rpi),
      wins: r.wins,
      losses: r.losses,
      sos: round3Int(r.sos),
      q1Wins: q1,
      q2Wins: q2,
      q3Wins: q3,
      q4Wins: q4,
    });
  }
  return out;
}

/** Rank teams by RPI desc (teamId asc tiebreak). */
export function rankByRPI(results: Map<string, { rpi: number; teamId: string }>): string[] {
  return [...results.values()]
    .slice()
    .sort((a, b) => b.rpi - a.rpi || a.teamId.localeCompare(b.teamId))
    .map((r) => r.teamId);
}
