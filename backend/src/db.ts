import { PrismaClient } from '@prisma/client';
import {
  isTestExecution,
  MOCK_SENTINEL_DATABASE_URL,
  prepareTestDatabaseEnvironment,
} from './databaseSafety';

function initializePrisma(): PrismaClient {
  if (!isTestExecution()) {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  const testUrl = prepareTestDatabaseEnvironment();
  if (process.env.ALLOW_DISPOSABLE_TEST_DB === 'true') {
    return new PrismaClient({
      datasources: { db: { url: testUrl } },
      log: ['error'],
    });
  }

  const rawPrisma = new PrismaClient({
    datasources: { db: { url: MOCK_SENTINEL_DATABASE_URL } },
    log: ['error'],
  });

  const guardedClient = rawPrisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation }) {
          throw new Error(
            `[FAIL-CLOSED DB GUARD] Unmocked database operation attempted in Pure Mock test mode: prisma.${model}.${operation}(). ` +
              'Every database interaction in tests must be explicitly mocked.'
          );
        },
      },
      $queryRaw() {
        throw new Error('[FAIL-CLOSED DB GUARD] Unmocked database operation attempted: prisma.$queryRaw()');
      },
      $executeRaw() {
        throw new Error('[FAIL-CLOSED DB GUARD] Unmocked database operation attempted: prisma.$executeRaw()');
      },
    },
  });

  return guardedClient as unknown as PrismaClient;
}

export const prisma = initializePrisma();
