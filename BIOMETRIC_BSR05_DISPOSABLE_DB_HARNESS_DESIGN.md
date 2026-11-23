# BSR-05 Disposable PostgreSQL Harness Design

**Status:** Readiness design only. No database connection, Docker command, container, migration, or test was run. This is the proposed first implementation milestone and does not authorize running it.

## Goal and threat model

Provide one narrowly scoped runner for BSR-05 PostgreSQL integration tests that cannot silently fall back to an existing NCC database. It protects against accidental target mistakes and contaminated local environment. It is not a defense against a malicious local administrator with Docker/database superuser access; local host control remains trusted.

The harness must fail before any database write unless independent checks pass. A database name containing “test”, a loopback URL, a confirmation phrase, or NCC_TEST_DATABASE_ISOLATED by itself is not sufficient identity evidence.

## Proposed files for the first implementation slice

- backend/scripts/biometric-postgres-harness.ts — orchestrates local container, target verification, schema migration, dedicated test process, evidence and teardown.
- backend/src/__tests__/biometric-postgres-harness.test.ts — pure unit/mocked tests for all guard and failure branches; no DB.
- backend/src/testDatabaseAttestation.ts — pure validation and attestation comparison helpers.
- backend/src/databaseSafety.ts — later add strict harness-only validation without weakening mock-only behavior.
- backend/src/testScriptBootstrap.ts and backend/src/scriptPrisma.ts — later expose verified-target client construction; never auto-connect on import before attestation.
- backend/src/__tests__/biometric-postgres.integration.test.ts — later, only after schema and routines are approved.
- backend/package.json — later add dedicated script, not broad npm test integration mode.

Preserve current test-isolation-guard.ts as the ordinary mock-only guard. Do not make it opt into a real DB.

## Provisioning design

1. Require explicit command selection for the dedicated harness. Check DATABASE_URL, DIRECT_URL, NCC_UTILITY_DATABASE_URL and other project DB URL variables are absent in the parent shell. Do not source .env, .env.test, staging files or shell history.
2. Reject DOCKER_HOST and non-local Docker contexts. Inspect the Docker context endpoint and require a local Unix socket/Desktop engine. Do not use a cloud/container-hosting API.
3. Require the PostgreSQL image already present. Inspect and record its immutable local image ID/digest; run with --pull=never. Abort if absent; do not download an image.
4. Create a unique run ID and temporary directory outside the repository with mode 0700; store random credentials in mode-0600 files. Do not enable shell tracing. Never log URLs/passwords.
5. Start a unique disposable container with a run-specific name and labels, unique database name containing “test”, random temporary admin password, bounded tmpfs database directory, no bind mount or named/persistent volume, TCP published only to 127.0.0.1 with dynamically assigned host port, and exact local image ID with --pull=never.
6. If create or validation fails, tear down only that exact container after rechecking full container ID and expected labels. Never run broad prune/remove commands.

## Pre-write identity attestation

Before running Prisma migration or fixture setup, the orchestrator verifies:

- Docker engine endpoint is local; no remote context or DOCKER_HOST.
- Container full immutable ID and expected run/purpose labels match current run manifest.
- Image ID matches locally inspected image; no image pull occurred.
- Host port maps only to 127.0.0.1:5432 in that container.
- Container uses tmpfs and has no bind/named volume.
- A direct docker exec read-only query returns generated database name, expected bootstrap/admin role, PostgreSQL major version 16 and database OID.
- Host-forwarded connection through the exact dynamic loopback port returns the same database name/OID/version and expected role. Compare both before writes.
- Schema is empty before migration.
- A run-specific identity manifest has the expected run ID. After initialization, a DB marker stores the run ID and random non-secret attestation nonce; the test process checks it before fixtures.
- Prisma URL host/database match the verified manifest; never use DATABASE_URL fallback or repository dotenv.
- The test process asserts explicit harness state produced by the parent. It does not treat a manually set environment variable as proof.

Only read-only SELECT and Docker metadata inspection occur before attestation. Any mismatch aborts before DDL or fixture writes. Emit only sanitized identity evidence. After migrations, re-attest the same container ID, port, DB name/OID, role and version, and verify only expected migration objects/marker exist.

## Roles inside the disposable target

- ncc_biometric_owner: NOLOGIN, least-privilege owner of private challenge/quota tables and SECURITY DEFINER routines; not superuser.
- ncc_biometric_migrator: temporary migration login; DDL rights only for this disposable target; never used by app test code.
- ncc_biometric_runtime: runtime integration-test login; no direct challenge/quota DML; exact routine EXECUTE and required reads only.
- ncc_biometric_cleanup: cleanup test role; execute bounded cleanup routine only.
- ncc_biometric_fixture: optional harness-controlled fixture setup role; synthetic fixture rows only, cleanup restricted to tracked IDs.
- Admin bootstrap role: only for creating disposable roles, checking identity and teardown; never used by app runtime.

Role passwords exist only in the temporary run directory/process environment and are never echoed. Never reuse app .env credentials.

## Proposed workflow commands (future only; not executed)

The first code version should implement these operations in the TypeScript harness rather than invite hand-run commands. The outline below is for review:

    set -euo pipefail
    set +x
    cd "/Users/syedabrarahmed/Desktop/NCC Web & App/backend"

    # Abort if inherited DB or remote Docker targets exist.
    test -z "${DATABASE_URL:-}"
    test -z "${DIRECT_URL:-}"
    test -z "${NCC_UTILITY_DATABASE_URL:-}"
    test -z "${DOCKER_HOST:-}"

    # Require local engine and pre-existing pinned image; no pull.
    docker context inspect
    docker image inspect postgres:16-alpine

    # These harness operations generate a run directory, provision container,
    # attest target, migrate, execute one dedicated integration test, and teardown.
    npx ts-node scripts/biometric-postgres-harness.ts provision
    npx ts-node scripts/biometric-postgres-harness.ts attest
    npx ts-node scripts/biometric-postgres-harness.ts migrate
    npx ts-node scripts/biometric-postgres-harness.ts test
    npx ts-node scripts/biometric-postgres-harness.ts teardown

Do not replace the runner with manually exported environment values. Current ALLOW_DISPOSABLE_TEST_DB and confirmation string are not sufficient attestation; they may be additional confirmations only. Migration uses explicit disposable migration-role URLs. Prisma migrate deploy is planned only after target attestation. Do not use migrate dev, db push, migrate reset, broad npm test with disposable opt-in, or persistent Compose service.

## Failure handling and cleanup

- Before attestation: no database DDL/DML and no test client construction.
- Migration failure: stop; inspect only the same disposable target's migration status/catalog; if uncertain, discard that exact ephemeral instance and recreate. Never retry against another URL.
- Test failure: collect sanitized output, clean only fixture IDs bearing this run ID, disconnect all clients, stop only exact labeled container.
- Unknown test commit: treat fixture state as uncertain; no broad delete. If exact fixture IDs cannot be verified, discard only ephemeral container.
- Teardown rechecks full container ID, run ID and label before stopping. Remove only the harness-owned mode-0700 directory after checking its path is inside the expected temp parent and has the generated run ID.
- Use trap/finally cleanup. After a process crash, operator verifies exact label/run before stopping. No docker system prune.
- Teardown failure invalidates run and is reported; never touch ncc_postgres_db or ncc_pgdata.

## Harness test plan

Pure unit/mocked tests, no DB/container:
- inherited database URLs abort;
- malformed/non-PostgreSQL/remote/non-loopback URL rejected;
- remote Docker context or DOCKER_HOST rejected;
- image absent or image ID mismatch aborts without pull;
- wrong container ID/labels/run ID/port/volume/tmpfs rejected;
- wrong DB name/OID/role/version, nonempty schema or marker mismatch aborts pre-write;
- direct-container and forwarded-connection identity disagreement aborts;
- secrets absent from logs/errors;
- failure always tears down only exact owned container;
- broad test command cannot opt into disposable target;
- teardown refuses mismatched ID/labels and never uses broad deletion.

Disposable PostgreSQL tests, only after separate authorization:
- verified target accepts expected identity and rejects wrong marker;
- migration runs as migrator, objects have correct NOLOGIN owner;
- runtime direct writes fail while intended routines work;
- fixture role cannot mutate unrelated rows;
- fixture cleanup uses only tracked IDs; counter reconciliation passes before teardown.

## Authorization and stop point

This artifact prepares the next implementation task; it does not create or start a database/container. The first implementation step should be harness code plus pure mocked safety tests. Only after review should a disposable PostgreSQL provision/migration/integration run be separately authorized. No existing database is a target. Biometric attendance remains disabled and manual attendance untouched.
