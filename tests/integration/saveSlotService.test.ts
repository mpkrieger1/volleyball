import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  createSaveSlot,
  deleteSaveSlot,
  listSaveSlots,
  openSaveSlot,
  SaveSlotError,
} from '../../main/src/saveSlots/service';
import { resolveSaveSlotDbPath } from '../../main/src/saveSlots/paths';

const repoRoot = resolve(__dirname, '../..');
let baseDir: string;

beforeAll(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'vcd-slotsvc-'));
});

afterAll(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe('save slot service', () => {
  const deps = () => ({ baseDir, repoRoot });

  it('creates a slot that persists as a game.db file', async () => {
    const slot = await createSaveSlot(deps(), 'Alpha Dynasty');
    expect(slot.name).toBe('Alpha Dynasty');
    expect(slot.dynastyYear).toBe(2026);
    // slot dir is slugified from name
    const dbPath = resolveSaveSlotDbPath(deps(), 'alpha-dynasty');
    expect(existsSync(dbPath)).toBe(true);
  }, 30_000);

  it('rejects duplicate names with a typed error', async () => {
    await expect(createSaveSlot(deps(), 'Alpha Dynasty')).rejects.toBeInstanceOf(SaveSlotError);
    await expect(createSaveSlot(deps(), 'Alpha Dynasty')).rejects.toMatchObject({
      code: 'DUPLICATE_NAME',
    });
  });

  it('lists created slots', async () => {
    const slots = await listSaveSlots(deps());
    expect(slots.length).toBe(1);
    expect(slots[0]?.name).toBe('Alpha Dynasty');
  });

  it('open() bumps lastOpenedAt', async () => {
    const [slot] = await listSaveSlots(deps());
    const before = slot!.lastOpenedAt;
    await new Promise((r) => setTimeout(r, 10));
    const opened = await openSaveSlot(deps(), slot!.id);
    expect(opened.lastOpenedAt.localeCompare(before)).toBeGreaterThanOrEqual(0);
  });

  it('delete removes the slot dir and it disappears from list()', async () => {
    const [slot] = await listSaveSlots(deps());
    await deleteSaveSlot(deps(), slot!.id);
    expect(existsSync(resolveSaveSlotDbPath(deps(), 'alpha-dynasty'))).toBe(false);
    expect(await listSaveSlots(deps())).toEqual([]);
  });

  it('delete on unknown id throws NOT_FOUND', async () => {
    await expect(deleteSaveSlot(deps(), 'does-not-exist')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects empty names with INVALID_INPUT', async () => {
    await expect(createSaveSlot(deps(), '   ')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
