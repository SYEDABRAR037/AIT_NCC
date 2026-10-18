import { PrismaClient } from '@prisma/client';

export const MOCK_SENTINEL_DATABASE_URL =
  'postgresql://mock_isolated:fail_closed@127.0.0.1:9/ncc_isolated_mock_db?connect_timeout=1';

const CLOUD_DATABASE_DOMAINS = [
  'render.com',
  'amazonaws.com',
  'rds.amazonaws.com',
  'supabase.co',
  'neon.tech',
  'railway.app',
  'clever-cloud.com',
  'elephantsql.com',
  'cockroachlabs.cloud',
];

const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres-test']);

/**
 * Validates whether a given URL qualifies as a disposable local test database.
 * Does NOT rely solely on hostname or an override flag; enforces multi-dimensional checks.
 */
function validateDisposableTestDatabase(rawUrl: string): void {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('[FAIL-CLOSED DB GUARD] Disposable test database URL is missing or empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    throw new Error(`[FAIL-CLOSED DB GUARD] Invalid database URL format: ${err.message}`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`[FAIL-CLOSED DB GUARD] Invalid protocol '${parsed.protocol}'. Only PostgreSQL is supported.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check 1: Hostname must be strictly local loopback or designated test container
  if (!LOCAL_TEST_HOSTS.has(hostname)) {
    throw new Error(
      `[FAIL-CLOSED DB GUARD] Test database host '${hostname}' is not a permitted local loopback address. ` +
      `Permitted: ${Array.from(LOCAL_TEST_HOSTS).join(', ')}`
    );
  }

  // Check 2: Reject any cloud domain substring
  for (const cloudDomain of CLOUD_DATABASE_DOMAINS) {
    if (hostname.includes(cloudDomain)) {
      throw new Error(`[FAIL-CLOSED DB GUARD] Cloud database domain '${cloudDomain}' detected. Production/cloud hosts are strictly forbidden in tests.`);
    }
  }

  // Check 3: Database name must contain 'test' or 'mock' to prevent hitting local dev databases
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test') && !dbName.includes('mock')) {
    throw new Error(
      `[FAIL-CLOSED DB GUARD] Test database name '${dbName}' must contain 'test' or 'mock' to prevent accidental writes to local development databases.`
    );
  }
}

/**
 * Detects whether the current process is executing within a test context.
 */
function isTestExecution(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.PURE_MOCK_TEST === 'true') return true;
  if (process.env.JEST_WORKER_ID !== undefined) return true;
  return process.argv.some((arg) => /test|spec/i.test(arg));
}

/**
 * Creates the PrismaClient singleton with fail-closed safety enforcement.
 */
function initializePrisma(): PrismaClient {
  const isTest = isTestExecution();

  if (!isTest) {
    // Normal Development / Production runtime
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  // --------------------------------------------------------------------------
  // TEST EXECUTION CONTEXT — FAIL-CLOSED ENFORCEMENT
  // --------------------------------------------------------------------------

  // Case A: Separately configured disposable test database
  if (process.env.ALLOW_DISPOSABLE_TEST_DB === 'true') {
    const testUrl = process.env.DISPOSABLE_TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testUrl) {
      throw new Error(
        '[FAIL-CLOSED DB GUARD] ALLOW_DISPOSABLE_TEST_DB is enabled but DISPOSABLE_TEST_DATABASE_URL is not set.'
      );
    }
    validateDisposableTestDatabase(testUrl);

    return new PrismaClient({
      datasources: { db: { url: testUrl } },
      log: ['error'],
    });
  }

  // Case B: Pure Mock Mode (Default for all unit & integration tests)
  const currentDbUrl = process.env.DATABASE_URL;
  const isSentinel = currentDbUrl === MOCK_SENTINEL_DATABASE_URL;
  const isPureMockFlag = process.env.PURE_MOCK_TEST === 'true';

  // If DATABASE_URL is set to an ambient/inherited live database without pure mock sentinel
  if (currentDbUrl && !isSentinel && !isPureMockFlag) {
    throw new Error(
      '[FAIL-CLOSED DB GUARD] Unsafe test execution environment!\n' +
      'Detected live/inherited database credentials in process.env.DATABASE_URL during test execution.\n' +
      'Silent inheritance of ambient .env credentials during tests is strictly blocked.\n' +
      'Remediation:\n' +
      '  - For mock tests: run via npm test or import test-isolation-guard (PURE_MOCK_TEST=true)\n' +
      '  - For disposable DB tests: set ALLOW_DISPOSABLE_TEST_DB=true with a validated loopback test database.'
    );
  }

  // Force unreachable loopback discard port (RFC 863)
  process.env.DATABASE_URL = MOCK_SENTINEL_DATABASE_URL;

  const rawPrisma = new PrismaClient({
    datasources: { db: { url: MOCK_SENTINEL_DATABASE_URL } },
    log: ['error'],
  });

  // Client extension trap: intercepts any unmocked database operation before it can reach the network
  const guardedClient = rawPrisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation }) {
          throw new Error(
            `[FAIL-CLOSED DB GUARD] Unmocked database operation attempted in Pure Mock test mode: prisma.${model}.${operation}(). ` +
            `Every database interaction in tests must be explicitly mocked.`
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
