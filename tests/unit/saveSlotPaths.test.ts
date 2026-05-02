import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  resolveSaveSlotDbPath,
  resolveSaveSlotDir,
  resolveSaveSlotsRoot,
} from '../../main/src/saveSlots/paths';

const env = { baseDir: '/tmp/fake-userdata' };

describe('save slot path helpers', () => {
  it('scopes everything under VCD/saves', () => {
    expect(resolveSaveSlotsRoot(env)).toBe(path.join('/tmp/fake-userdata', 'VCD', 'saves'));
  });

  it('puts each slot in its own subdirectory', () => {
    expect(resolveSaveSlotDir(env, 'my-save')).toBe(
      path.join('/tmp/fake-userdata', 'VCD', 'saves', 'my-save'),
    );
  });

  it('names the db game.db inside the slot dir', () => {
    expect(resolveSaveSlotDbPath(env, 'my-save')).toBe(
      path.join('/tmp/fake-userdata', 'VCD', 'saves', 'my-save', 'game.db'),
    );
  });
});
