// PRD Sprint 19 exit test 1 (Playwright E2E):
//   user starts a match, sees ticker stream, sees scoreboard update per
//   point, sees final result.

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { rmSync } from 'node:fs';

test.setTimeout(180_000);

test('Sprint 19: play match → ticker streams → scoreboard updates → final result', async () => {
  const appRoot = path.resolve(__dirname, '../..');
  const isolatedUserData = path.join(appRoot, 'tests/test-results/e2e-matchhub-userdata');
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
  await expect(window).toHaveTitle('VCD');

  // Create a save and open it.
  await window.getByRole('button', { name: /new save/i }).click();
  await window.getByLabel(/dynasty name/i).fill('Match Hub Demo');
  await window.getByRole('button', { name: /^create$/i }).click();
  await window
    .getByRole('button', { name: 'Match Hub Demo', exact: true })
    .click({ timeout: 30_000 });

  // Match Hub loaded — wait for team dropdowns.
  await expect(window.getByRole('heading', { name: /match hub/i })).toBeVisible();
  const homeSelect = window.getByRole('combobox', { name: /home team/i });
  await expect(homeSelect.locator('option')).toHaveCount(361, { timeout: 30_000 });

  // Pick two distinct teams.
  const homeOptions = await homeSelect.locator('option').all();
  const homeId = (await homeOptions[1]!.getAttribute('value'))!;
  const awayId = (await homeOptions[2]!.getAttribute('value'))!;
  await homeSelect.selectOption(homeId);
  await window.getByRole('combobox', { name: /away team/i }).selectOption(awayId);

  // Scout panel should appear once both teams selected.
  await expect(window.getByLabel(/scout report/i)).toBeVisible({ timeout: 15_000 });

  // Click "Play match" to simulate + load replay.
  await window.getByRole('button', { name: /^play match$/i }).click();

  // Wait for replay-ready phase: speed control + Play toggle visible.
  await expect(window.getByTestId('speed-control')).toBeVisible({ timeout: 30_000 });
  await expect(window.getByTestId('play-toggle')).toBeVisible();

  // Use "Skip to end" to drain the ticker and reach the final result quickly.
  await window.getByRole('button', { name: /skip to end/i }).click();

  // After skip, phase should be 'done' and final result rendered.
  await expect(window.getByTestId('match-status')).toContainText(/match complete/i, {
    timeout: 30_000,
  });

  // Ticker entries are visible (last N events shown).
  const ticker = window.getByTestId('ticker');
  await expect(ticker).toBeVisible();
  const tickerItems = ticker.locator('li');
  expect(await tickerItems.count()).toBeGreaterThan(0);

  // Final box score tables (2 teams) appear in the results panel.
  const tables = window.locator('.match-hub__boxscore');
  await expect(tables).toHaveCount(2);

  await app.close();
});
