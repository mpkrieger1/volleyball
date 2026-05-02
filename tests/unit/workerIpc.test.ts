import { describe, expect, it } from 'vitest';
import { handlePing } from '../../workers/src/noopWorker';
import { ipc } from '@vcd/shared';

describe('worker IPC contract', () => {
  it('accepts a valid ping and returns a schema-valid pong', () => {
    const ping: ipc.PingMessage = { kind: 'ping', id: 'abc-123', sentAt: 1_700_000_000_000 };
    const reply = handlePing(ping);
    expect(reply.kind).toBe('pong');
    expect(reply.id).toBe('abc-123');
    expect(reply.sentAt).toBe(1_700_000_000_000);
    expect(reply.receivedAt).toBeGreaterThan(0);
    expect(() => ipc.PongMessage.parse(reply)).not.toThrow();
  });

  it('rejects payloads that do not match the zod schema', () => {
    expect(() => handlePing({ kind: 'ping', id: '', sentAt: -1 })).toThrow();
    expect(() => handlePing({ kind: 'bogus' })).toThrow();
    expect(() => handlePing(null)).toThrow();
  });
});
