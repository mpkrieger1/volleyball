import { describe, expect, it } from 'vitest';
import { createRng, schedule, type TeamRegion } from '@vcd/shared';

// Build a mini-league: 3 conferences × 10 teams each, varied regions.
function buildTeams(): schedule.TeamForScheduling[] {
  const confs = ['c1', 'c2', 'c3'] as const;
  const regions: TeamRegion[] = ['EAST', 'CENTRAL', 'PACIFIC'];
  const teams: schedule.TeamForScheduling[] = [];
  for (let c = 0; c < 3; c++) {
    for (let t = 0; t < 10; t++) {
      teams.push({
        id: `${confs[c]}-t${t}`,
        conferenceId: confs[c]!,
        region: regions[(c + t) % 3]!,
      });
    }
  }
  return teams;
}

function generateConfPairings(teams: schedule.TeamForScheduling[], rng: () => number): schedule.ConferencePairing[] {
  const byConf = new Map<string, string[]>();
  for (const t of teams) {
    if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
    byConf.get(t.conferenceId)!.push(t.id);
  }
  const all: schedule.ConferencePairing[] = [];
  for (const [cid, ids] of byConf) {
    all.push(...schedule.generateConferencePairings(ids, cid, createRng(`conf-${cid}`)));
  }
  return all;
  void rng;
}

describe('non-conference pairings', () => {
  it('every team lands within [28, 40] total matches', () => {
    const teams = buildTeams();
    const conf = generateConfPairings(teams, () => 0);
    const nonConf = schedule.generateNonConferencePairings(teams, conf, createRng('s'));

    const total = new Map<string, number>();
    for (const p of conf) {
      total.set(p.homeTeamId, (total.get(p.homeTeamId) ?? 0) + 1);
      total.set(p.awayTeamId, (total.get(p.awayTeamId) ?? 0) + 1);
    }
    for (const p of nonConf) {
      total.set(p.homeTeamId, (total.get(p.homeTeamId) ?? 0) + 1);
      total.set(p.awayTeamId, (total.get(p.awayTeamId) ?? 0) + 1);
    }
    for (const t of teams) {
      const n = total.get(t.id) ?? 0;
      expect(n, `${t.id}: ${n} total`).toBeGreaterThanOrEqual(28);
      expect(n, `${t.id}: ${n} total`).toBeLessThanOrEqual(40);
    }
  });

  it('no team plays an opponent more than twice across conf + non-conf', () => {
    const teams = buildTeams();
    const conf = generateConfPairings(teams, () => 0);
    const nonConf = schedule.generateNonConferencePairings(teams, conf, createRng('s'));

    const counts = new Map<string, number>();
    const bump = (a: string, b: string) => {
      const k = [a, b].sort().join('::');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    for (const p of conf) bump(p.homeTeamId, p.awayTeamId);
    for (const p of nonConf) bump(p.homeTeamId, p.awayTeamId);
    for (const [, n] of counts) expect(n).toBeLessThanOrEqual(2);
  });

  it('cross-region AWAY trips are capped at the soft constraint (~3 per team)', () => {
    const teams = buildTeams();
    const conf = generateConfPairings(teams, () => 0);
    const nonConf = schedule.generateNonConferencePairings(teams, conf, createRng('s'));
    const byTeam = new Map(teams.map((t) => [t.id, t]));
    const crossAway = new Map<string, number>();
    for (const p of nonConf) {
      const h = byTeam.get(p.homeTeamId)!;
      const a = byTeam.get(p.awayTeamId)!;
      if (h.region !== a.region) {
        crossAway.set(a.id, (crossAway.get(a.id) ?? 0) + 1);
      }
    }
    for (const [, n] of crossAway) expect(n).toBeLessThanOrEqual(5); // soft cap with a small cushion
  });

  it('deterministic under fixed seed', () => {
    const teams = buildTeams();
    const conf = generateConfPairings(teams, () => 0);
    const a = schedule.generateNonConferencePairings(teams, conf, createRng('detX'));
    const b = schedule.generateNonConferencePairings(teams, conf, createRng('detX'));
    expect(a).toEqual(b);
  });

  it('never pairs teams within the same conference', () => {
    const teams = buildTeams();
    const byId = new Map(teams.map((t) => [t.id, t]));
    const conf = generateConfPairings(teams, () => 0);
    const nonConf = schedule.generateNonConferencePairings(teams, conf, createRng('s'));
    for (const p of nonConf) {
      expect(byId.get(p.homeTeamId)!.conferenceId).not.toBe(byId.get(p.awayTeamId)!.conferenceId);
    }
  });
});
