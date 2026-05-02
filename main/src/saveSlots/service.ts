import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { perf } from '@vcd/shared';
import { seedLeagueInto } from '@vcd/shared/seed';
import {
  resolveSaveSlotDir,
  resolveSaveSlotDbPath,
  resolveSaveSlotsRoot,
  type SaveSlotPathEnv,
} from './paths';

export class SaveSlotError extends Error {
  constructor(
    public readonly code: 'DUPLICATE_NAME' | 'NOT_FOUND' | 'IO_ERROR' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
  }
}

export type SaveSlotSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastOpenedAt: string;
  dynastyYear: number;
};

export type SaveSlotServiceDeps = SaveSlotPathEnv & {
  /** Directory containing prisma/ schema and migrations — used to apply migrations to new save DBs. */
  repoRoot: string;
};

async function applyMigrations(repoRoot: string, dbPath: string): Promise<void> {
  const migrationsDir = path.join(repoRoot, 'prisma', 'migrations');
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    for (const folder of folders) {
      const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
      if (!existsSync(sqlPath)) continue;
      const sql = await readFile(sqlPath, 'utf8');
      // SQLite via Prisma supports semicolon-separated statements via $executeRawUnsafe
      // only one at a time. Split on `;` at end of line and run each non-empty chunk.
      const stripped = sql
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      const statements = stripped
        .split(/;\s*(?:\r?\n|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await client.$executeRawUnsafe(stmt);
      }
    }
  } finally {
    await client.$disconnect();
  }
}

function slotIdFromName(name: string): string {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) throw new SaveSlotError('INVALID_INPUT', 'Save slot name must contain alphanumeric characters.');
  return safe;
}

export async function listSaveSlots(deps: SaveSlotServiceDeps): Promise<SaveSlotSummary[]> {
  const root = resolveSaveSlotsRoot(deps);
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const results: SaveSlotSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dbPath = resolveSaveSlotDbPath(deps, entry.name);
    if (!existsSync(dbPath)) continue;
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const row = await client.saveSlot.findFirst();
      if (!row) continue;
      results.push({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
        lastOpenedAt: row.lastOpenedAt.toISOString(),
        dynastyYear: row.dynastyYear,
      });
    } finally {
      await client.$disconnect();
    }
  }
  return results.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

export async function createSaveSlot(
  deps: SaveSlotServiceDeps,
  name: string,
): Promise<SaveSlotSummary> {
  return perf.recordPerfAsync('createSaveSlot', () => createSaveSlotImpl(deps, name));
}

async function createSaveSlotImpl(
  deps: SaveSlotServiceDeps,
  name: string,
): Promise<SaveSlotSummary> {
  const trimmed = name.trim();
  if (!trimmed) throw new SaveSlotError('INVALID_INPUT', 'Save slot name is required.');

  const slotId = slotIdFromName(trimmed);
  const slotDir = resolveSaveSlotDir(deps, slotId);
  const dbPath = resolveSaveSlotDbPath(deps, slotId);

  if (existsSync(slotDir)) {
    throw new SaveSlotError('DUPLICATE_NAME', `A save slot named "${trimmed}" already exists.`);
  }

  await mkdir(slotDir, { recursive: true });

  // Apply migration SQL directly. Avoids spawning the Prisma CLI (slow + path-fragile
  // when the repo lives under a path with spaces like OneDrive).
  try {
    await applyMigrations(deps.repoRoot, dbPath);
  } catch (err) {
    await rm(slotDir, { recursive: true, force: true });
    throw new SaveSlotError('IO_ERROR', `Failed to initialize save DB: ${(err as Error).message}`);
  }

  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    // Seed the 2026 D-I league into the new save DB. In-process so no CLI
    // spawn on Windows/OneDrive paths.
    try {
      await seedLeagueInto(client, deps.repoRoot);
    } catch (err) {
      await client.$disconnect();
      await rm(slotDir, { recursive: true, force: true });
      throw new SaveSlotError('IO_ERROR', `Failed to seed league into save DB: ${(err as Error).message}`);
    }

    const row = await client.saveSlot.create({
      data: { name: trimmed, dynastyYear: 2026 },
    });
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      lastOpenedAt: row.lastOpenedAt.toISOString(),
      dynastyYear: row.dynastyYear,
    };
  } finally {
    await client.$disconnect();
  }
}

export async function deleteSaveSlot(deps: SaveSlotServiceDeps, id: string): Promise<void> {
  const root = resolveSaveSlotsRoot(deps);
  if (!existsSync(root)) throw new SaveSlotError('NOT_FOUND', `No save slots directory at ${root}.`);

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dbPath = resolveSaveSlotDbPath(deps, entry.name);
    if (!existsSync(dbPath)) continue;
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const row = await client.saveSlot.findFirst({ where: { id } });
      if (row) {
        await client.$disconnect();
        await rm(resolveSaveSlotDir(deps, entry.name), { recursive: true, force: true });
        return;
      }
    } finally {
      await client.$disconnect();
    }
  }
  throw new SaveSlotError('NOT_FOUND', `No save slot with id ${id}.`);
}

/**
 * Locate the game.db path for a slot given its DB id. Iterates through the slot
 * directories. Sprint 6 uses this to route match-IPC requests back to the right
 * DB; Sprint 7+ could add a tiny in-memory cache keyed by slotId.
 */
export async function findSlotDbPathById(
  deps: SaveSlotServiceDeps,
  id: string,
): Promise<string | null> {
  const root = resolveSaveSlotsRoot(deps);
  if (!existsSync(root)) return null;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dbPath = resolveSaveSlotDbPath(deps, entry.name);
    if (!existsSync(dbPath)) continue;
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const row = await client.saveSlot.findFirst({ where: { id } });
      if (row) return dbPath;
    } finally {
      await client.$disconnect();
    }
  }
  return null;
}

export async function openSaveSlot(
  deps: SaveSlotServiceDeps,
  id: string,
): Promise<SaveSlotSummary> {
  const root = resolveSaveSlotsRoot(deps);
  if (!existsSync(root)) throw new SaveSlotError('NOT_FOUND', `No save slots directory at ${root}.`);
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dbPath = resolveSaveSlotDbPath(deps, entry.name);
    if (!existsSync(dbPath)) continue;
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const row = await client.saveSlot.findFirst({ where: { id } });
      if (row) {
        const updated = await client.saveSlot.update({
          where: { id: row.id },
          data: { lastOpenedAt: new Date() },
        });
        return {
          id: updated.id,
          name: updated.name,
          createdAt: updated.createdAt.toISOString(),
          lastOpenedAt: updated.lastOpenedAt.toISOString(),
          dynastyYear: updated.dynastyYear,
        };
      }
    } finally {
      await client.$disconnect();
    }
  }
  throw new SaveSlotError('NOT_FOUND', `No save slot with id ${id}.`);
}
