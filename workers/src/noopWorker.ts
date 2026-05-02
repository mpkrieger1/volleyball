// Placeholder worker — establishes the typed-IPC pattern for Sprint 3+.
// The real sim, season, and recruiting workers land in later sprints.

import { ipc } from '@vcd/shared';

export function handlePing(raw: unknown): ipc.PongMessage {
  const ping = ipc.PingMessage.parse(raw);
  const reply: ipc.PongMessage = {
    kind: 'pong',
    id: ping.id,
    sentAt: ping.sentAt,
    receivedAt: Date.now(),
  };
  return ipc.PongMessage.parse(reply);
}
