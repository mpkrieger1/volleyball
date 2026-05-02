import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '@vcd/shared/rng';

describe('seeded RNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('hashSeed is deterministic per label', () => {
    expect(hashSeed('sprint-1')).toBe(hashSeed('sprint-1'));
    expect(hashSeed('sprint-1')).not.toBe(hashSeed('sprint-2'));
  });

  it('int respects inclusive bounds', () => {
    const rng = createRng('int-bounds');
    for (let i = 0; i < 500; i++) {
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('chance(0) is always false and chance(1) is always true', () => {
    const rng = createRng('edges');
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('fork produces an independent, still-deterministic child', () => {
    const parent1 = createRng('seed');
    const parent2 = createRng('seed');
    const child1 = parent1.fork('sim');
    const child2 = parent2.fork('sim');
    const s1 = Array.from({ length: 10 }, () => child1.next());
    const s2 = Array.from({ length: 10 }, () => child2.next());
    expect(s1).toEqual(s2);
    // Different labels → different streams
    const other = createRng('seed').fork('recruit');
    const s3 = Array.from({ length: 10 }, () => other.next());
    expect(s1).not.toEqual(s3);
  });
});
