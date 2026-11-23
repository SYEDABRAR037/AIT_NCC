import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertMockHarnessEnvironment,
  attestDisposableTarget,
  createMockChildEnvironment,
  DatabaseIdentityEvidence,
  DisposableRunManifest,
  isMockOnlyEvidence,
  planExactTeardown,
  runMockOnlyCommand,
  validateHarnessCommand,
  validateLocalProvisioningEvidence,
} from '../testDatabaseAttestation';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  process.stdout.write(`[PASS] ${name}\n`);
}
function denied(fn: () => unknown): void {
  assert.throws(fn, /\[BSR-05 HARNESS DENIED\]/);
}

const runId = 'run-0123456789abcdef0123456789abcdef';
const manifest: DisposableRunManifest = {
  runId,
  containerId: 'a'.repeat(64),
  imageId: `sha256:${'b'.repeat(64)}`,
  databaseName: `ncc_bsr05_test_${runId.replace(/-/g, '')}`,
  databaseOid: '16384',
  hostPort: 49152,
  databaseRole: 'ncc_biometric_admin',
  postgresMajor: 16,
  purpose: 'ncc-bsr05-disposable-test',
};
const identity = (source: DatabaseIdentityEvidence['source']): DatabaseIdentityEvidence => ({
  source,
  purpose: manifest.purpose,
  runId,
  containerId: manifest.containerId,
  imageId: manifest.imageId,
  databaseName: manifest.databaseName,
  databaseOid: manifest.databaseOid,
  databaseRole: manifest.databaseRole,
  postgresMajor: 16,
  schemaState: 'empty',
  host: source === 'loopback-forwarded' ? '127.0.0.1' : undefined,
  port: source === 'loopback-forwarded' ? manifest.hostPort : undefined,
});
const localProvisioning = () => ({
  engineEndpoint: 'unix:///local/docker.sock',
  contextName: 'local-desktop',
  dockerHostOverridePresent: false,
  imageWasPresentBeforeRun: true,
  imagePullOccurred: false,
  container: {
    containerId: manifest.containerId,
    imageId: manifest.imageId,
    labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': runId },
    publishedHost: '127.0.0.1',
    publishedPort: manifest.hostPort,
    hasTmpfsDataDirectory: true,
    hasPersistentOrBindMount: false,
  },
});
const mockEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PURE_MOCK_TEST: 'true',
  NCC_BSR05_HARNESS_MODE: 'mock',
  PATH: '/mock/path',
};

test('accepts explicit isolated mock mode only', () => assertMockHarnessEnvironment(mockEnv));

for (const target of ['ncc_local_dev', 'ncc_production', 'unknown_database']) {
  test(`rejects ${target} identity`, () => {
    const direct = { ...identity('container-exec'), databaseName: target };
    denied(() => attestDisposableTarget(manifest, localProvisioning(), direct, identity('loopback-forwarded'), 'prewrite'));
  });
}

test('rejects development, production, unknown runtime, and disposable opt-in modes', () => {
  for (const env of [
    { ...mockEnv, NODE_ENV: 'development' },
    { ...mockEnv, NODE_ENV: 'production' },
    { ...mockEnv, NODE_ENV: 'staging' },
    { ...mockEnv, ALLOW_DISPOSABLE_TEST_DB: 'true' },
  ]) denied(() => assertMockHarnessEnvironment(env));
});

test('rejects inherited database, PG, Docker host, and Docker context targets', () => {
  for (const extra of [
    { DATABASE_URL: 'postgres://secret@host/db' },
    { DIRECT_URL: 'postgres://secret@host/db' },
    { SHADOW_DATABASE_URL: 'postgres://secret@host/db' },
    { NCC_UTILITY_DATABASE_URL: 'postgres://secret@host/db' },
    { PGHOST: '127.0.0.1' },
    { PGPASSWORD: 'do-not-print' },
    { DOCKER_HOST: 'ssh://remote' },
    { DOCKER_CONTEXT: 'remote' },
  ]) denied(() => assertMockHarnessEnvironment({ ...mockEnv, ...extra }));
});

test('constructs a child environment from an allowlist without inherited targets or secrets', () => {
  const child = createMockChildEnvironment({ ...mockEnv, SECRET_TOKEN: 'must-not-pass' });
  assert.equal(child.SECRET_TOKEN, undefined);
  assert.equal(child.DATABASE_URL, undefined);
  assert.equal(child.PGDATABASE, undefined);
  assert.equal(child.PATH, '/mock/path');
  denied(() => createMockChildEnvironment({ ...mockEnv, PGDATABASE: 'hidden' }));
});

test('attests matching direct and forwarded disposable identities before writes', () => {
  attestDisposableTarget(manifest, localProvisioning(), identity('container-exec'), identity('loopback-forwarded'), 'prewrite');
});

test('rejects remote Docker, Docker overrides, image pulls, persistent storage, and non-loopback ports', () => {
  validateLocalProvisioningEvidence(manifest, localProvisioning());
  const invalid = [
    (e: ReturnType<typeof localProvisioning>) => { e.engineEndpoint = 'ssh://remote/docker'; },
    (e: ReturnType<typeof localProvisioning>) => { e.dockerHostOverridePresent = true; },
    (e: ReturnType<typeof localProvisioning>) => { e.imageWasPresentBeforeRun = false; },
    (e: ReturnType<typeof localProvisioning>) => { e.imagePullOccurred = true; },
    (e: ReturnType<typeof localProvisioning>) => { e.container.hasPersistentOrBindMount = true; },
    (e: ReturnType<typeof localProvisioning>) => { e.container.publishedHost = '0.0.0.0'; },
  ];
  for (const mutate of invalid) {
    const evidence = localProvisioning(); mutate(evidence);
    denied(() => validateLocalProvisioningEvidence(manifest, evidence));
  }
});

test('rejects wrong database OID, role, version, run marker, container, image, or remote port', () => {
  const mutations: Array<[string, (e: DatabaseIdentityEvidence) => void]> = [
    ['OID', (e) => { e.databaseOid = '99999'; }],
    ['role', (e) => { e.databaseRole = 'ncc_local_app'; }],
    ['version', (e) => { e.postgresMajor = 15; }],
    ['run marker', (e) => { e.runId = 'run-ffffffffffffffffffffffffffffffff'; }],
    ['container', (e) => { e.containerId = 'c'.repeat(64); }],
    ['image', (e) => { e.imageId = `sha256:${'d'.repeat(64)}`; }],
    ['port', (e) => { e.port = 5432; }],
    ['host', (e) => { e.host = 'localhost'; }],
  ];
  for (const [, mutate] of mutations) {
    const forwarded = identity('loopback-forwarded'); mutate(forwarded);
    denied(() => attestDisposableTarget(manifest, localProvisioning(), identity('container-exec'), forwarded, 'prewrite'));
  }
});

test('requires empty schema prewrite and matching run marker after migration', () => {
  const dirty = identity('container-exec'); dirty.schemaState = 'migrated';
  denied(() => attestDisposableTarget(manifest, localProvisioning(), dirty, identity('loopback-forwarded'), 'prewrite'));
  const post = identity('container-exec'); post.schemaState = 'migrated'; post.markerRunId = runId;
  const forwarded = identity('loopback-forwarded'); forwarded.schemaState = 'migrated'; forwarded.markerRunId = runId;
  attestDisposableTarget(manifest, localProvisioning(), post, forwarded, 'postmigration');
  forwarded.markerRunId = 'run-ffffffffffffffffffffffffffffffff';
  denied(() => attestDisposableTarget(manifest, localProvisioning(), post, forwarded, 'postmigration'));
});

test('teardown plan is limited to exact matching ephemeral container', () => {
  const plan = planExactTeardown(manifest, {
    containerId: manifest.containerId,
    imageId: manifest.imageId,
    labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': runId },
    publishedHost: '127.0.0.1',
    publishedPort: manifest.hostPort,
    hasTmpfsDataDirectory: true,
    hasPersistentOrBindMount: false,
  });
  assert.deepEqual(plan, { allowed: true, containerId: manifest.containerId, runId, broadCleanup: false });
});

test('cleanup failure or ownership mismatch refuses teardown and never requests broad cleanup', () => {
  for (const observed of [
    { containerId: 'e'.repeat(64), labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': runId } },
    { containerId: manifest.containerId, labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': 'wrong-run' } },
  ]) denied(() => planExactTeardown(manifest, {
    containerId: observed.containerId,
    imageId: manifest.imageId,
    labels: observed.labels,
    publishedHost: '127.0.0.1',
    publishedPort: manifest.hostPort,
    hasTmpfsDataDirectory: true,
    hasPersistentOrBindMount: false,
  }));
  denied(() => planExactTeardown(manifest, {
    containerId: manifest.containerId, imageId: manifest.imageId,
    labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': runId },
    publishedHost: '127.0.0.1', publishedPort: manifest.hostPort,
    hasTmpfsDataDirectory: true, hasPersistentOrBindMount: true,
  }));
  for (const changed of [
    { publishedHost: '0.0.0.0' },
    { publishedPort: manifest.hostPort + 1 },
    { imageId: `sha256:${'f'.repeat(64)}` },
  ]) denied(() => planExactTeardown(manifest, {
    containerId: manifest.containerId, imageId: manifest.imageId,
    labels: { 'ncc.purpose': manifest.purpose, 'ncc.run-id': runId },
    publishedHost: '127.0.0.1', publishedPort: manifest.hostPort,
    hasTmpfsDataDirectory: true, hasPersistentOrBindMount: false,
    ...changed,
  }));
});

test('rejects migration, reset, destructive, Docker, and database commands', () => {
  for (const command of ['migrate', 'migrate deploy', 'migrate reset', 'db push', 'reset', 'truncate', 'docker rm', 'docker system prune', 'psql']) {
    denied(() => validateHarnessCommand(command));
    denied(() => runMockOnlyCommand([command], mockEnv));
  }
});

test('mock-check has no external-operation adapter', () => {
  assert.match(runMockOnlyCommand(['mock-check'], mockEnv), /No container or database was contacted/);
  assert.equal(isMockOnlyEvidence({ mode: 'mock', result: 'MOCK_ONLY', provider: 'MOCK' }), true);
  assert.equal(isMockOnlyEvidence({ mode: 'mock', result: 'VERIFIED', provider: 'MOCK' }), false);
  assert.equal(isMockOnlyEvidence({ mode: 'production', result: 'MOCK_ONLY', provider: 'MOCK' }), false);
});

test('harness implementation contains no Docker, Prisma, process-spawn, or database adapter', () => {
  const core = readFileSync(join(__dirname, '../testDatabaseAttestation.ts'), 'utf8');
  const cli = readFileSync(join(__dirname, '../../scripts/biometric-postgres-harness.ts'), 'utf8');
  for (const source of [core, cli]) {
    assert.doesNotMatch(source, /from ['"](?:child_process|@prisma\/client|pg)['"]/);
    assert.doesNotMatch(source, /\b(?:execSync|spawnSync|execFileSync|PrismaClient)\b/);
  }
});

process.stdout.write(`\n${passed} isolated mocked harness tests passed. No database or container was contacted.\n`);
