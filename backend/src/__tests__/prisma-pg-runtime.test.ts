import './test-isolation-guard';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildStrictPgPoolConfig,
  createPrismaPgClientFromPool,
  createStagingPrismaPgPoolConfig,
  resolvePrismaRuntimeMode,
  resolvePrismaPgPoolMax,
  STAGING_PRISMA_ADAPTER_OPT_IN,
  STAGING_PRISMA_POOL_DEFAULT_MAX,
  STAGING_PRISMA_POOL_MAX_ENV,
} from '../prismaPgRuntime';
import { SUPABASE_CA_FILE_PATH } from '../runtimeConfig';

const stagingIdentity = {
  NODE_ENV: 'production',
  RENDER: 'true',
  RENDER_SERVICE_ID: 'srv-dc2j1eec6qcc73f6i8t0',
  RENDER_SERVICE_NAME: 'ait-ncc-backend-staging',
  RENDER_GIT_BRANCH: 'ncc-backend-staging',
  RENDER_EXTERNAL_URL: 'https://ait-ncc-backend-staging.onrender.com',
  IS_PULL_REQUEST: 'false',
};
const syntheticUrl = new URL('postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.invalid:5432/test_database?sslmode=require&sslaccept=strict&sslrootcert=./certs/supabase-root-ca.pem');
const syntheticTarget = {
  host: 'db.invalid',
  port: '5432',
  username: 'test_user',
  database: 'test_database',
};
const pinnedCaContents = fs.readFileSync(SUPABASE_CA_FILE_PATH, 'utf8');
const validStagingEnv = {
  ...stagingIdentity,
  [STAGING_PRISMA_ADAPTER_OPT_IN]: 'true',
  DATABASE_URL: syntheticUrl.toString(),
};

assert.equal(resolvePrismaRuntimeMode({ NODE_ENV: 'production' }), 'native');
assert.equal(resolvePrismaRuntimeMode({ ...stagingIdentity, [STAGING_PRISMA_ADAPTER_OPT_IN]: 'false' }), 'native');
assert.equal(resolvePrismaRuntimeMode({ ...stagingIdentity, [STAGING_PRISMA_ADAPTER_OPT_IN]: 'true' }), 'staging-prisma-pg');
assert.throws(() => resolvePrismaRuntimeMode({ ...stagingIdentity, [STAGING_PRISMA_ADAPTER_OPT_IN]: 'TRUE' }));

for (const marker of [
  'NODE_ENV', 'RENDER', 'RENDER_SERVICE_ID', 'RENDER_SERVICE_NAME',
  'RENDER_GIT_BRANCH', 'RENDER_EXTERNAL_URL', 'IS_PULL_REQUEST',
]) {
  const conflicting = { ...stagingIdentity, [STAGING_PRISMA_ADAPTER_OPT_IN]: 'true' };
  delete (conflicting as Record<string, string | undefined>)[marker];
  assert.throws(() => resolvePrismaRuntimeMode(conflicting), /exact authorized Render staging identity/, `missing ${marker} must reject adapter mode`);
  assert.throws(() => resolvePrismaRuntimeMode({
    ...conflicting,
    [marker]: `wrong-${marker}`,
  }), /exact authorized Render staging identity/, `conflicting ${marker} must reject adapter mode`);
}

assert.throws(() => createStagingPrismaPgPoolConfig(validStagingEnv));
assert.throws(() => createStagingPrismaPgPoolConfig({
  ...validStagingEnv,
  DATABASE_URL: undefined,
  DIRECT_URL: syntheticUrl.toString(),
}));

const poolConfig = buildStrictPgPoolConfig(syntheticUrl, pinnedCaContents, syntheticTarget, STAGING_PRISMA_POOL_DEFAULT_MAX);
const parsedPoolUrl = new URL(poolConfig.connectionString!);
assert.equal(parsedPoolUrl.hostname, 'db.invalid');
assert.equal(parsedPoolUrl.port, '5432');
assert.equal(parsedPoolUrl.pathname, '/test_database');
assert.equal(parsedPoolUrl.search, '');
assert.equal(poolConfig.max, STAGING_PRISMA_POOL_DEFAULT_MAX);
assert.equal(poolConfig.connectionTimeoutMillis, 5_000);
assert.equal(poolConfig.idleTimeoutMillis, 10_000);
assert.equal(poolConfig.ssl && typeof poolConfig.ssl === 'object' && poolConfig.ssl.rejectUnauthorized, true);
assert.equal(poolConfig.ssl && typeof poolConfig.ssl === 'object' && poolConfig.ssl.ca, pinnedCaContents);
assert.equal(poolConfig.ssl && typeof poolConfig.ssl === 'object' && poolConfig.ssl.servername, 'db.invalid');
assert.equal(typeof (poolConfig.ssl as import('tls').ConnectionOptions).checkServerIdentity, 'function');
assert.equal(resolvePrismaPgPoolMax({ [STAGING_PRISMA_POOL_MAX_ENV]: '4' }), 4);
for (const poolMax of ['0', '5', '1.5', ' 1', '']) {
  assert.throws(() => resolvePrismaPgPoolMax({ [STAGING_PRISMA_POOL_MAX_ENV]: poolMax }));
}
for (const invalid of [
  new URL(syntheticUrl.toString().replace(':5432/', ':6543/')),
  new URL(syntheticUrl.toString().replace('test_user', 'other_user')),
  new URL(syntheticUrl.toString().replace('/test_database?', '/other_database?')),
  new URL(syntheticUrl.toString().replace('sslmode=require', 'sslmode=disable')),
  new URL(syntheticUrl.toString().replace('&sslaccept=strict', '')),
  new URL(syntheticUrl.toString().replace('&sslrootcert=./certs/supabase-root-ca.pem', '')),
  new URL(syntheticUrl.toString().replace('sslrootcert=./certs/supabase-root-ca.pem', 'sslrootcert=../../other-ca.pem')),
  new URL(`${syntheticUrl}&host=127.0.0.1`),
  new URL(`${syntheticUrl}&sslmode=require`),
]) assert.throws(() => buildStrictPgPoolConfig(invalid, pinnedCaContents, syntheticTarget, 1));
assert.throws(() => buildStrictPgPoolConfig(syntheticUrl, 'TEST_ONLY_NOT_A_CERTIFICATE', syntheticTarget, 1));
assert.throws(() => buildStrictPgPoolConfig(syntheticUrl, pinnedCaContents, syntheticTarget, 5));

async function testInitializationFailureClosesPoolWithoutFallback(): Promise<void> {
  let poolClosed = false;
  let nativeFactoryCalled = false;
  const pool = {
    on: () => pool,
    end: async () => { poolClosed = true; },
  } as unknown as import('pg').Pool;

  assert.throws(() => createPrismaPgClientFromPool(pool, {
    createAdapter: () => { throw new Error('synthetic adapter init failure'); },
    createClient: () => { nativeFactoryCalled = true; throw new Error('native fallback must not run'); },
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(poolClosed, true);
  assert.equal(nativeFactoryCalled, false);

  let clientPoolClosed = false;
  const secondPool = {
    on: () => secondPool,
    end: async () => { clientPoolClosed = true; },
  } as unknown as import('pg').Pool;
  assert.throws(() => createPrismaPgClientFromPool(secondPool, {
    createAdapter: () => ({ syntheticAdapter: true }),
    createClient: () => { throw new Error('synthetic PrismaClient init failure'); },
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(clientPoolClosed, true);
}

function testMockedClientReceivesOnlyStagingAdapter(): void {
  const pool = { on: () => pool, end: async () => undefined } as unknown as import('pg').Pool;
  const adapterToken = { adapter: 'synthetic-staging-adapter' };
  let selectedPool: import('pg').Pool | undefined;
  let selectedAdapter: unknown;
  const clientToken = {} as import('@prisma/client').PrismaClient;
  selectedPool = pool;
  const client = createPrismaPgClientFromPool(pool, {
    createAdapter: (receivedPool: import('pg').Pool) => {
      assert.equal(receivedPool, pool);
      return adapterToken;
    },
    createClient: (adapter: unknown) => {
      selectedAdapter = adapter;
      return clientToken;
    },
  });
  assert.equal(selectedPool, pool);
  assert.equal(selectedAdapter, adapterToken);
  assert.equal(client, clientToken);
}

async function testMockSentinelStillWinsOverAdapterOptIn(): Promise<void> {
  const oldFlag = process.env[STAGING_PRISMA_ADAPTER_OPT_IN];
  process.env[STAGING_PRISMA_ADAPTER_OPT_IN] = 'true';
  try {
    const { prisma } = require('../db') as { prisma: any };
    await assert.rejects(
      () => prisma.$queryRaw`SELECT 1`,
      /FAIL-CLOSED DB GUARD.*prisma\.\$queryRaw/,
    );
  } finally {
    if (oldFlag === undefined) delete process.env[STAGING_PRISMA_ADAPTER_OPT_IN];
    else process.env[STAGING_PRISMA_ADAPTER_OPT_IN] = oldFlag;
  }
}

void (async () => {
  await testInitializationFailureClosesPoolWithoutFallback();
  testMockedClientReceivesOnlyStagingAdapter();
  await testMockSentinelStillWinsOverAdapterOptIn();
  console.log('PrismaPg runtime selection, strict TLS configuration, failure closure, and sentinel isolation tests passed.');
})().catch(() => {
  process.exitCode = 1;
});
