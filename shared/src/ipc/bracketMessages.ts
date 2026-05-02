import { z } from 'zod';

export const BRACKET_REGIONS = ['REGION_1', 'REGION_2', 'REGION_3', 'REGION_4'] as const;
export const BracketRegion = z.enum(BRACKET_REGIONS);
export type BracketRegion = z.infer<typeof BracketRegion>;

export const BRACKET_METRICS = ['RPI', 'NET'] as const;
export const BracketMetric = z.enum(BRACKET_METRICS);
export type BracketMetric = z.infer<typeof BracketMetric>;

export const GenerateBracketRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
  metric: BracketMetric.default('RPI'),
});
export type GenerateBracketRequest = z.infer<typeof GenerateBracketRequest>;

export const BracketEntryView = z.object({
  region: BracketRegion,
  seed: z.number().int().min(1).max(16),
  teamId: z.string(),
  teamSchool: z.string(),
  teamAbbr: z.string(),
  autoBid: z.boolean(),
  metricRank: z.number().int().min(1),
});
export type BracketEntryView = z.infer<typeof BracketEntryView>;

export const GenerateBracketOk = z.object({
  ok: z.literal(true),
  seasonYear: z.number().int(),
  metric: BracketMetric,
  entries: z.array(BracketEntryView),
});
export const GenerateBracketErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GenerateBracketResponse = z.discriminatedUnion('ok', [
  GenerateBracketOk,
  GenerateBracketErr,
]);
export type GenerateBracketResponse = z.infer<typeof GenerateBracketResponse>;

export const GetLatestBracketRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
});
export type GetLatestBracketRequest = z.infer<typeof GetLatestBracketRequest>;

export const BRACKET_IPC_CHANNELS = {
  generate: 'bracket:generate',
  latest: 'bracket:latest',
} as const;
