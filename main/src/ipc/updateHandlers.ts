// Sprint 24 Task 24.3: IPC handlers for the auto-updater.
//   update:checkNow — manual "Check for updates" button. Bypasses
//                     the diagnostics opt-in (manual override).

import { ipcMain } from 'electron';
import { checkForUpdatesNow } from '../update/updater';

export function registerUpdateHandlers(): void {
  ipcMain.handle('update:checkNow', async () => {
    const result = await checkForUpdatesNow();
    return result;
  });
}
