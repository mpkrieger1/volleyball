import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

const ctx = (over: Partial<sim.TimeoutDecisionCtx> = {}): sim.TimeoutDecisionCtx => ({
  myScore: 10,
  theirScore: 12,
  opponentRunLength: 0,
  timeoutsRemaining: 2,
  ...over,
});

describe('coach AI v0', () => {
  it('calls a timeout on a 3+ opponent run with timeouts remaining', () => {
    expect(sim.shouldCallTimeout(ctx({ opponentRunLength: 3 }))).toEqual({ kind: 'timeout' });
    expect(sim.shouldCallTimeout(ctx({ opponentRunLength: 5 }))).toEqual({ kind: 'timeout' });
  });

  it('does not call a timeout when opponent run is below 3', () => {
    expect(sim.shouldCallTimeout(ctx({ opponentRunLength: 2 }))).toEqual({ kind: 'continue' });
  });

  it('never calls a timeout when none remain', () => {
    expect(
      sim.shouldCallTimeout(ctx({ opponentRunLength: 5, timeoutsRemaining: 0 })),
    ).toEqual({ kind: 'continue' });
  });

  it('does not call a timeout when the team is on its own run', () => {
    expect(sim.shouldCallTimeout(ctx({ opponentRunLength: 0 }))).toEqual({ kind: 'continue' });
  });
});
