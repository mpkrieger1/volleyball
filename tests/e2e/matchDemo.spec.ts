// PRD Sprint 6 exit test 4 (demoable milestone):
//   launch app → create save → pick two teams → sim match → see box score.

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { rmSync } from 'node:fs';

test.setTimeout(120_000);
test('demoable: create save → pick teams → sim match → box score visible', async () => {
  const appRoot = path.resolve(__dirname, '../..');
  const isolatedUserData = path.join(appRoot, 'tests/test-results/e2e-demo-userdata');
  // Fresh user-data per run so the save slot name is unique.
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

  // SaveSlots screen is the entry point.
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Save slots');

  // Create a save.
  await window.getByRole('button', { name: /new save/i }).click();
  await window.getByLabel(/dynasty name/i).fill('Demo Dynasty');
  await window.getByRole('button', { name: /^create$/i }).click();

  // Click the save's name link to open it. Use exact match to avoid
  // collision with the "Delete save Demo Dynasty" button.
  await window
    .getByRole('button', { name: 'Demo Dynasty', exact: true })
    .click({ timeout: 15_000 });

  // Match Hub loaded — wait for teams to populate.
  await expect(window.getByRole('heading', { name: /match hub/i })).toBeVisible();

  // Wait for dropdowns to have at least 2 real team options (> the placeholder).
  const homeSelect = window.getByRole('combobox', { name: /home team/i });
  await expect(homeSelect.locator('option')).toHaveCount(361, { timeout: 15_000 });
  // ^ 360 teams + 1 placeholder. If seeding differs, loosen to ">= 10".

  // Pick distinct teams by value index.
  const homeOptions = await homeSelect.locator('option').all();
  const homeId = (await homeOptions[1]!.getAttribute('value'))!;
  const awayId = (await homeOptions[2]!.getAttribute('value'))!;
  await homeSelect.selectOption(homeId);
  await window.getByRole('combobox', { name: /away team/i }).selectOption(awayId);

  // Sprint 19: button is now "Play match"; flow is sim → replay → done.
  await window.getByRole('button', { name: /^play match$/i }).click();

  // Wait for replay-ready (speed control + play toggle visible).
  await expect(window.getByTestId('speed-control')).toBeVisible({ timeout: 30_000 });

  // Skip to end to surface the final box score.
  await window.getByRole('button', { name: /skip to end/i }).click();
  await expect(window.getByTestId('match-status')).toContainText(/match complete/i, {
    timeout: 30_000,
  });

  // Final box score tables (one per team).
  const tables = window.locator('.match-hub__boxscore');
  await expect(tables).toHaveCount(2);

  // Stat cells exist in the box score.
  const cells = await window.locator('.match-hub__boxscore td').count();
  expect(cells).toBeGreaterThan(50); // 12 stat cols × 7 rows × 2 teams

  await app.close();
});
