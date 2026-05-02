import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createWindowOptions, rendererEntry, WINDOW_TITLE } from '../../main/src/windowConfig';

const env = { mainDir: '/fake/main/dist', isDev: false };

describe('createWindowOptions', () => {
  it('uses the VCD window title', () => {
    expect(createWindowOptions(env).title).toBe('VCD');
    expect(WINDOW_TITLE).toBe('VCD');
  });

  it('enforces secure webPreferences defaults (contextIsolation on, nodeIntegration off)', () => {
    const opts = createWindowOptions(env);
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
    // sandbox intentionally false so preload can require('@vcd/shared').
    // See windowConfig.ts for the security rationale.
    expect(opts.webPreferences.sandbox).toBe(false);
  });

  it('points preload at the compiled preload.js next to index.js', () => {
    const opts = createWindowOptions(env);
    expect(opts.webPreferences.preload).toBe(path.join('/fake/main/dist', 'preload.js'));
  });

  it('disables devTools in packaged builds', () => {
    expect(createWindowOptions({ ...env, isDev: false }).webPreferences.devTools).toBe(false);
    expect(createWindowOptions({ ...env, isDev: true }).webPreferences.devTools).toBe(true);
  });
});

describe('rendererEntry', () => {
  it('points at the Vite dev server in dev', () => {
    expect(rendererEntry({ ...env, isDev: true })).toBe('http://localhost:5173');
  });

  it('points at the built renderer in prod', () => {
    expect(rendererEntry({ ...env, isDev: false })).toMatch(/^file:\/\/.*app[\\/]dist[\\/]index\.html$/);
  });
});
