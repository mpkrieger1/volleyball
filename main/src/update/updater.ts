// Sprint 24 Task 24.3: electron-updater wiring.
//
// On packaged builds with diagnostics enabled, this calls into
// `autoUpdater.checkForUpdatesAndNotify()` shortly after the main
// window is ready. In dev (or when diagnostics is off) this is a no-op.
//
// The actual electron-updater module is a runtime-only Electron
// dependency; pure logic (gating, status state) lives in `updaterGate.ts`
// and is unit-tested separately.

import { app } from 'electron';
import { checkForUpdatesGated, shouldAutoCheck, type CheckForUpdatesResult } from './updaterGate';

let runner: (() => Promise<unknown>) | null = null;

/** Lazy-load electron-updater so dev mode (and tests) don't pay the cost. */
async function getRunner(): Promise<(() => Promise<unknown>) | null> {
  if (runner) return runner;
  try {
    const { autoUpdater } = await import('electron-updater');
    runner = () => autoUpdater.checkForUpdatesAndNotify();
    return runner;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[updater] electron-updater not available:', err);
    return null;
  }
}

export async function autoCheckIfEnabled(opts: { diagnosticsEnabled: boolean }): Promise<void> {
  if (!shouldAutoCheck({ diagnosticsEnabled: opts.diagnosticsEnabled, isPackaged: app.isPackaged })) {
    return;
  }
  const r = await getRunner();
  if (!r) return;
  await checkForUpdatesGated({ isPackaged: true, runner: r });
}

export async function checkForUpdatesNow(): Promise<CheckForUpdatesResult> {
  if (!app.isPackaged) {
    return checkForUpdatesGated({ isPackaged: false });
  }
  const r = await getRunner();
  if (!r) {
    return { ok: false, status: 'error', message: 'electron-updater unavailable' };
  }
  return checkForUpdatesGated({ isPackaged: true, runner: r });
}
