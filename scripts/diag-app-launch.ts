// Diagnostic: launch the packaged-style Electron app via Playwright and
// print every renderer-side console message + page error. Used to debug
// blank-screen / runtime-error issues that don't surface in the main
// process log.

import { _electron as electron } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

async function main(): Promise<void> {
  const isolated = path.join(appRoot, 'tests/test-results/diag-launch-userdata');
  const app = await electron.launch({
    args: [path.join(appRoot, 'main/dist/index.js')],
    cwd: appRoot,
    env: { ...process.env, VCD_USER_DATA: isolated },
  });
  const window = await app.firstWindow();

  window.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log(`[renderer:${msg.type()}] ${msg.text()}`);
  });
  window.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[renderer:pageerror] ${err.message}\n${err.stack}`);
  });

  await window.waitForLoadState('domcontentloaded');
  // Give the renderer 5s to mount + run any initial useEffect that might throw.
  await window.waitForTimeout(5000);

  const html = await window.content();
  // eslint-disable-next-line no-console
  console.log('=== ROOT INNER HTML (first 1000 chars) ===');
  // eslint-disable-next-line no-console
  console.log(html.slice(0, 1000));

  const rootChildCount = await window.evaluate(() => {
    return document.getElementById('root')?.children.length ?? -1;
  });
  // eslint-disable-next-line no-console
  console.log(`=== #root child count: ${rootChildCount} ===`);

  await app.close();
}

void main();
