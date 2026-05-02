import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

// Launches the Electron app from built output (main/dist/index.js) and asserts the
// renderer mounts the Save Slots entry screen with the correct window title.
// Satisfies Sprint 1 PRD exit test 3 and Sprint 2 user-flow coverage.
test('app launches and renders the Save Slots screen', async () => {
  const appRoot = path.resolve(__dirname, '../..');
  // Redirect userData away from the real %APPDATA%/VCD so the test doesn't clobber
  // any local saves. CLAUDE.md §Save-file compatibility — never touch real user data in CI.
  const isolatedUserData = path.join(appRoot, 'tests/test-results/e2e-userdata');
  const app = await electron.launch({
    args: [path.join(appRoot, 'main/dist/index.js')],
    cwd: appRoot,
    env: { ...process.env, VCD_USER_DATA: isolatedUserData },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  await expect(window).toHaveTitle('VCD');
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Save slots');

  await app.close();
});
