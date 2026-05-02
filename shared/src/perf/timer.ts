// Sprint 23: lightweight in-process perf timer. Active only under
// `VCD_PERF=1`. Zero overhead when the env var is unset — the wrappers
// short-circuit and return the inner result with no buffer allocation.
//
// Usage:
//   import { recordPerfAsync } from '@vcd/shared/perf';
//   const out = await recordPerfAsync('advanceWeek', async () => doWork());
//
// Flush on `app.before-quit`:
//   import { flushPerfLog } from '@vcd/shared/perf';
//   flushPerfLog(path.join(userData, `vcd-perf-${new Date().toISOString()}.log`));

import { appendFileSync } from 'node:fs';

export type PerfEntry = {
  label: string;
  elapsedMs: number;
  /** epoch ms */
  ts: number;
};

const RING_CAP = 10_000;

let buffer: PerfEntry[] = [];

export function isPerfEnabled(): boolean {
  return process.env.VCD_PERF === '1';
}

function pushEntry(entry: PerfEntry): void {
  buffer.push(entry);
  if (buffer.length > RING_CAP) {
    buffer.splice(0, buffer.length - RING_CAP);
  }
}

export function recordPerf<T>(label: string, fn: () => T): T {
  if (!isPerfEnabled()) return fn();
  const t0 = performance.now();
  const ts = Date.now();
  try {
    return fn();
  } finally {
    pushEntry({ label, elapsedMs: performance.now() - t0, ts });
  }
}

export async function recordPerfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfEnabled()) return fn();
  const t0 = performance.now();
  const ts = Date.now();
  try {
    return await fn();
  } finally {
    pushEntry({ label, elapsedMs: performance.now() - t0, ts });
  }
}

/**
 * Write the accumulated perf entries to `path` as NDJSON and clear the
 * buffer. Returns the number of entries written. No-ops + does not
 * create the file if the buffer is empty.
 */
export function flushPerfLog(path: string): number {
  if (buffer.length === 0) return 0;
  const lines = buffer.map((e) => JSON.stringify(e)).join('\n') + '\n';
  appendFileSync(path, lines, 'utf8');
  const count = buffer.length;
  buffer = [];
  return count;
}

/** Snapshot the current buffer (read-only copy). */
export function getPerfBuffer(): readonly PerfEntry[] {
  return buffer.slice();
}

/** Test-only reset. Not part of the public production API. */
export function resetPerfBufferForTest(): void {
  buffer = [];
}
