#!/usr/bin/env node

/**
 * Code-only/mock BSR-05 harness entry point.
 * No Docker, Prisma, PostgreSQL, child_process, or migration adapter is present.
 */
import { runMockOnlyCommand } from '../src/testDatabaseAttestation';

if (require.main === module) {
  try {
    process.stdout.write(`${runMockOnlyCommand(process.argv.slice(2), process.env)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : '[BSR-05 HARNESS DENIED] Invalid request.'}\n`);
    process.exitCode = 2;
  }
}

