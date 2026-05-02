// Diagnostic: show row count and approx size per table for a SQLite save DB.
// Usage: npx tsx scripts/dump-table-sizes.ts <path-to-game.db>

import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('Usage: npx tsx scripts/dump-table-sizes.ts <db-path>');
    process.exit(1);
  }
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  const tables = [
    'Match',
    'Set',
    'PlayerMatchStat',
    'Player',
    'PlayerArchive',
    'Recruit',
    'Booster',
    'Coach',
    'Poll',
    'RPISnapshot',
    'BracketEntry',
    'Award',
    'Conference',
    'Team',
    'Season',
    'NilDeal',
  ];

  console.log('table | rows');
  for (const t of tables) {
    try {
      const rows: Array<{ c: number }> = await client.$queryRawUnsafe(
        `SELECT COUNT(*) as c FROM "${t}"`,
      );
      const c = Number(rows[0]?.c ?? 0);
      console.log(`${t} | ${c}`);
    } catch (err) {
      console.log(`${t} | (table missing or query failed: ${(err as Error).message})`);
    }
  }

  // Page-level size breakdown via dbstat virtual table.
  try {
    const dbstat: Array<{ name: string; pageCount: number }> = await client.$queryRawUnsafe(
      `SELECT name, COUNT(*) as pageCount FROM dbstat GROUP BY name ORDER BY pageCount DESC LIMIT 20`,
    );
    console.log('\ntop tables by page count:');
    for (const r of dbstat) {
      console.log(`${r.name} | ${r.pageCount} pages (~${(r.pageCount * 4096) / 1024 / 1024} MB)`);
    }
  } catch {
    console.log('(dbstat virtual table not available — re-run with sqlite3 cli for size breakdown)');
  }

  await client.$disconnect();
}

main();
