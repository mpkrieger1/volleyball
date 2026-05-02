// Sprint 23: structured crash record schema + pure formatter.
//
// PII guard: the formatter only includes fields that are explicitly part
// of the schema. Callers cannot smuggle in arbitrary payload (DB rows,
// save names, file paths) by passing extra context keys — they get
// dropped at the formatter boundary.

import { z } from 'zod';

export const ProcessNameSchema = z.enum(['main', 'renderer', 'worker']);
export type ProcessName = z.infer<typeof ProcessNameSchema>;

export const CrashContextSchema = z.object({
  processName: ProcessNameSchema,
  phase: z.string().max(64).optional(),
  vcdVersion: z.string().max(32).optional(),
});
export type CrashContext = z.infer<typeof CrashContextSchema>;

export const CrashRecordSchema = z.object({
  ts: z.string(), // ISO 8601
  processName: ProcessNameSchema,
  errorName: z.string(),
  message: z.string(),
  stack: z.string().nullable(),
  phase: z.string().optional(),
  vcdVersion: z.string().optional(),
});
export type CrashRecord = z.infer<typeof CrashRecordSchema>;

export function formatCrashRecord(err: unknown, context: CrashContext): CrashRecord {
  const ctx = CrashContextSchema.parse(context);
  const ts = new Date().toISOString();
  if (err instanceof Error) {
    return {
      ts,
      processName: ctx.processName,
      errorName: err.name || 'Error',
      message: err.message,
      stack: err.stack ?? null,
      ...(ctx.phase !== undefined ? { phase: ctx.phase } : {}),
      ...(ctx.vcdVersion !== undefined ? { vcdVersion: ctx.vcdVersion } : {}),
    };
  }
  // Non-Error throws (string, number, object literal). Don't expose object
  // keys — only stringify.
  return {
    ts,
    processName: ctx.processName,
    errorName: 'UnknownError',
    message: typeof err === 'string' ? err : String(err),
    stack: null,
    ...(ctx.phase !== undefined ? { phase: ctx.phase } : {}),
    ...(ctx.vcdVersion !== undefined ? { vcdVersion: ctx.vcdVersion } : {}),
  };
}
