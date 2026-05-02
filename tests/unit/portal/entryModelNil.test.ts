// Sprint 15: NIL retention extension tests. Validates PRD exit test 2's
// prototype threshold (high NIL → lower entry probability) before the
// Monte Carlo in Task 15.8.

import { describe, it, expect } from 'vitest';
import { portal, createRng } from '@vcd/shared';

const mkPlayer = (nilCents: number): portal.PlayerLike => ({
  overall: 70,
  classYear: 'SO',
  position: 'OH',
  nilValueCents: nilCents,
});

describe('portal entry NIL retention (Sprint 15)', () => {
  it('player with $50k NIL has lower entry probability than same player with $0', () => {
    const rng1 = createRng('nil-hi');
    const rng2 = createRng('nil-hi'); // same seed for apples-to-apples
    const hi = portal.computePortalEntryProbability(
      mkPlayer(50_000_00),
      { prestige: 55 },
      { depthRank: 3 },
      rng1,
    );
    const lo = portal.computePortalEntryProbability(
      mkPlayer(0),
      { prestige: 55 },
      { depthRank: 3 },
      rng2,
    );
    expect(hi).toBeLessThan(lo);
  });

  it('retention capped at NIL_RETENTION_WEIGHT (no negative probability)', () => {
    const p = portal.computePortalEntryProbability(
      mkPlayer(1_000_000_00), // $1M NIL
      { prestige: 55 },
      { depthRank: 1 }, // starter, low baseline
      createRng('cap'),
    );
    expect(p).toBeGreaterThanOrEqual(0);
  });

  it('10k-draw population gap ≥ 2 pp between $0 and $50k NIL (PRD exit test 2 proto)', () => {
    const N = 10_000;
    let entries0 = 0;
    let entries50k = 0;
    for (let i = 0; i < N; i++) {
      const rng = createRng(`nil-test:${i}`);
      const p0 = portal.computePortalEntryProbability(
        mkPlayer(0),
        { prestige: 55 },
        { depthRank: 3 },
        rng.fork('prob-0'),
      );
      const p50 = portal.computePortalEntryProbability(
        mkPlayer(50_000_00),
        { prestige: 55 },
        { depthRank: 3 },
        rng.fork('prob-50'),
      );
      if (portal.didPlayerEnterPortal(rng.fork('draw-0'), p0)) entries0 += 1;
      if (portal.didPlayerEnterPortal(rng.fork('draw-50'), p50)) entries50k += 1;
    }
    const rate0 = entries0 / N;
    const rate50k = entries50k / N;
    // eslint-disable-next-line no-console
    console.log(`$0: ${(rate0 * 100).toFixed(2)}%   $50k: ${(rate50k * 100).toFixed(2)}%   Δ=${((rate0 - rate50k) * 100).toFixed(2)}pp`);
    expect(rate0 - rate50k).toBeGreaterThanOrEqual(0.02);
  });
});
