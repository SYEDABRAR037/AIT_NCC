import './test-isolation-guard';
import assert from 'assert';
import {
  MOCK_SENTINEL_DATABASE_URL,
  prepareGuardedUtilityDatabase,
  prepareTestDatabaseEnvironment,
} from '../databaseSafety';
import { assertIsolatedTestApi, requireIsolatedTestApiUrl } from '../testScriptSafety';
import { createDisposableTestPrismaClient, createExplicitUtilityPrismaClient } from '../scriptPrisma';

function withEnv(values: Record<string, string | undefined>, fn: () => void): void {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) previous.set(key, process.env[key]);
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failures++;
    console.error(`[FAIL] ${name}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

check('mock mode overwrites only the unreachable sentinel', () => {
  withEnv({ ALLOW_DISPOSABLE_TEST_DB: undefined, DISPOSABLE_TEST_DATABASE_URL: undefined, NCC_DISPOSABLE_DB_CONFIRMATION: undefined, DATABASE_URL: undefined, DIRECT_URL: undefined }, () => {
    assert.strictEqual(prepareTestDatabaseEnvironment(), MOCK_SENTINEL_DATABASE_URL);
    assert.strictEqual(process.env.DATABASE_URL, MOCK_SENTINEL_DATABASE_URL);
    assert.strictEqual(process.env.DIRECT_URL, MOCK_SENTINEL_DATABASE_URL);
    assert.strictEqual(process.env.PRISMA_DONT_LOAD_DOTENV, '1');
  });
});

check('mock mode rejects inherited production database URLs', () => {
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: undefined,
    NCC_DISPOSABLE_DB_CONFIRMATION: undefined,
    DATABASE_URL: 'postgresql://db.example.com/ncc_prod',
    DIRECT_URL: undefined,
  }, () => assert.throws(prepareTestDatabaseEnvironment, /Unsafe test execution environment.*DATABASE_URL/));
});

check('mock mode rejects inherited production DIRECT_URLs', () => {
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: undefined,
    NCC_DISPOSABLE_DB_CONFIRMATION: undefined,
    DATABASE_URL: undefined,
    DIRECT_URL: 'postgresql://db.example.com/ncc_prod_direct',
  }, () => assert.throws(prepareTestDatabaseEnvironment, /Unsafe test execution environment.*DIRECT_URL/));
});

check('disposable mode rejects DATABASE_URL fallback', () => {
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: 'true',
    DISPOSABLE_TEST_DATABASE_URL: undefined,
    NCC_DISPOSABLE_DB_CONFIRMATION: undefined,
    DATABASE_URL: 'postgresql://agent@127.0.0.1:5432/ncc_phase3_test',
  }, () => assert.throws(prepareTestDatabaseEnvironment, /DATABASE_URL fallback is forbidden/));
});

check('disposable mode rejects remote/cloud targets', () => {
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: 'true',
    DISPOSABLE_TEST_DATABASE_URL: 'postgresql://test@db.example.com:5432/ncc_phase3_test',
    NCC_DISPOSABLE_DB_CONFIRMATION: 'I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE',
    DATABASE_URL: undefined,
  }, () => assert.throws(prepareTestDatabaseEnvironment, /not a permitted local loopback address/));
});

check('disposable mode requires explicit isolation confirmation', () => {
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: 'true',
    DISPOSABLE_TEST_DATABASE_URL: 'postgresql://test@127.0.0.1:5432/ncc_phase3_test',
    NCC_DISPOSABLE_DB_CONFIRMATION: undefined,
    DATABASE_URL: undefined,
  }, () => assert.throws(prepareTestDatabaseEnvironment, /Confirm the dedicated empty disposable database/));
});

check('disposable mode accepts only explicit loopback test URLs', () => {
  const url = 'postgresql://test@127.0.0.1:5432/ncc_phase3_test?schema=public';
  withEnv({
    ALLOW_DISPOSABLE_TEST_DB: 'true',
    DISPOSABLE_TEST_DATABASE_URL: url,
    NCC_DISPOSABLE_DB_CONFIRMATION: 'I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE',
    DATABASE_URL: undefined,
  }, () => {
    assert.strictEqual(prepareTestDatabaseEnvironment(), url);
    assert.strictEqual(process.env.NCC_TEST_DATABASE_ISOLATED, 'true');
  });
});

check('utility script refuses implicit DATABASE_URL', () => {
  withEnv({
    NODE_ENV: 'development', PURE_MOCK_TEST: undefined, JEST_WORKER_ID: undefined,
    NCC_ALLOW_UTILITY_DATABASE: undefined, NCC_UTILITY_DATABASE_URL: undefined,
  }, () => {
    assert.throws(() => prepareGuardedUtilityDatabase('preflight'), /explicit NCC_UTILITY_DATABASE_URL/);
  });
});

check('integration Prisma helper refuses mock-only mode before client construction', () => {
  withEnv({ ALLOW_DISPOSABLE_TEST_DB: undefined, DISPOSABLE_TEST_DATABASE_URL: undefined, NCC_DISPOSABLE_DB_CONFIRMATION: undefined }, () => {
    assert.throws(createDisposableTestPrismaClient, /requires ALLOW_DISPOSABLE_TEST_DB/);
  });
});

check('maintenance Prisma helper refuses implicit dotenv/database target', () => {
  withEnv({
    NODE_ENV: 'development', PURE_MOCK_TEST: undefined, JEST_WORKER_ID: undefined,
    NCC_ALLOW_UTILITY_DATABASE: undefined, NCC_UTILITY_DATABASE_URL: undefined,
  }, () => assert.throws(() => createExplicitUtilityPrismaClient('preflight'), /explicit NCC_UTILITY_DATABASE_URL/));
});

check('utility script requires explicit review for remote targets', () => {
  withEnv({
    NODE_ENV: 'development', PURE_MOCK_TEST: undefined, JEST_WORKER_ID: undefined,
    NCC_ALLOW_UTILITY_DATABASE: 'true',
    NCC_UTILITY_DATABASE_URL: 'postgresql://operator@db.example.com:5432/ncc_ops',
    NCC_ALLOW_PRODUCTION_PREFLIGHT: undefined,
  }, () => assert.throws(() => prepareGuardedUtilityDatabase('preflight'), /explicit production opt-in/));
});

check('API integration scripts require an explicit local endpoint', () => {
  withEnv({ TEST_API_URL: undefined }, () => {
    assert.throws(() => requireIsolatedTestApiUrl(), /TEST_API_URL is required/);
    assert.throws(() => requireIsolatedTestApiUrl('https://api.example.com'), /loopback host/);
    assert.strictEqual(requireIsolatedTestApiUrl('http://127.0.0.1:5050'), 'http://127.0.0.1:5050');
  });
});

async function verifyApiHealthMarkerGate(): Promise<void> {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(JSON.stringify({ isolatedTestEnvironment: false }), { status: 200 });
    await assert.rejects(assertIsolatedTestApi('http://127.0.0.1:5050'), /no workflow requests were sent/);
    console.log('[PASS] API workflow guard refuses a server without the isolated-test health marker');
  } catch (error) {
    failures++;
    console.error(`[FAIL] API workflow health-marker guard: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally {
    global.fetch = originalFetch;
  }

  if (failures > 0) process.exit(1);
  console.log('12 database and API safety checks passed.');
}

void verifyApiHealthMarkerGate();
