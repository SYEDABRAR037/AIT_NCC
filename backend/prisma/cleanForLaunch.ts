/**
 * Production launch-reset preflight only.
 * This script is intentionally read-only. A destructive reset must not run until
 * the owner supplies the real identities for each retained privileged role and
 * a separately verified backup path. Never wire this file into application startup.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function preflight() {
  if (process.argv.includes('--execute')) {
    throw new Error('Production reset is blocked: the current ANO, Platoon Senior, and Senior users match demo seed identities. Supply approved production account mappings and review the preflight before enabling deletion. No data was changed.');
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log('Read-only production reset preflight (no records changed):');
  for (const { tablename } of tables) {
    const identifier = tablename.replace(/"/g, '""');
    const [row] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*)::bigint AS count FROM "${identifier}"`);
    console.log(`${tablename}: ${row.count}`);
  }
  const roles = await prisma.$queryRaw<Array<{ role: string; status: string; count: number }>>`SELECT "role", "status", count(*)::int AS count FROM "User" GROUP BY "role", "status" ORDER BY "role", "status"`;
  console.log('User role/status totals:', JSON.stringify(roles));
  console.log('AuditLog is retained for security review. Pass --execute only after an approved, verified reset procedure is installed.');
}

preflight()
  .catch((error) => { console.error(error instanceof Error ? error.message : 'Preflight failed.'); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
