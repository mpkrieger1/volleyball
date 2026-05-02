// Typed IPC contracts between renderer, main, and workers.
// CLAUDE.md §Repo layout: "IPC ... is strictly typed via zod schemas in /shared.
// Do not send untyped messages across the process boundary."
//
// Sprint 1 only lands a ping/pong pair so the pattern is in place for Sprint 3+.

import { z } from 'zod';

export const PingMessage = z.object({
  kind: z.literal('ping'),
  id: z.string().min(1),
  sentAt: z.number().int().nonnegative(),
});
export type PingMessage = z.infer<typeof PingMessage>;

export const PongMessage = z.object({
  kind: z.literal('pong'),
  id: z.string().min(1),
  sentAt: z.number().int().nonnegative(),
  receivedAt: z.number().int().nonnegative(),
});
export type PongMessage = z.infer<typeof PongMessage>;

export const WorkerMessage = z.discriminatedUnion('kind', [PingMessage, PongMessage]);
export type WorkerMessage = z.infer<typeof WorkerMessage>;
