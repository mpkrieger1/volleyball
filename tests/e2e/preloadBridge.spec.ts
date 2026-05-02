// Sprint 6 retro canary: if the preload silently stops loading again (e.g.,
// someone flips sandbox back to true without bundling), this test catches it
// before any feature regression.

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('preload exposes window.vcd with saveSlots + match bridges', async () => {
  const appRoot = path.resolve(__dirname, '../..');
  const isolatedUserData = path.join(appRoot, 'tests/test-results/e2e-preload-userdata');

  const app = await electron.launch({
    args: [path.join(appRoot, 'main/dist/index.js')],
    cwd: appRoot,
    env: { ...process.env, VCD_USER_DATA: isolatedUserData },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Assert the bridge exists and the expected surface is present.
  const surface = await window.evaluate(() => {
    const w = window as unknown as { vcd?: unknown };
    if (!w.vcd) return null;
    const v = w.vcd as Record<string, unknown>;
    return {
      hasVersion: typeof v.version === 'string',
      hasSaveSlots: typeof v.saveSlots === 'object' && v.saveSlots !== null,
      hasMatch: typeof v.match === 'object' && v.match !== null,
    };
  });

  expect(surface).not.toBeNull();
  expect(surface).toEqual({ hasVersion: true, hasSaveSlots: true, hasMatch: true });

  // Round-trip a real IPC call to prove the channel works end-to-end.
  const listResult = await window.evaluate(async () => {
    const w = window as unknown as { vcd: { saveSlots: { list(): Promise<unknown> } } };
    return w.vcd.saveSlots.list();
  });
  expect(listResult).toMatchObject({ ok: true });

  await app.close();
});
