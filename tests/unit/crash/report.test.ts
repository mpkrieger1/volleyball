import { describe, expect, it } from 'vitest';
import { formatCrashRecord, CrashRecordSchema } from '../../../shared/src/crash/report';

describe('formatCrashRecord', () => {
  it('produces a zod-valid record from a plain Error', () => {
    const err = new Error('boom');
    const rec = formatCrashRecord(err, { processName: 'main' });
    const parsed = CrashRecordSchema.parse(rec);
    expect(parsed.errorName).toBe('Error');
    expect(parsed.message).toBe('boom');
    expect(parsed.processName).toBe('main');
    expect(typeof parsed.ts).toBe('string');
    // ISO 8601 timestamp.
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.stack).toBeTruthy();
  });

  it('captures error.name for non-generic errors', () => {
    class CustomError extends Error {
      override name = 'CustomError';
    }
    const rec = formatCrashRecord(new CustomError('x'), { processName: 'renderer' });
    expect(rec.errorName).toBe('CustomError');
  });

  it('handles non-Error values (e.g., thrown strings)', () => {
    const rec = formatCrashRecord('string was thrown', { processName: 'worker' });
    expect(rec.errorName).toBe('UnknownError');
    expect(rec.message).toBe('string was thrown');
    expect(rec.stack).toBe(null);
  });

  it('captures optional context fields without exposing arbitrary data', () => {
    const rec = formatCrashRecord(new Error('x'), {
      processName: 'main',
      phase: 'advanceWeek',
      vcdVersion: '0.1.0',
    });
    expect(rec.phase).toBe('advanceWeek');
    expect(rec.vcdVersion).toBe('0.1.0');
  });

  it('refuses to serialize ad-hoc context payload (PII guard)', () => {
    const rec = formatCrashRecord(new Error('x'), {
      processName: 'main',
      // @ts-expect-error — saveDb is not in the allowed context schema
      saveDb: '/Users/x/private/game.db',
    });
    expect((rec as unknown as { saveDb?: string }).saveDb).toBeUndefined();
  });
});
