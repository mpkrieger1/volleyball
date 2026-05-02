// Per-slotId worker-pool registry shared by seasonHandlers and
// postseasonHandlers (both need a SimWorkerPool bound to the open save slot).

import { resolve } from 'node:path';
import os from 'node:os';
import { SimWorkerPool } from './workerPool';
import type { SaveSlotServiceDeps } from '../saveSlots/service';

const pools = new Map<string, SimWorkerPool>();

export function getOrCreatePool(
  deps: SaveSlotServiceDeps,
  slotId: string,
): SimWorkerPool {
  let pool = pools.get(slotId);
  if (!pool) {
    const scriptPath = resolve(deps.repoRoot, 'workers/dist/simWorkerThread.js');
    const workerCount = Math.min(4, Math.max(2, Math.floor((os.cpus().length || 4) / 2)));
    pool = new SimWorkerPool({ scriptPath, workerCount });
    pools.set(slotId, pool);
  }
  return pool;
}

export async function disposeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.shutdown()));
  pools.clear();
}
