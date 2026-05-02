import { describe, it, expect } from 'vitest';
import { portal, createRng } from '@vcd/shared';

const mkPlayer = (over: Partial<portal.PlayerLike> = {}): portal.PlayerLike => ({
  overall: 60,
  classYear: 'SO',
  position: 'OH',
  ...over,
});
const mkTeam = (over: Partial<portal.TeamLike> = {}): portal.TeamLike => ({
  prestige: 60,
  ...over,
});
const mkCtx = (over: Partial<portal.RosterContext> = {}): portal.RosterContext => ({
  depthRank: 1,
  ...over,
});

describe('computePortalEntryProbability', () => {
  it('starters at top programs have low entry probability', () => {
    const p = portal.computePortalEntryProbability(
      mkPlayer({ classYear: 'JR', overall: 75 }),
      mkTeam({ prestige: 90 }),
      mkCtx({ depthRank: 1 }),
      createRng('low-1'),
    );
    expect(p).toBeLessThan(0.1);
  });

  it('bench players (depth 4) have high entry probability', () => {
    const p = portal.computePortalEntryProbability(
      mkPlayer({ classYear: 'SO' }),
      mkTeam({ prestige: 65 }),
      mkCtx({ depthRank: 4 }),
      createRng('high-1'),
    );
    expect(p).toBeGreaterThan(0.13);
  });

  it('seniors have floor-level entry probability', () => {
    const p = portal.computePortalEntryProbability(
      mkPlayer({ classYear: 'SR' }),
      mkTeam({ prestige: 40 }),
      mkCtx({ depthRank: 4 }),
      createRng('sr-1'),
    );
    expect(p).toBeLessThanOrEqual(portal.SENIOR_FLOOR);
  });

  it('rating-vs-prestige mismatch upward raises entry probability', () => {
    const hi = portal.computePortalEntryProbability(
      mkPlayer({ overall: 80 }),
      mkTeam({ prestige: 40 }),
      mkCtx({ depthRank: 2 }),
      createRng('mismatch-hi'),
    );
    const matched = portal.computePortalEntryProbability(
      mkPlayer({ overall: 80 }),
      mkTeam({ prestige: 80 }),
      mkCtx({ depthRank: 2 }),
      createRng('mismatch-hi'),
    );
    expect(hi).toBeGreaterThan(matched);
  });

  it('deterministic — identical inputs produce identical probability', () => {
    const a = portal.computePortalEntryProbability(mkPlayer(), mkTeam(), mkCtx(), createRng('det'));
    const b = portal.computePortalEntryProbability(mkPlayer(), mkTeam(), mkCtx(), createRng('det'));
    expect(a).toBe(b);
  });

  it('10,000-player population entry rate is within the PRD 8-15% band', () => {
    const rng = createRng('population');
    let enters = 0;
    for (let i = 0; i < 10_000; i++) {
      // Uniform player/team population.
      const classYear = (['FR', 'SO', 'JR', 'SR'] as const)[i % 4]!;
      const depthRank = (i % 4) + 1; // 1..4
      const prestige = 35 + (i % 60);
      const overall = 45 + (i % 45);
      const prob = portal.computePortalEntryProbability(
        { overall, classYear, position: 'OH' },
        { prestige },
        { depthRank },
        rng.fork(`p:${i}:prob`),
      );
      if (portal.didPlayerEnterPortal(rng.fork(`p:${i}:draw`), prob)) enters += 1;
    }
    const rate = enters / 10_000;
    expect(rate).toBeGreaterThanOrEqual(0.08);
    expect(rate).toBeLessThanOrEqual(0.15);
  });
});
