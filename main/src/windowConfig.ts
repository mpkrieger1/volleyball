// Pure helper: compute BrowserWindow options. Kept separate from index.ts so it
// can be unit-tested without importing Electron.

import path from 'node:path';

export const WINDOW_TITLE = 'VCD' as const;

export type WindowConfig = {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  title: string;
  backgroundColor: string;
  show: boolean;
  webPreferences: {
    preload: string;
    contextIsolation: true;
    nodeIntegration: false;
    sandbox: false;
    devTools: boolean;
  };
};

export type WindowConfigEnv = {
  /** __dirname of the compiled main/index.js at runtime. */
  mainDir: string;
  /** True in dev (Vite HMR); false in packaged build. */
  isDev: boolean;
};

export function createWindowOptions(env: WindowConfigEnv): WindowConfig {
  return {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: WINDOW_TITLE,
    backgroundColor: '#0b0d10',
    show: false,
    webPreferences: {
      preload: path.join(env.mainDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false — preload requires '@vcd/shared' which isn't on the
      // Electron sandbox whitelist. Security still strong via contextIsolation
      // + nodeIntegration=false. If we ever bundle the preload as a standalone
      // script (esbuild), flip this back to true.
      sandbox: false,
      devTools: env.isDev,
    },
  };
}

export function rendererEntry(env: WindowConfigEnv): string {
  if (env.isDev) return 'http://localhost:5173';
  return `file://${path.resolve(env.mainDir, '../../app/dist/index.html')}`;
}
