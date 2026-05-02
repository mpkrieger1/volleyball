// Standalone CLI seed: applies the 2026 D-I league into the DB pointed at by
// DATABASE_URL. Delegates to `seedLeagueInto` from @vcd/shared so main-process
// save-slot creation and this CLI stay in lockstep.

import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { seedLeagueInto } from '@vcd/shared/seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    const counts = await seedLeagueInto(prisma, resolve(__dirname, '..'));
    console.log(`Seeded ${counts.conferences} conferences, ${counts.teams} teams.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
