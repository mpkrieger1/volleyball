// Sprint 23: append-only crash log writer for the main process.
//
// Local-only by design (no upload in v1). Gated by an opt-in flag in
// renderer-side Settings; the recorder's `enabled` property is set via
// IPC from the renderer at startup. Default is OPT-OUT — no crash data
// is written until the user opts in via Settings.
//
// File format: NDJSON (one JSON record per line) at
// `<userData>/vcd-crash.log`. Rotates to `vcd-crash.log.old` when the
// active log exceeds 5 MB.

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import type { crash } from '@vcd/shared';

type CrashRecord = crash.CrashRecord;

const ROTATION_BYTES = 5 * 1024 * 1024;

let logPath: string | null = null;
let enabled = false;

export function configureCrashRecorder(opts: { logPath: string; enabled: boolean }): void {
  logPath = opts.logPath;
  enabled = opts.enabled;
}

export function setCrashRecorderEnabled(value: boolean): void {
  enabled = value;
}

export function isCrashRecorderEnabled(): boolean {
  return enabled;
}

export function getCrashLogPath(): string | null {
  return logPath;
}

export function recordCrash(record: CrashRecord): void {
  if (!enabled || !logPath) return;
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    rotateIfNeeded(logPath);
    appendFileSync(logPath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch {
    /* never throw from the crash path */
  }
}

function rotateIfNeeded(path: string): void {
  if (!existsSync(path)) return;
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    return;
  }
  if (size <= ROTATION_BYTES) return;
  try {
    renameSync(path, `${path}.old`);
  } catch {
    /* best effort */
  }
}
