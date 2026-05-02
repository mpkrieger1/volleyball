// Sprint 23: IPC handlers for the crash reporter.
//   crash:report     — renderer → main: append a crash record (only when
//                      the recorder is enabled).
//   crash:setEnabled — renderer → main: toggle the recorder. Persistence
//                      lives on the renderer side (localStorage); main
//                      mirrors the current value in-memory.

import { ipcMain } from 'electron';
import { crash } from '@vcd/shared';
import { recordCrash, setCrashRecorderEnabled } from '../crash/recorder';

export function registerCrashHandlers(): void {
  ipcMain.handle('crash:report', async (_evt, payload: unknown) => {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as { message?: unknown }).message !== 'string'
    ) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Bad payload' } };
    }
    const p = payload as { name?: string; message: string; stack?: string | null; componentStack?: string | null };
    const synthetic = new Error(p.message);
    synthetic.name = p.name ?? 'Error';
    if (p.stack) synthetic.stack = p.stack;
    const record = crash.formatCrashRecord(synthetic, {
      processName: 'renderer',
      ...(p.componentStack ? { phase: 'react-render' } : {}),
    });
    recordCrash(record);
    return { ok: true };
  });

  ipcMain.handle('crash:setEnabled', async (_evt, payload: unknown) => {
    if (typeof (payload as { enabled?: unknown })?.enabled !== 'boolean') {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Bad payload' } };
    }
    setCrashRecorderEnabled((payload as { enabled: boolean }).enabled);
    return { ok: true };
  });
}
