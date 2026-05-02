import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tests/playwright-report', open: 'never' }]],
  outputDir: 'tests/test-results',
  use: {
    trace: 'retain-on-failure',
  },
  // Sprint 20: visual-regression baselines for analytics charts.
  // Sprint 21 hygiene: loosened thresholds because match data uses
  // `Date.now()` as the simulator seed, so each run produces different
  // chart data. The visual regression here catches STRUCTURAL breakage
  // (chart fails to render, axes missing, layout collapsed) rather than
  // pixel-perfect equivalence. `maxDiffPixelRatio: 0.20` tolerates up to
  // 20% pixel difference (data jitter); structural failures produce ~80%+
  // diffs and still fail.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.2,
      threshold: 0.3,
    },
  },
});
