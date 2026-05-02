// Thin PrismaClient factory. Sprint 2 only supports one active connection at a time
// (the currently-open save slot). Sprint 6+ may need a pool; keep the surface minimal
// until then.

import { PrismaClient } from '@prisma/client';

const clients = new Map<string, PrismaClient>();

/**
 * Returns a PrismaClient bound to the given SQLite file path. Reuses existing
 * instances so multiple callers share a connection per-path.
 */
export function getPrismaClient(dbFilePath: string): PrismaClient {
  const key = dbFilePath;
  const existing = clients.get(key);
  if (existing) return existing;
  const client = new PrismaClient({
    datasources: { db: { url: `file:${dbFilePath}` } },
  });
  clients.set(key, client);
  return client;
}

/** Disconnects and evicts all cached clients. Use on app shutdown / test teardown. */
export async function disposePrismaClients(): Promise<void> {
  for (const c of clients.values()) {
    await c.$disconnect();
  }
  clients.clear();
}
