import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { perf } from '@vcd/shared';
import { seedLeagueInto, deriveCoachContract } from '@vcd/shared/seed';
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

/**
 * Sprint 25 (P0.5): made idempotent + migration-tracked. Pre-Sprint-25
 * `applyMigrations` re-ran every migration on every call, which was fine
 * for fresh CREATE TABLE migrations but breaks for ALTER TABLE / table-
 * rebuild migrations (Sprint 25's PMS cascade). Now uses Prisma's
 * standard `_prisma_migrations` tracking table:
 *   - On first run (table doesn't exist): create the tracking table.
 *   - For each migration folder: skip if already recorded, otherwise
 *     run + record.
 * Called both at save-slot CREATE (where everything is unapplied) and
 * at save-slot OPEN (where most is applied but the latest may not be).
 *
 * This is the save-file forward-compat path per CLAUDE.md §Critical
 * rule 6 ("A save created in sprint N must open in sprint N+1").
 */
async function applyMigrations(repoRoot: string, dbPath: string): Promise<void> {
  const migrationsDir = path.join(repoRoot, 'prisma', 'migrations');
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    // Ensure the tracking table exists. Schema mirrors Prisma's stock
    // `_prisma_migrations` so future CLI-driven migrations stay
    // compatible. We only use `migration_name` here.
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
      )
    `);

    const appliedRows = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM "_prisma_migrations"`,
    );
    const applied = new Set(appliedRows.map((r) => r.migration_name));

    for (const folder of folders) {
      if (applied.has(folder)) continue;
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
      // Record the migration as applied. Use folder name as both id and
      // migration_name; checksum is a placeholder (Prisma's CLI uses a
      // sha256 of the SQL file, but we don't validate checksums on open
      // so a stable placeholder is sufficient).
      await client.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (?, ?, ?, current_timestamp, 1)`,
        folder,
        'manual',
        folder,
      );
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

    // Sprint 28 fix: ensure a Season row exists for the dynasty year so
    // the post-create team picker can write `Season.userTeamId`. Pre-
    // Sprint-27 the user clicked "Generate schedule" first which
    // implicitly created the Season row; after Task 27.1 moved schedule
    // gen to `startRegular`, fresh saves had no Season row at picker
    // time and `setUserTeam` failed silently with NOT_FOUND.
    const existingSeason = await client.season.findUnique({ where: { year: 2026 } });
    if (!existingSeason) {
      await client.season.create({
        data: { year: 2026, phase: 'PRESEASON', currentWeek: 0 },
      });
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
        // Sprint 25 (P0.5): apply any new migrations on open. Forward-compat
        // for saves created with older versions when the user upgrades.
        // `applyMigrations` is idempotent — it skips any already in
        // `_prisma_migrations`. CLAUDE.md §6 mandates this path.
        await client.$disconnect();
        await applyMigrations(deps.repoRoot, dbPath);
        const reopened = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
        try {
          // Sprint 28 fix: backfill a Season row for legacy saves created
          // pre-Sprint-28 that never had one (saves created between
          // Sprint 27's schedule-gen-on-startRegular change and the
          // Sprint 28 createSaveSlot fix). Idempotent: skips if Season
          // already exists for the dynasty year.
          const dynastyYear = row.dynastyYear ?? 2026;
          const seasonExists = await reopened.season.findUnique({
            where: { year: dynastyYear },
          });
          if (!seasonExists) {
            await reopened.season.create({
              data: { year: dynastyYear, phase: 'PRESEASON', currentWeek: 0 },
            });
          }

          // Sprint 28 backfill: legacy saves seeded coaches with
          // salary=0 / contractYears=1 (schema defaults). Now that the
          // seeder sets real values, fix up any existing rows so the
          // Staff screen + buyout math have realistic numbers. Idempotent:
          // only updates rows where salary is currently 0.
          const zeroSalaryCoaches = await reopened.coach.findMany({
            where: { salary: 0, teamId: { not: null } },
            select: {
              id: true,
              role: true,
              team: { select: { prestige: true } },
            },
          });
          if (zeroSalaryCoaches.length > 0) {
            for (const c of zeroSalaryCoaches) {
              if (c.role !== 'HC' && c.role !== 'AHC' && c.role !== 'AC') continue;
              const prestige = c.team?.prestige ?? 55;
              const contract = deriveCoachContract(c.role, prestige);
              await reopened.coach.update({
                where: { id: c.id },
                data: {
                  salary: contract.salaryCents,
                  contractYears: contract.contractYears,
                },
              });
            }
          }
          const updated = await reopened.saveSlot.update({
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
        } finally {
          await reopened.$disconnect();
        }
      }
    } finally {
      await client.$disconnect();
    }
  }
  throw new SaveSlotError('NOT_FOUND', `No save slot with id ${id}.`);
}
