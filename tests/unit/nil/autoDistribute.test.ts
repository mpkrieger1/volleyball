import { describe, it, expect } from 'vitest';
import { nil } from '@vcd/shared';

const mk = (playerId: string, value: number): nil.DistributeInput => ({ playerId, value });

describe('autoDistribute', () => {
  it('zero budget → empty list', () => {
    expect(nil.autoDistribute(0, [mk('a', 100_00), mk('b', 50_00)])).toEqual([]);
  });

  it('empty roster → empty list', () => {
    expect(nil.autoDistribute(100_00000, [])).toEqual([]);
  });

  it('total allocation ≤ budget', () => {
    const budget = 200_000_00;
    const result = nil.autoDistribute(budget, [
      mk('a', 50_000_00),
      mk('b', 30_000_00),
      mk('c', 10_000_00),
    ]);
    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBeLessThanOrEqual(budget);
  });

  it('higher-value player gets larger allocation', () => {
    const result = nil.autoDistribute(100_000_00, [
      mk('high', 100_000_00),
      mk('low', 10_000_00),
    ]);
    const high = result.find((a) => a.playerId === 'high')!;
    const low = result.find((a) => a.playerId === 'low')!;
    expect(high.amountCents).toBeGreaterThan(low.amountCents);
  });

  it('MIN_DEAL_CENTS floor drops tiny allocations', () => {
    // Budget of $600, 10 players with equal value → each would get ~$60.
    // Floor is $500, so 0 allocations pass.
    const result = nil.autoDistribute(
      600_00,
      Array.from({ length: 10 }, (_, i) => mk(`p${i}`, 1)),
    );
    expect(result).toHaveLength(0);
  });

  it('MAX_DEAL_PER_PLAYER_CENTS caps large allocations', () => {
    const result = nil.autoDistribute(500_000_00, [mk('superstar', 1_000_000_00)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.amountCents).toBeLessThanOrEqual(nil.MAX_DEAL_PER_PLAYER_CENTS);
  });

  it('deterministic', () => {
    const players = [mk('a', 50_00), mk('b', 30_00), mk('c', 10_00)];
    const a = nil.autoDistribute(100_000_00, players);
    const b = nil.autoDistribute(100_000_00, players);
    expect(a).toEqual(b);
  });
});

describe('validateAssignment', () => {
  it('accepts when within budget', () => {
    expect(nil.validateAssignment(50_000_00, 20_000_00, 0, 100_000_00).ok).toBe(true);
  });

  it('rejects when over budget', () => {
    const r = nil.validateAssignment(90_000_00, 20_000_00, 0, 100_000_00);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT_BUDGET');
  });

  it('treats replacement of existing deal as delta-only', () => {
    // Team has $50k spent, $10k of which is on this player. Proposing $20k
    // net delta = +$10k → $60k total, well under $100k budget.
    const r = nil.validateAssignment(50_000_00, 20_000_00, 10_000_00, 100_000_00);
    expect(r.ok).toBe(true);
  });

  it('rejects negative amount', () => {
    const r = nil.validateAssignment(0, -5_00, 0, 100_00);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
});
