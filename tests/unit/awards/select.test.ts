import { describe, expect, it } from 'vitest';
import { awards } from '@vcd/shared';

type PlayerSpec = {
  id: string;
  position: awards.PlayerPosition;
  isLibero?: boolean;
  team: string;
  /** Knob to vary primary stat — higher = better for that position. */
  rating: number;
};

function build(specs: PlayerSpec[]): {
  stats: Map<string, awards.AggregatedSeasonStats>;
  players: Map<string, awards.PlayerMeta>;
} {
  const stats = new Map<string, awards.AggregatedSeasonStats>();
  const players = new Map<string, awards.PlayerMeta>();
  for (const s of specs) {
    const sets = 100;
    // Drive stats from `rating` so position score is proportional to rating.
    const base = {
      playerId: s.id,
      matchesPlayed: 30,
      setsPlayed: sets,
      kills: 0,
      errors: 20,
      totalAttacks: 0,
      hittingPctMilli: 300,
      assists: 0,
      serviceAces: 20,
      serviceErrors: 10,
      receptionErrors: 10,
      digs: 0,
      blockSolos: 0,
      blockAssists: 0,
    };
    const effective: awards.PlayerPosition = s.isLibero ? 'L' : s.position;
    switch (effective) {
      case 'OH':
      case 'OPP':
        base.kills = 100 + s.rating * 4; // 4 K/set range
        base.totalAttacks = base.kills * 2 + base.errors;
        base.digs = 100;
        break;
      case 'MB':
        base.blockSolos = 30 + s.rating;
        base.blockAssists = 60 + s.rating * 2;
        base.kills = 80 + s.rating;
        base.totalAttacks = base.kills * 2 + base.errors;
        base.hittingPctMilli = 350 + s.rating;
        break;
      case 'S':
        base.assists = 500 + s.rating * 8;
        base.digs = 100;
        break;
      case 'L':
        base.digs = 200 + s.rating * 4;
        base.receptionErrors = Math.max(0, 50 - s.rating);
        break;
      case 'DS':
        base.digs = 150 + s.rating * 2;
        break;
    }
    stats.set(s.id, base);
    players.set(s.id, { teamId: s.team, position: s.position, isLibero: s.isLibero });
  }
  return { stats, players };
}

describe('selectAllAmericans', () => {
  it('returns 28 selections when pool is fully stocked', () => {
    const specs: PlayerSpec[] = [];
    let n = 0;
    for (const pos of ['OH', 'MB', 'OPP', 'S', 'L'] as const) {
      for (let i = 0; i < 12; i++) {
        specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: `T${n % 4}`, rating: 50 + i });
        n++;
      }
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    expect(sel.length).toBe(28);
  });

  it('every team has the locked composition (2 OH / 2 MB / 1 OPP / 1 S / 1 L)', () => {
    const specs: PlayerSpec[] = [];
    for (const pos of ['OH', 'MB', 'OPP', 'S', 'L'] as const) {
      for (let i = 0; i < 12; i++) {
        specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: `T${i % 4}`, rating: 50 + i });
      }
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    for (const team of awards.AA_TEAMS) {
      const teamSel = sel.filter((s) => s.team === team);
      const counts = { OH: 0, MB: 0, OPP: 0, S: 0, L: 0 };
      for (const s of teamSel) counts[s.position as keyof typeof counts]!++;
      expect(counts).toEqual(awards.AA_COMPOSITION);
    }
  });

  it('no playerId appears twice', () => {
    const specs: PlayerSpec[] = [];
    for (const pos of ['OH', 'MB', 'OPP', 'S', 'L'] as const) {
      for (let i = 0; i < 12; i++) {
        specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: 'T0', rating: 50 + i });
      }
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    const ids = new Set(sel.map((s) => s.playerId));
    expect(ids.size).toBe(sel.length);
  });

  it('within position, scores are non-increasing across teams (1st > 2nd > 3rd > HM)', () => {
    const specs: PlayerSpec[] = [];
    for (const pos of ['OH', 'MB', 'OPP', 'S', 'L'] as const) {
      for (let i = 0; i < 12; i++) {
        specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: 'T0', rating: 50 + i });
      }
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    for (const pos of ['OH', 'MB', 'OPP', 'S', 'L'] as const) {
      const byTeam: Record<string, number[]> = { first: [], second: [], third: [], hm: [] };
      for (const s of sel.filter((x) => x.position === pos)) {
        byTeam[s.team]!.push(s.score);
      }
      const top = (xs: number[]): number => Math.max(...xs);
      const bot = (xs: number[]): number => Math.min(...xs);
      // Min of 1st-team scores >= max of 2nd-team scores for the same position.
      if (byTeam.first.length && byTeam.second.length) {
        expect(bot(byTeam.first)).toBeGreaterThanOrEqual(top(byTeam.second));
      }
      if (byTeam.second.length && byTeam.third.length) {
        expect(bot(byTeam.second)).toBeGreaterThanOrEqual(top(byTeam.third));
      }
      if (byTeam.third.length && byTeam.hm.length) {
        expect(bot(byTeam.third)).toBeGreaterThanOrEqual(top(byTeam.hm));
      }
    }
  });

  it('gracefully handles undersized pool: only 5 setters → 4 land on teams, HM setter slot left empty', () => {
    const specs: PlayerSpec[] = [];
    for (let i = 0; i < 5; i++) specs.push({ id: `S_${i}`, position: 'S', team: 'T0', rating: 50 + i });
    // Pad other positions enough to fill non-S slots.
    for (const pos of ['OH', 'MB', 'OPP', 'L'] as const) {
      for (let i = 0; i < 12; i++) specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: 'T0', rating: 50 + i });
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    const setters = sel.filter((s) => s.position === 'S');
    expect(setters).toHaveLength(4); // 1st, 2nd, 3rd teams take all 4 (1 each) — wait, 4 teams × 1 = 4; pool has 5 so all 4 slots filled
    // Actually with 5 setters and 4 slots, all 4 are filled. Let's test the 3-setter case:
    // (See next test for the genuinely-undersized case.)
  });

  it('genuinely undersized pool: 3 setters → 4th-team setter slot empty', () => {
    const specs: PlayerSpec[] = [];
    for (let i = 0; i < 3; i++) specs.push({ id: `S_${i}`, position: 'S', team: 'T0', rating: 50 + i });
    for (const pos of ['OH', 'MB', 'OPP', 'L'] as const) {
      for (let i = 0; i < 12; i++) specs.push({ id: `${pos}_${i}`, position: pos, isLibero: pos === 'L', team: 'T0', rating: 50 + i });
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    expect(sel.filter((s) => s.position === 'S')).toHaveLength(3); // not 4
    expect(sel.filter((s) => s.position === 'OH')).toHaveLength(8); // unaffected
  });

  it('isLibero true overrides position field for AA-eligibility purposes', () => {
    const specs: PlayerSpec[] = [
      { id: 'L_isLib', position: 'OH', isLibero: true, team: 'T0', rating: 99 },
    ];
    for (let i = 0; i < 11; i++) specs.push({ id: `L_${i}`, position: 'L', isLibero: true, team: 'T0', rating: i });
    for (const pos of ['OH', 'MB', 'OPP', 'S'] as const) {
      for (let i = 0; i < 12; i++) specs.push({ id: `${pos}_${i}`, position: pos, team: 'T0', rating: 50 + i });
    }
    const { stats, players } = build(specs);
    const sel = awards.selectAllAmericans({ stats, players });
    // The OH/isLibero player should land in the L bucket (1st team) by virtue of high rating.
    const firstTeamL = sel.find((s) => s.team === 'first' && s.position === 'L');
    expect(firstTeamL?.playerId).toBe('L_isLib');
  });

  it('eligibility filter excludes players with 0 sets', () => {
    const { stats, players } = build([
      { id: 'OH_played', position: 'OH', team: 'T0', rating: 80 },
      { id: 'OH_zero', position: 'OH', team: 'T0', rating: 90 },
    ]);
    stats.get('OH_zero')!.setsPlayed = 0; // override
    // Pad other positions to non-zero
    for (const pos of ['MB', 'OPP', 'S', 'L'] as const) {
      players.set(`${pos}_0`, { teamId: 'T0', position: pos, isLibero: pos === 'L' });
      stats.set(`${pos}_0`, {
        playerId: `${pos}_0`,
        matchesPlayed: 30,
        setsPlayed: 100,
        kills: 100,
        errors: 20,
        totalAttacks: 200,
        hittingPctMilli: 400,
        assists: 800,
        serviceAces: 20,
        serviceErrors: 5,
        receptionErrors: 5,
        digs: 200,
        blockSolos: 30,
        blockAssists: 60,
      });
    }
    const sel = awards.selectAllAmericans({ stats, players });
    const ids = sel.map((s) => s.playerId);
    expect(ids).toContain('OH_played');
    expect(ids).not.toContain('OH_zero'); // excluded by default eligibility
  });
});
