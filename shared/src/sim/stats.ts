// Two-sample z-test for proportions. Used by the Sprint 5 timeout-effect
// regression. Deterministic closed-form; no iterative solvers.

export type ProportionTest = {
  p1: number;
  p2: number;
  pooled: number;
  z: number;
  /** Two-sided p-value (standard normal tail × 2). */
  pTwoSided: number;
};

/**
 * Inputs: x successes out of n trials for each sample.
 * Returns the z-statistic for H0: p1 = p2.
 * Negative z means p1 < p2 (opponent scored less in sample 1).
 */
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number): ProportionTest {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : (p1 - p2) / se;
  return { p1, p2, pooled, z, pTwoSided: 2 * stdNormCdf(-Math.abs(z)) };
}

/** Abramowitz & Stegun 7.1.26 approximation for the standard normal CDF. */
export function stdNormCdf(z: number): number {
  // Split into sign-agnostic positive path via the reflection Φ(-z) = 1 - Φ(z).
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const poly =
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = 1 - d * poly;
  return z >= 0 ? phi : 1 - phi;
}
