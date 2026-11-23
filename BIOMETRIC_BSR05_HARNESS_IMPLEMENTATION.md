# BSR-05 Disposable PostgreSQL Harness — Code-Only Mock Milestone

## Scope and safety state

This milestone adds pure target-validation logic and a mock-only command. It does **not** provision a database or container. The implementation has no Docker, Prisma, PostgreSQL, or process-spawning adapter. It cannot apply migrations, reset a database, run `db push`, or delete database/container resources.

The shared challenge-store schema, migration, and PostgreSQL integration test are still blocked by the findings in `BIOMETRIC_BSR05_PRE_IMPLEMENTATION_RECONCILIATION.md`. Biometric attendance remains disabled. Manual attendance code and behavior were not changed.

## Added files

- `backend/src/testDatabaseAttestation.ts` — pure environment, manifest, paired-identity, and exact-teardown-plan validation. No I/O imports or database client.
- `backend/scripts/biometric-postgres-harness.ts` — currently exposes only `mock-check`; every other command is denied. No real provision, migration, integration-test, or teardown command exists.
- `backend/src/__tests__/biometric-postgres-harness.test.ts` — isolated tests with in-memory metadata fixtures; no test database bootstrap is imported.

Existing `backend/package.json` scripts were left unchanged. The existing database-safety helpers and ordinary test isolation guard were not weakened or modified.

## Running the isolated checks

From `backend/`, with a clean environment that contains no inherited database or Docker target variables:

```sh
env -i PATH="$PATH" NODE_ENV=test PURE_MOCK_TEST=true NCC_BSR05_HARNESS_MODE=mock \
  ./node_modules/.bin/ts-node src/__tests__/biometric-postgres-harness.test.ts

env -i PATH="$PATH" NODE_ENV=test PURE_MOCK_TEST=true NCC_BSR05_HARNESS_MODE=mock \
  ./node_modules/.bin/ts-node scripts/biometric-postgres-harness.ts mock-check
```

The first command uses synthetic metadata objects only. The second prints that no container or database was contacted. Do not add `ALLOW_DISPOSABLE_TEST_DB`, `NCC_TEST_DATABASE_ISOLATED=true`, a database URL, or a real-mode selector to these commands.

## Safety properties in this milestone

1. Mock mode requires `NODE_ENV=test`, `PURE_MOCK_TEST=true`, and the explicit `NCC_BSR05_HARNESS_MODE=mock` marker.
2. Production, development, other/unknown runtime modes, disposable-DB opt-in, and inherited DB/PG/Docker target variables fail closed.
3. The child environment helper is allowlisted and does not propagate arbitrary secrets or target variables.
4. A target is accepted only when the mocked provisioning evidence identifies a Unix-socket local engine, no Docker host override, a pre-existing image with no pull, exact run labels, tmpfs-only storage, and loopback-only port. Its generated run ID, exact generated database name, container ID, image ID, database OID, role, PostgreSQL major version, purpose marker, schema phase, and direct/forwarded identity must also agree. The forwarded side must be `127.0.0.1` at the manifest port.
5. Pre-write attestation requires an empty schema. Post-migration attestation requires the same run marker. These checks consume mocked evidence only in this milestone.
6. Cleanup is represented as an exact-target plan and is denied if container/image/labels/port/storage do not match. There is no broad prune/remove action.
7. The command router accepts only `mock-check`; migration, reset, database, Docker, and destructive command strings are rejected.
8. Mock evidence remains explicitly `MOCK_ONLY`; it cannot represent a verified biometric result.

## How real disposable PostgreSQL testing may later be enabled

Real integration testing requires a separate implementation and authorization. This mock milestone intentionally does not contain a dormant real mode that can be selected with an environment variable.

Before adding any real adapter:

1. Resolve the schema and role blockers in the reconciliation report: complete multi-schema annotations, retention policy representation, executable SQL/functions, least-privilege row-lock/FK permissions, lock-order integration, and exact test matrix.
2. Implement the harness as a separately reviewed extension with a child-process environment allowlist, explicit local Docker context verification, pre-existing pinned image ID only, unique labeled ephemeral container, tmpfs storage, no persistent volumes, and loopback-only dynamic port.
3. Verify target identity independently through container-local and forwarded read-only metadata before any application-issued DDL, migrations, fixture writes, or Prisma client creation. Compare run ID, container/image ID, database name/OID, role, port and PostgreSQL version. Recheck the same identity before every later operation and before teardown.
4. Apply only the reviewed migration to the newly attested disposable target using a migration-only role. Run a dedicated PostgreSQL suite using synthetic fixtures and restricted runtime/cleanup roles. Never opt the normal test suite into a database.
5. Verify counter reconciliation, role ACLs and fixture cleanup, then destroy only the exact labeled ephemeral target. No global Docker prune or broad database cleanup.
6. Obtain separate approval before the first container/database is created or a migration is executed. This document does not grant that approval.

Until these gates are complete, only the pure mocked test command above is supported. No existing NCC development, production, protected, or backup database is an acceptable target.

## Verification record

Executed successfully:

- Isolated mocked suite: **16 passed** using `NODE_ENV=test`, `PURE_MOCK_TEST=true`, and `NCC_BSR05_HARNESS_MODE=mock` in a clean `env -i` process.
- Targeted TypeScript check for the attestation module, test, and CLI: **passed** (`tsc --noEmit --strict` with local compiler).
- Mock-only CLI `mock-check`: **passed** and reported that no container or database was contacted.
- `git diff --check`: **passed** for tracked changes. The new files also passed the TypeScript compiler; no whitespace errors were reported in the tracked diff.

No Docker command, database connection, migration command, or application attendance/authentication test was run.
