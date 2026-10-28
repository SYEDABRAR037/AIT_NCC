export const MOCK_SENTINEL_DATABASE_URL =
  'postgresql://mock_isolated:fail_closed@127.0.0.1:9/ncc_isolated_mock_db?connect_timeout=1';
export const DISPOSABLE_DB_CONFIRMATION = 'I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE';

const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres-test']);

export function isTestExecution(): boolean {
  return process.env.NODE_ENV === 'test' ||
    process.env.PURE_MOCK_TEST === 'true' ||
    process.env.JEST_WORKER_ID !== undefined;
}

export function validateDisposableTestDatabase(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('[FAIL-CLOSED DB GUARD] Invalid disposable test database URL.');
  }

  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    throw new Error('[FAIL-CLOSED DB GUARD] Disposable test database must use PostgreSQL.');
  }
  if (!LOCAL_TEST_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `[FAIL-CLOSED DB GUARD] Test database host '${parsed.hostname}' is not a permitted local loopback address.`
    );
  }
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test') && !dbName.includes('mock')) {
    throw new Error(
      `[FAIL-CLOSED DB GUARD] Test database name '${dbName}' must contain 'test' or 'mock'.`
    );
  }
}

/** Set Prisma's URL before any client is constructed; never fall back to DATABASE_URL. */
export function prepareTestDatabaseEnvironment(): string {
  process.env.PRISMA_DONT_LOAD_DOTENV = '1';
  const inheritedUrl = process.env.DATABASE_URL;
  const inheritedDirectUrl = process.env.DIRECT_URL;

  if (process.env.ALLOW_DISPOSABLE_TEST_DB === 'true') {
    const testUrl = process.env.DISPOSABLE_TEST_DATABASE_URL;
    if (!testUrl) {
      throw new Error(
        '[FAIL-CLOSED DB GUARD] ALLOW_DISPOSABLE_TEST_DB requires DISPOSABLE_TEST_DATABASE_URL; DATABASE_URL fallback is forbidden.'
      );
    }
    validateDisposableTestDatabase(testUrl);
    if (process.env.NCC_DISPOSABLE_DB_CONFIRMATION !== DISPOSABLE_DB_CONFIRMATION) {
      throw new Error(
        '[FAIL-CLOSED DB GUARD] Confirm the dedicated empty disposable database before enabling integration tests.'
      );
    }

    if (inheritedUrl && inheritedUrl !== MOCK_SENTINEL_DATABASE_URL && inheritedUrl !== testUrl) {
      throw new Error(
        '[FAIL-CLOSED DB GUARD] Conflicting DATABASE_URL is present. Remove it and provide only the dedicated disposable test URL.'
      );
    }
    if (inheritedDirectUrl && inheritedDirectUrl !== MOCK_SENTINEL_DATABASE_URL && inheritedDirectUrl !== testUrl) {
      throw new Error(
        '[FAIL-CLOSED DB GUARD] Conflicting DIRECT_URL is present. Remove it or align it with the dedicated disposable test URL.'
      );
    }

    process.env.DATABASE_URL = testUrl;
    process.env.DIRECT_URL = testUrl;
    process.env.NCC_TEST_DATABASE_ISOLATED = 'true';
    return testUrl;
  }

  if (inheritedUrl && inheritedUrl !== MOCK_SENTINEL_DATABASE_URL) {
    throw new Error(
      '[FAIL-CLOSED DB GUARD] Unsafe test execution environment! A DATABASE_URL was inherited; clear it or configure a dedicated disposable test URL.'
    );
  }
  if (inheritedDirectUrl && inheritedDirectUrl !== MOCK_SENTINEL_DATABASE_URL) {
    throw new Error(
      '[FAIL-CLOSED DB GUARD] Unsafe test execution environment! A DIRECT_URL was inherited; clear it or configure a dedicated disposable test URL.'
    );
  }

  process.env.DATABASE_URL = MOCK_SENTINEL_DATABASE_URL;
  process.env.DIRECT_URL = MOCK_SENTINEL_DATABASE_URL;
  process.env.NCC_TEST_DATABASE_ISOLATED = 'false';
  return MOCK_SENTINEL_DATABASE_URL;
}

export function prepareGuardedUtilityDatabase(purpose: 'preflight' | 'seed'): string {
  if (isTestExecution()) {
    if (process.env.ALLOW_DISPOSABLE_TEST_DB !== 'true') {
      throw new Error('[FAIL-CLOSED DB GUARD] Utility script in test mode requires an explicit disposable test database.');
    }
    return prepareTestDatabaseEnvironment();
  }

  process.env.PRISMA_DONT_LOAD_DOTENV = '1';
  const explicitUrl = process.env.NCC_UTILITY_DATABASE_URL;
  if (process.env.NCC_ALLOW_UTILITY_DATABASE !== 'true' || !explicitUrl) {
    throw new Error(
      '[FAIL-CLOSED DB GUARD] Utility scripts require NCC_ALLOW_UTILITY_DATABASE=true and an explicit NCC_UTILITY_DATABASE_URL.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(explicitUrl);
  } catch {
    throw new Error('[FAIL-CLOSED DB GUARD] Utility database URL is invalid.');
  }
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    throw new Error('[FAIL-CLOSED DB GUARD] Utility database URL must use PostgreSQL.');
  }
  const isLocal = LOCAL_TEST_HOSTS.has(parsed.hostname.toLowerCase());
  if (isLocal) {
    validateDisposableTestDatabase(explicitUrl);
  } else {
    const optIn = purpose === 'preflight'
      ? process.env.NCC_ALLOW_PRODUCTION_PREFLIGHT
      : process.env.NCC_ALLOW_PRODUCTION_SEED;
    const expected = purpose === 'preflight'
      ? 'I_REVIEWED_PRODUCTION_READ_ONLY'
      : 'I_REVIEWED_PRODUCTION_SEED';
    if (optIn === expected) {
      process.env.DATABASE_URL = explicitUrl;
      process.env.DIRECT_URL = explicitUrl;
      return explicitUrl;
    }
    throw new Error(
      `[FAIL-CLOSED DB GUARD] Non-local ${purpose} targets require the corresponding explicit production opt-in.`
    );
  }

  process.env.DATABASE_URL = explicitUrl;
  process.env.DIRECT_URL = explicitUrl;
  return explicitUrl;
}
