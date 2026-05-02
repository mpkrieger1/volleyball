import { ipcMain } from 'electron';
import { saveSlotIpc } from '@vcd/shared';
const { CreateSaveSlotRequest, DeleteSaveSlotRequest, IPC_CHANNELS, OpenSaveSlotRequest } =
  saveSlotIpc;
import {
  createSaveSlot,
  deleteSaveSlot,
  listSaveSlots,
  openSaveSlot,
  SaveSlotError,
  type SaveSlotServiceDeps,
} from '../saveSlots/service';

function toIpcError(err: unknown) {
  if (err instanceof SaveSlotError) {
    return { ok: false as const, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false as const,
    error: { code: 'IO_ERROR' as const, message: (err as Error).message },
  };
}

export function registerSaveSlotHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(IPC_CHANNELS.list, async () => {
    try {
      return { ok: true as const, slots: await listSaveSlots(deps) };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.create, async (_e, raw: unknown) => {
    try {
      const req = CreateSaveSlotRequest.parse(raw);
      return { ok: true as const, slot: await createSaveSlot(deps, req.name) };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.open, async (_e, raw: unknown) => {
    try {
      const req = OpenSaveSlotRequest.parse(raw);
      return { ok: true as const, slot: await openSaveSlot(deps, req.id) };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.delete, async (_e, raw: unknown) => {
    try {
      const req = DeleteSaveSlotRequest.parse(raw);
      await deleteSaveSlot(deps, req.id);
      return { ok: true as const };
    } catch (err) {
      return toIpcError(err);
    }
  });
}
