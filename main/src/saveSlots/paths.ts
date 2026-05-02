import path from 'node:path';

// Env lets tests redirect away from the real %APPDATA%/VCD. Never let Playwright
// or integration tests write to a user's real saves directory.
export type SaveSlotPathEnv = { baseDir: string };

export function resolveSaveSlotsRoot(env: SaveSlotPathEnv): string {
  return path.join(env.baseDir, 'VCD', 'saves');
}

export function resolveSaveSlotDir(env: SaveSlotPathEnv, slotId: string): string {
  return path.join(resolveSaveSlotsRoot(env), slotId);
}

export function resolveSaveSlotDbPath(env: SaveSlotPathEnv, slotId: string): string {
  return path.join(resolveSaveSlotDir(env, slotId), 'game.db');
}
