import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configureCrashRecorder,
  getCrashLogPath,
  isCrashRecorderEnabled,
  recordCrash,
  setCrashRecorderEnabled,
} from '../../../main/src/crash/recorder';
import { formatCrashRecord } from '../../../shared/src/crash/report';

let tmpDir: string;
let logPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-crash-'));
  logPath = join(tmpDir, 'vcd-crash.log');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('crash recorder', () => {
  it('writes nothing when disabled (default)', () => {
    configureCrashRecorder({ logPath, enabled: false });
    expect(isCrashRecorderEnabled()).toBe(false);
    recordCrash(formatCrashRecord(new Error('x'), { processName: 'main' }));
    expect(existsSync(logPath)).toBe(false);
  });

  it('appends an NDJSON line when enabled', () => {
    configureCrashRecorder({ logPath, enabled: true });
    expect(getCrashLogPath()).toBe(logPath);
    recordCrash(formatCrashRecord(new Error('alpha'), { processName: 'main' }));
    recordCrash(formatCrashRecord(new Error('beta'), { processName: 'worker' }));
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).message).toBe('alpha');
    expect(JSON.parse(lines[1]!).message).toBe('beta');
    expect(JSON.parse(lines[1]!).processName).toBe('worker');
  });

  it('toggles via setCrashRecorderEnabled', () => {
    configureCrashRecorder({ logPath, enabled: true });
    recordCrash(formatCrashRecord(new Error('on'), { processName: 'main' }));
    setCrashRecorderEnabled(false);
    recordCrash(formatCrashRecord(new Error('off'), { processName: 'main' }));
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).message).toBe('on');
  });

  it('rotates to .old when active log exceeds 5 MB', () => {
    configureCrashRecorder({ logPath, enabled: true });
    // Pre-create a >5MB file under the active path so the next call rotates.
    const big = 'x'.repeat(5 * 1024 * 1024 + 1024);
    writeFileSync(logPath, big);
    recordCrash(formatCrashRecord(new Error('after-rotate'), { processName: 'main' }));
    expect(existsSync(`${logPath}.old`)).toBe(true);
    expect(statSync(`${logPath}.old`).size).toBeGreaterThan(5 * 1024 * 1024);
    // New file is small.
    expect(statSync(logPath).size).toBeLessThan(2 * 1024);
  });

  it('never throws even with an invalid path', () => {
    configureCrashRecorder({ logPath: '\\\\\\?\\bad\\??\\path\\nope.log', enabled: true });
    expect(() =>
      recordCrash(formatCrashRecord(new Error('x'), { processName: 'main' })),
    ).not.toThrow();
  });
});
