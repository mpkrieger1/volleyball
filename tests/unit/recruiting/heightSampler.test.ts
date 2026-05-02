import { describe, it, expect } from 'vitest';
import { recruiting, createRng } from '@vcd/shared';

describe('sampleHeight', () => {
  it('mean of 10,000 MB samples falls within 0.8 cm of the configured mean', () => {
    const rng = createRng('mb-height');
    const arch = recruiting.POSITION_ARCHETYPES.MB;
    let sum = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) sum += recruiting.sampleHeight(rng, arch);
    const mean = sum / N;
    expect(Math.abs(mean - arch.heightMeanCm)).toBeLessThan(0.8);
  });

  it('all samples clamp into [150, 220] cm', () => {
    const rng = createRng('clamp');
    const arch = recruiting.POSITION_ARCHETYPES.L;
    for (let i = 0; i < 5_000; i++) {
      const h = recruiting.sampleHeight(rng, arch);
      expect(h).toBeGreaterThanOrEqual(150);
      expect(h).toBeLessThanOrEqual(220);
    }
  });

  it('is deterministic for identical seeds', () => {
    const a = recruiting.sampleHeight(createRng('det'), recruiting.POSITION_ARCHETYPES.OH);
    const b = recruiting.sampleHeight(createRng('det'), recruiting.POSITION_ARCHETYPES.OH);
    expect(a).toBe(b);
  });
});
