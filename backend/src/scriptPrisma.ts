import { prepareGuardedUtilityDatabase, prepareTestDatabaseEnvironment } from './databaseSafety';

/** Integration scripts require the separate disposable DB variable; mock mode is insufficient. */
export function createDisposableTestPrismaClient(): any {
  process.env.NODE_ENV = 'test';
  if (process.env.ALLOW_DISPOSABLE_TEST_DB !== 'true') {
    throw new Error('[FAIL-CLOSED DB GUARD] Integration script requires ALLOW_DISPOSABLE_TEST_DB=true.');
  }
  const url = prepareTestDatabaseEnvironment();
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
}

/** Non-test maintenance helpers require a URL and an explicit operator opt-in. */
export function createExplicitUtilityPrismaClient(purpose: 'preflight' | 'seed'): any {
  const url = prepareGuardedUtilityDatabase(purpose);
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
}
