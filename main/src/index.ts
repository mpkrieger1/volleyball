import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { perf, crash } from '@vcd/shared';
import { configureCrashRecorder, isCrashRecorderEnabled, recordCrash } from './crash/recorder';
import { createWindowOptions, rendererEntry } from './windowConfig';
import { registerSaveSlotHandlers } from './ipc/saveSlotHandlers';
import { registerMatchHandlers } from './ipc/matchHandlers';
import { registerScheduleHandlers } from './ipc/scheduleHandlers';
import { registerSeasonHandlers, disposeAllSeasonPools } from './ipc/seasonHandlers';
import { registerPollHandlers } from './ipc/pollHandlers';
import { registerBracketHandlers } from './ipc/bracketHandlers';
import { registerPostseasonHandlers } from './ipc/postseasonHandlers';
import { registerRecruitingHandlers } from './ipc/recruitingHandlers';
import { registerPortalHandlers } from './ipc/portalHandlers';
import { registerNilHandlers } from './ipc/nilHandlers';
import { registerOffseasonHandlers } from './ipc/offseasonHandlers';
import { registerCoachingHandlers } from './ipc/coachingHandlers';
import { registerAwardsHandlers } from './ipc/awardsHandlers';
import { registerScoutHandlers } from './ipc/scoutHandlers';
import { registerCrashHandlers } from './ipc/crashHandlers';
import { registerUpdateHandlers } from './ipc/updateHandlers';
import { autoCheckIfEnabled } from './update/updater';

const USER_DATA = process.env.VCD_USER_DATA ?? app.getPath('userData');
const LOG_PATH = path.join(USER_DATA, 'vcd-main.log');
const CRASH_LOG_PATH = path.join(USER_DATA, 'vcd-crash.log');
function logLine(msg: string) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* ignore */
  }
}
// Sprint 23: crash recorder is opt-out by default; renderer calls
// `crash.setEnabled` over IPC at startup if the user has opted in.
configureCrashRecorder({ logPath: CRASH_LOG_PATH, enabled: false });

process.on('uncaughtException', (err) => {
  logLine(`uncaughtException: ${err.stack ?? String(err)}`);
  recordCrash(crash.formatCrashRecord(err, { processName: 'main', phase: 'uncaughtException' }));
});
process.on('unhandledRejection', (reason) => {
  logLine(`unhandledRejection: ${String(reason)}`);
  recordCrash(
    crash.formatCrashRecord(reason, { processName: 'main', phase: 'unhandledRejection' }),
  );
});
logLine('main process start');

const isDev = process.env.VCD_DEV === '1';

function resolveRepoRoot(): string {
  // In dev & Playwright launches we run main/dist/index.js so repo root is two levels up.
  // In packaged builds, resources are inside the asar; repo-side prisma schema is copied by
  // electron-builder config and we rely on app.getAppPath().
  if (app.isPackaged) return app.getAppPath();
  return path.resolve(__dirname, '../..');
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow(createWindowOptions({ mainDir: __dirname, isDev }));
  win.once('ready-to-show', () => win.show());
  void win.loadURL(rendererEntry({ mainDir: __dirname, isDev }));
  return win;
}

app.whenReady().then(() => {
  logLine('app ready');
  const baseDir = process.env.VCD_USER_DATA ?? app.getPath('userData');
  const deps = { baseDir, repoRoot: resolveRepoRoot() };
  registerSaveSlotHandlers(deps);
  registerMatchHandlers(deps);
  registerScheduleHandlers(deps);
  registerSeasonHandlers(deps);
  registerPollHandlers(deps);
  registerBracketHandlers(deps);
  registerPostseasonHandlers(deps);
  registerRecruitingHandlers(deps);
  registerPortalHandlers(deps);
  registerNilHandlers(deps);
  registerOffseasonHandlers(deps);
  registerCoachingHandlers(deps);
  registerAwardsHandlers(deps);
  registerScoutHandlers(deps);
  registerCrashHandlers();
  registerUpdateHandlers();
  logLine('handlers registered');
  createMainWindow();
  logLine('main window created');
  // Sprint 24: auto-check for updates ~5s after launch IFF diagnostics
  // is enabled. The renderer pushes its persisted preference via
  // `crash:setEnabled` IPC at startup; until that arrives, the recorder
  // is OFF, so the auto-check is a no-op for first-time users.
  setTimeout(() => {
    void autoCheckIfEnabled({ diagnosticsEnabled: isCrashRecorderEnabled() }).catch((err) => {
      logLine(`auto-update check failed: ${String(err)}`);
    });
  }, 5_000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch((err) => {
  logLine(`whenReady failed: ${String(err)}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let didDrainPools = false;
app.on('before-quit', async (evt) => {
  if (didDrainPools) return;
  evt.preventDefault();
  didDrainPools = true;
  await disposeAllSeasonPools();
  // Sprint 23: flush perf log under VCD_PERF=1; no-op otherwise.
  if (perf.isPerfEnabled()) {
    try {
      const baseDir = process.env.VCD_USER_DATA ?? app.getPath('userData');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const perfPath = path.join(baseDir, `vcd-perf-${stamp}.log`);
      const count = perf.flushPerfLog(perfPath);
      logLine(`flushed ${count} perf entries to ${perfPath}`);
    } catch (err) {
      logLine(`perf flush failed: ${String(err)}`);
    }
  }
  app.exit(0);
});
