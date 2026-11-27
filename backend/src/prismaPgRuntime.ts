import tls from 'node:tls';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';
import {
  validateSupabaseDatabaseUrlForPgAdapter,
  validateSupabaseRootCaContents,
  type CertificateFileAccess,
} from './runtimeConfig';

export const STAGING_PRISMA_ADAPTER_OPT_IN = 'NCC_STAGING_PRISMA_ADAPTER_ENABLED';
export const STAGING_PRISMA_POOL_MAX_ENV = 'NCC_STAGING_PRISMA_POOL_MAX';
export const STAGING_PRISMA_POOL_DEFAULT_MAX = 1;
export const STAGING_PRISMA_POOL_MAX_ALLOWED = 4;

const STAGING_IDENTITY = Object.freeze({
  serviceId: 'srv-dc2j1eec6qcc73f6i8t0',
  serviceName: 'ait-ncc-backend-staging',
  branch: 'ncc-backend-staging',
  externalUrl: 'https://ait-ncc-backend-staging.onrender.com',
  projectRef: 'dxsgmrvdkydyxxzwxtoy',
  database: 'postgres',
  poolerHost: 'aws-1-ap-northeast-2.pooler.supabase.com',
  poolerUser: 'postgres.dxsgmrvdkydyxxzwxtoy',
});

export type PrismaRuntimeEnvironment = Readonly<Record<string, string | undefined>>;
export type PrismaRuntimeMode = 'native' | 'staging-prisma-pg';

export function resolvePrismaRuntimeMode(env: PrismaRuntimeEnvironment): PrismaRuntimeMode {
  const enabled = env[STAGING_PRISMA_ADAPTER_OPT_IN];
  if (enabled === undefined || enabled === 'false') return 'native';
  if (enabled !== 'true') {
    throw new Error(`${STAGING_PRISMA_ADAPTER_OPT_IN} must be exactly true or false.`);
  }

  const exactStagingIdentity = env.NODE_ENV === 'production'
    && env.RENDER === 'true'
    && env.RENDER_SERVICE_ID === STAGING_IDENTITY.serviceId
    && env.RENDER_SERVICE_NAME === STAGING_IDENTITY.serviceName
    && env.RENDER_GIT_BRANCH === STAGING_IDENTITY.branch
    && env.RENDER_EXTERNAL_URL === STAGING_IDENTITY.externalUrl
    && env.IS_PULL_REQUEST === 'false';

  if (!exactStagingIdentity) {
    throw new Error('Staging PrismaPg opt-in requires the exact authorized Render staging identity.');
  }
  return 'staging-prisma-pg';
}

export function resolvePrismaPgPoolMax(env: PrismaRuntimeEnvironment): number {
  const raw = env[STAGING_PRISMA_POOL_MAX_ENV];
  if (raw === undefined) return STAGING_PRISMA_POOL_DEFAULT_MAX;
  if (!/^[1-4]$/.test(raw)) {
    throw new Error(`${STAGING_PRISMA_POOL_MAX_ENV} must be an integer from 1 to ${STAGING_PRISMA_POOL_MAX_ALLOWED}.`);
  }
  return Number(raw);
}

export interface PrismaPgTarget {
  host: string;
  port: string;
  username: string;
  database: string;
}

/**
 * Construct node-postgres options from a URL already validated by the caller.
 * Kept separate so unit tests can use reserved synthetic hosts and credentials.
 */
export function buildStrictPgPoolConfig(
  url: URL,
  caPem: string,
  target: PrismaPgTarget,
  max: number,
): PoolConfig {
  validateSupabaseRootCaContents(caPem);
  const entries = [...url.searchParams.entries()];
  const allowedTlsParameters = new Set(['sslmode', 'sslaccept', 'sslrootcert']);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== target.host ||
    url.port !== target.port ||
    decodeURIComponent(url.username) !== target.username ||
    decodeURIComponent(url.pathname.replace(/^\//, '')) !== target.database ||
    !url.password ||
    url.hash ||
    entries.length !== allowedTlsParameters.size ||
    entries.some(([name]) => !allowedTlsParameters.has(name)) ||
    url.searchParams.get('sslmode') !== 'require' ||
    url.searchParams.get('sslaccept') !== 'strict' ||
    url.searchParams.get('sslrootcert') !== './certs/supabase-root-ca.pem' ||
    !Number.isInteger(max) ||
    max < STAGING_PRISMA_POOL_DEFAULT_MAX ||
    max > STAGING_PRISMA_POOL_MAX_ALLOWED
  ) {
    throw new Error('DATABASE_URL does not match the authorized staging pooler target.');
  }

  const nodePgUrl = new URL(url.toString());
  for (const name of allowedTlsParameters) nodePgUrl.searchParams.delete(name);

  return {
    connectionString: nodePgUrl.toString(),
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: false,
    ssl: {
      ca: caPem,
      rejectUnauthorized: true,
      servername: target.host,
      checkServerIdentity: (_hostname, certificate) =>
        tls.checkServerIdentity(target.host, certificate),
    },
  };
}

/** Build a strict, staging-only node-postgres pool config from DATABASE_URL. */
export function createStagingPrismaPgPoolConfig(
  env: PrismaRuntimeEnvironment,
  fileAccess?: CertificateFileAccess,
): PoolConfig {
  if (resolvePrismaRuntimeMode(env) !== 'staging-prisma-pg') {
    throw new Error('PrismaPg pool configuration is available only for the exact staging runtime.');
  }
  const rawUrl = env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL must be configured before PrismaPg can start.');

  const { url, caPem } = validateSupabaseDatabaseUrlForPgAdapter(rawUrl, fileAccess);
  return buildStrictPgPoolConfig(url, caPem, {
    host: STAGING_IDENTITY.poolerHost,
    port: '5432',
    username: STAGING_IDENTITY.poolerUser,
    database: STAGING_IDENTITY.database,
  }, resolvePrismaPgPoolMax(env));
}

export interface PrismaPgRuntimeFactories {
  createPool?: (config: PoolConfig) => Pool;
  createAdapter?: (pool: Pool) => unknown;
  createClient?: (adapter: unknown) => PrismaClient;
}

/** Create the adapter client; initialization errors never fall back to native Prisma. */
export function createStagingPrismaPgClient(
  env: PrismaRuntimeEnvironment,
  factories: PrismaPgRuntimeFactories = {},
  fileAccess?: CertificateFileAccess,
): PrismaClient {
  const poolConfig = createStagingPrismaPgPoolConfig(env, fileAccess);
  const pool = factories.createPool ? factories.createPool(poolConfig) : new Pool(poolConfig);

  return createPrismaPgClientFromPool(pool, factories);
}

/** Adapter/client wiring used after strict staging pool validation. */
export function createPrismaPgClientFromPool(
  pool: Pool,
  factories: PrismaPgRuntimeFactories = {},
): PrismaClient {
  try {
    // Handle idle-client errors without logging driver details or connection metadata.
    pool.on('error', () => undefined);
    const adapter = factories.createAdapter
      ? factories.createAdapter(pool)
      : new PrismaPg(pool, {
        disposeExternalPool: true,
        onPoolError: () => undefined,
        onConnectionError: () => undefined,
      });
    return factories.createClient
      ? factories.createClient(adapter)
      : new PrismaClient({ adapter: adapter as never, log: ['error'] });
  } catch {
    void pool.end().catch(() => undefined);
    throw new Error('Staging PrismaPg initialization failed closed.');
  }
}
