import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  recordPerf,
  recordPerfAsync,
  flushPerfLog,
  getPerfBuffer,
  resetPerfBufferForTest,
  isPerfEnabled,
} from '../../../shared/src/perf/timer';

let tmpRoot: string;

beforeEach(() => {
  resetPerfBufferForTest();
  delete process.env.VCD_PERF;
  tmpRoot = mkdtempSync(join(tmpdir(), 'vcd-perf-'));
});

afterEach(() => {
  resetPerfBufferForTest();
  delete process.env.VCD_PERF;
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('recordPerf (sync)', () => {
  it('returns the wrapped function result regardless of env', () => {
    const result = recordPerf('test', () => 42);
    expect(result).toBe(42);
  });

  it('is a no-op when VCD_PERF is unset', () => {
    recordPerf('foo', () => 1);
    recordPerf('bar', () => 2);
    expect(getPerfBuffer().length).toBe(0);
  });

  it('records {label, elapsedMs, ts} when VCD_PERF=1', () => {
    process.env.VCD_PERF = '1';
    recordPerf('foo', () => {
      // burn a touch of time so elapsedMs is non-negative even on fast machines
      let s = 0;
      for (let i = 0; i < 1000; i++) s += i;
      return s;
    });
    const buf = getPerfBuffer();
    expect(buf.length).toBe(1);
    expect(buf[0]?.label).toBe('foo');
    expect(typeof buf[0]?.elapsedMs).toBe('number');
    expect(buf[0]!.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof buf[0]?.ts).toBe('number');
  });

  it('propagates thrown errors and still returns to caller', () => {
    process.env.VCD_PERF = '1';
    expect(() =>
      recordPerf('boom', () => {
        throw new Error('nope');
      }),
    ).toThrow('nope');
    // even on throw, we should record the elapsed time so leaks are observable
    expect(getPerfBuffer().length).toBe(1);
  });
});

describe('recordPerfAsync', () => {
  it('returns the awaited result', async () => {
    const result = await recordPerfAsync('async', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('records the elapsed time when VCD_PERF=1', async () => {
    process.env.VCD_PERF = '1';
    await recordPerfAsync('asyncJob', async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const buf = getPerfBuffer();
    expect(buf.length).toBe(1);
    expect(buf[0]?.label).toBe('asyncJob');
    expect(buf[0]!.elapsedMs).toBeGreaterThanOrEqual(4);
  });

  it('is a no-op when env is unset', async () => {
    await recordPerfAsync('asyncJob', async () => 1);
    expect(getPerfBuffer().length).toBe(0);
  });
});

describe('flushPerfLog', () => {
  it('writes accumulated entries as NDJSON and clears the buffer', () => {
    process.env.VCD_PERF = '1';
    recordPerf('a', () => 0);
    recordPerf('b', () => 0);
    const path = join(tmpRoot, 'perf.log');
    const writtenCount = flushPerfLog(path);
    expect(writtenCount).toBe(2);
    expect(getPerfBuffer().length).toBe(0);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ label: 'a' });
    expect(JSON.parse(lines[1]!)).toMatchObject({ label: 'b' });
  });

  it('returns 0 and does not create a file when buffer is empty', () => {
    const path = join(tmpRoot, 'empty.log');
    expect(flushPerfLog(path)).toBe(0);
  });
});

describe('isPerfEnabled', () => {
  it('reflects VCD_PERF env var', () => {
    expect(isPerfEnabled()).toBe(false);
    process.env.VCD_PERF = '1';
    expect(isPerfEnabled()).toBe(true);
    process.env.VCD_PERF = '0';
    expect(isPerfEnabled()).toBe(false);
  });
});

describe('ring buffer cap', () => {
  it('caps at 10,000 entries (drops oldest)', () => {
    process.env.VCD_PERF = '1';
    for (let i = 0; i < 10_005; i++) recordPerf(`label-${i}`, () => 0);
    const buf = getPerfBuffer();
    expect(buf.length).toBe(10_000);
    // oldest 5 should have been dropped
    expect(buf[0]?.label).toBe('label-5');
    expect(buf[buf.length - 1]?.label).toBe('label-10004');
  });
});
