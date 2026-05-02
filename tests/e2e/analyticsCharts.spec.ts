// PRD Sprint 20 exit test 2: visual-regression snapshots for the 5 charts.
//
// Launches the Electron app, creates a save, simulates one match, navigates
// to Analytics, and screenshots each chart container. Baselines live under
// `tests/e2e/__screenshots__/analyticsCharts.spec.ts/`.
//
// First run: `npx playwright test tests/e2e/analyticsCharts.spec.ts --update-snapshots`
// to generate baselines. CI runs without `--update-snapshots` and fails on diff.

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { rmSync } from 'node:fs';

test.setTimeout(180_000);

test('Sprint 20: 5 analytics charts render and match visual baseline', async () => {
  const appRoot = path.resolve(__dirname, '../..');
  const isolatedUserData = path.join(appRoot, 'tests/test-results/e2e-analytics-userdata');
  try {
    rmSync(isolatedUserData, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const app = await electron.launch({
    args: [path.join(appRoot, 'main/dist/index.js')],
    cwd: appRoot,
    env: { ...process.env, VCD_USER_DATA: isolatedUserData },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Create a save and open it.
  await window.getByRole('button', { name: /new save/i }).click();
  await window.getByLabel(/dynasty name/i).fill('Analytics Demo');
  await window.getByRole('button', { name: /^create$/i }).click();
  await window
    .getByRole('button', { name: 'Analytics Demo', exact: true })
    .click({ timeout: 30_000 });

  // Match Hub loaded. Pick two teams and play a match.
  await expect(window.getByRole('heading', { name: /match hub/i })).toBeVisible();
  const homeSelect = window.getByRole('combobox', { name: /home team/i });
  await expect(homeSelect.locator('option')).toHaveCount(361, { timeout: 30_000 });
  const homeOptions = await homeSelect.locator('option').all();
  const homeId = (await homeOptions[1]!.getAttribute('value'))!;
  const awayId = (await homeOptions[2]!.getAttribute('value'))!;
  await homeSelect.selectOption(homeId);
  await window.getByRole('combobox', { name: /away team/i }).selectOption(awayId);
  await expect(window.getByLabel(/scout report/i)).toBeVisible({ timeout: 15_000 });
  await window.getByRole('button', { name: /^play match$/i }).click();
  await expect(window.getByTestId('speed-control')).toBeVisible({ timeout: 30_000 });
  await window.getByRole('button', { name: /skip to end/i }).click();
  await expect(window.getByTestId('match-status')).toContainText(/match complete/i, {
    timeout: 30_000,
  });

  // Navigate to Analytics.
  await window.getByRole('button', { name: 'Analytics' }).click();
  await expect(window.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(window.getByLabel(/Hitting percentage by rotation/i)).toBeVisible({
    timeout: 15_000,
  });

  // Screenshot each chart container.
  await expect(window.getByTestId('chart-rotation')).toHaveScreenshot('chart-rotation.png');
  await expect(window.getByTestId('chart-scatter')).toHaveScreenshot('chart-scatter.png');
  await expect(window.getByTestId('chart-histogram')).toHaveScreenshot('chart-histogram.png');
  await expect(window.getByTestId('chart-heatmap')).toHaveScreenshot('chart-heatmap.png');
  await expect(window.getByTestId('chart-rally-length')).toHaveScreenshot('chart-rally-length.png');

  await app.close();
});
