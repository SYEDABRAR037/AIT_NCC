/**
 * Pure BSR-05 harness safety checks.
 *
 * This module deliberately has no Docker, Prisma, PostgreSQL, filesystem, or
 * child-process adapter. It can validate metadata supplied by a future
 * separately reviewed harness, but cannot connect to or mutate a target.
 */

export type HarnessPhase = 'prewrite' | 'postmigration';

export interface DisposableRunManifest {
  runId: string;
  containerId: string;
  imageId: string;
  databaseName: string;
  databaseOid: string;
  hostPort: number;
  databaseRole: string;
  postgresMajor: number;
  purpose: 'ncc-bsr05-disposable-test';
}

export interface DatabaseIdentityEvidence {
  source: 'container-exec' | 'loopback-forwarded';
  purpose: string;
  runId: string;
  containerId: string;
  imageId: string;
  databaseName: string;
  databaseOid: string;
  databaseRole: string;
  postgresMajor: number;
  schemaState: 'empty' | 'migrated';
  markerRunId?: string;
  host?: string;
  port?: number;
}

export interface ContainerOwnershipEvidence {
  containerId: string;
  imageId: string;
  labels: Record<string, string | undefined>;
  publishedHost: string;
  publishedPort: number;
  hasTmpfsDataDirectory: boolean;
  hasPersistentOrBindMount: boolean;
}

export interface LocalProvisioningEvidence {
  engineEndpoint: string;
  contextName: string;
  dockerHostOverridePresent: boolean;
  imageWasPresentBeforeRun: boolean;
  imagePullOccurred: boolean;
  container: ContainerOwnershipEvidence;
}

const FORBIDDEN_TARGET_ENV_NAMES = new Set([
  'DATABASE_URL',
  'DIRECT_URL',
  'SHADOW_DATABASE_URL',
  'PRISMA_DATABASE_URL',
  'NCC_UTILITY_DATABASE_URL',
  'DISPOSABLE_TEST_DATABASE_URL',
  'PGHOST',
  'PGHOSTADDR',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGSERVICE',
  'PGSERVICEFILE',
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
]);

const SAFE_MOCK_COMMANDS = new Set(['mock-check']);
const FORBIDDEN_COMMAND_PARTS = [
  'migrate',
  'db push',
  'reset',
  'drop',
  'truncate',
  'delete',
  'docker rm',
  'docker prune',
  'psql',
  'prisma',
];

function fail(reason: string): never {
  // Deliberately do not include user-supplied values (which may contain URLs or secrets).
  throw new Error(`[BSR-05 HARNESS DENIED] ${reason}`);
}

function expectedDatabaseName(runId: string): string {
  return `ncc_bsr05_test_${runId.replace(/-/g, '')}`;
}

export function assertMockHarnessEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NCC_BSR05_HARNESS_MODE !== 'mock') fail('Only explicit mock mode is implemented.');
  if (env.NODE_ENV !== 'test' || env.PURE_MOCK_TEST !== 'true') {
    fail('Mock harness requires the isolated test environment.');
  }
  if (env.ALLOW_DISPOSABLE_TEST_DB === 'true' || env.NCC_TEST_DATABASE_ISOLATED === 'true') {
    fail('Disposable database mode is unavailable in this code-only harness.');
  }
  for (const name of Object.keys(env)) {
    const normalized = name.toUpperCase();
    if (FORBIDDEN_TARGET_ENV_NAMES.has(normalized) || normalized.startsWith('PG')) {
      fail('Database and Docker target variables are not accepted.');
    }
  }
}

/** Construct a minimal child environment; never pass through arbitrary parent variables. */
export function createMockChildEnvironment(
  parent: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  assertMockHarnessEnvironment(parent);
  const child: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    PURE_MOCK_TEST: 'true',
    NCC_BSR05_HARNESS_MODE: 'mock',
    PRISMA_DONT_LOAD_DOTENV: '1',
  };
  if (parent.PATH) child.PATH = parent.PATH;
  if (parent.TZ) child.TZ = parent.TZ;
  return child;
}

export function validateManifest(manifest: DisposableRunManifest): void {
  if (manifest.purpose !== 'ncc-bsr05-disposable-test') fail('Run purpose is not approved.');
  if (!/^run-[a-f0-9]{32}$/.test(manifest.runId)) fail('Run identifier is invalid.');
  if (!/^[a-f0-9]{64}$/.test(manifest.containerId)) fail('Container identity is invalid.');
  if (!/^sha256:[a-f0-9]{64}$/.test(manifest.imageId)) fail('Image identity is invalid.');
  if (manifest.databaseName !== expectedDatabaseName(manifest.runId)) fail('Database name is not bound to this run.');
  if (!/^[1-9][0-9]*$/.test(manifest.databaseOid)) fail('Database OID is invalid.');
  if (!Number.isInteger(manifest.hostPort) || manifest.hostPort < 1 || manifest.hostPort > 65535) {
    fail('Published port is invalid.');
  }
  if (!manifest.databaseRole || manifest.postgresMajor !== 16) fail('Database role or server version is not approved.');
}

function assertIdentityMatchesManifest(
  manifest: DisposableRunManifest,
  evidence: DatabaseIdentityEvidence,
  phase: HarnessPhase,
): void {
  if (evidence.purpose !== manifest.purpose || evidence.runId !== manifest.runId) fail('Run marker or purpose mismatch.');
  if (evidence.containerId !== manifest.containerId || evidence.imageId !== manifest.imageId) fail('Container or image mismatch.');
  if (evidence.databaseName !== manifest.databaseName || evidence.databaseOid !== manifest.databaseOid) fail('Database identity mismatch.');
  if (evidence.databaseRole !== manifest.databaseRole || evidence.postgresMajor !== manifest.postgresMajor) fail('Database role or version mismatch.');
  if (phase === 'prewrite' && evidence.schemaState !== 'empty') fail('Target schema is not empty before writes.');
  if (phase === 'postmigration' && (evidence.schemaState !== 'migrated' || evidence.markerRunId !== manifest.runId)) {
    fail('Post-migration marker or schema state mismatch.');
  }
}

/** Require independent container and forwarded-connection evidence to identify the same target. */
export function attestDisposableTarget(
  manifest: DisposableRunManifest,
  provisioning: LocalProvisioningEvidence,
  direct: DatabaseIdentityEvidence,
  forwarded: DatabaseIdentityEvidence,
  phase: HarnessPhase,
): void {
  validateManifest(manifest);
  validateLocalProvisioningEvidence(manifest, provisioning);
  if (direct.source !== 'container-exec' || forwarded.source !== 'loopback-forwarded') {
    fail('Both independent identity sources are required.');
  }
  assertIdentityMatchesManifest(manifest, direct, phase);
  assertIdentityMatchesManifest(manifest, forwarded, phase);
  if (forwarded.host !== '127.0.0.1' || forwarded.port !== manifest.hostPort) {
    fail('Forwarded connection is not bound to the attested loopback port.');
  }
}

export function validateLocalProvisioningEvidence(
  manifest: DisposableRunManifest,
  evidence: LocalProvisioningEvidence,
): void {
  validateManifest(manifest);
  if (!evidence.contextName || !evidence.engineEndpoint.startsWith('unix://') || evidence.dockerHostOverridePresent) {
    fail('Docker engine is not proven local.');
  }
  if (!evidence.imageWasPresentBeforeRun || evidence.imagePullOccurred) {
    fail('Only a previously present local image may be used; image pulls are forbidden.');
  }
  planExactTeardown(manifest, evidence.container);
}

/** Only produce a teardown instruction for the exact container owned by this run. */
export function planExactTeardown(
  manifest: DisposableRunManifest,
  observed: ContainerOwnershipEvidence,
): { allowed: true; containerId: string; runId: string; broadCleanup: false } {
  validateManifest(manifest);
  if (observed.containerId !== manifest.containerId || observed.imageId !== manifest.imageId) {
    fail('Refusing teardown because container or image identity changed.');
  }
  if (observed.labels['ncc.purpose'] !== manifest.purpose || observed.labels['ncc.run-id'] !== manifest.runId) {
    fail('Refusing teardown because ownership labels do not match.');
  }
  if (observed.publishedHost !== '127.0.0.1' || observed.publishedPort !== manifest.hostPort) {
    fail('Refusing teardown because published port metadata changed.');
  }
  if (!observed.hasTmpfsDataDirectory || observed.hasPersistentOrBindMount) {
    fail('Refusing target because storage is not ephemeral.');
  }
  return { allowed: true, containerId: manifest.containerId, runId: manifest.runId, broadCleanup: false };
}

/** This runner intentionally has no real provisioning, migration, test, or teardown command. */
export function validateHarnessCommand(command: string): 'mock-check' {
  const normalized = command.trim().toLowerCase();
  if (SAFE_MOCK_COMMANDS.has(normalized)) return 'mock-check';
  if (FORBIDDEN_COMMAND_PARTS.some((part) => normalized.includes(part))) {
    fail('Database, migration, reset, and destructive operations are disabled.');
  }
  fail('Only mock-check is available; real disposable PostgreSQL operations are not implemented.');
}

export function isMockOnlyEvidence(value: { provider?: string; result?: string; mode?: string }): boolean {
  return value.mode === 'mock' && value.result === 'MOCK_ONLY' && value.provider === 'MOCK';
}

/** Pure mock-mode command router; there are deliberately no external-operation handlers. */
export function runMockOnlyCommand(args: string[], env: NodeJS.ProcessEnv): string {
  assertMockHarnessEnvironment(env);
  if (args.length !== 1) {
    fail('Supply exactly the mock-check command.');
  }
  validateHarnessCommand(args[0]);
  return 'Mock harness safety checks are available. No container or database was contacted.';
}

