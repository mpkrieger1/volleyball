import { z } from 'zod';

export const GetLatestPollRequest = z.object({ slotId: z.string().min(1) });
export type GetLatestPollRequest = z.infer<typeof GetLatestPollRequest>;

export const PollRowView = z.object({
  rank: z.number().int().min(1).max(25),
  teamId: z.string(),
  teamSchool: z.string(),
  teamAbbr: z.string(),
  record: z.string(), // "12-2"
  firstPlaceVotes: z.number().int().nonnegative(),
  prevRank: z.number().int().nullable(),
  delta: z.string(), // "↑N" | "↓N" | "—" | "NEW"
});
export type PollRowView = z.infer<typeof PollRowView>;

export const GetLatestPollOk = z.object({
  ok: z.literal(true),
  week: z.number().int().nonnegative(),
  rows: z.array(PollRowView),
});
export const GetLatestPollErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetLatestPollResponse = z.discriminatedUnion('ok', [
  GetLatestPollOk,
  GetLatestPollErr,
]);
export type GetLatestPollResponse = z.infer<typeof GetLatestPollResponse>;

export const POLL_IPC_CHANNELS = {
  latest: 'poll:latest',
} as const;
