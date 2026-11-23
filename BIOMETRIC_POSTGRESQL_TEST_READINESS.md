# AIT NCC — PostgreSQL Integration-Test Readiness

> **Status note (23 November 2026):** the operational values formerly listed as awaiting selection in this report have since been approved in `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`. Database/container identity, migration, role, and PostgreSQL concurrency prerequisites below remain unverified; all commands are plans only.

**Prepared:** 2026-11-22  
**Scope:** BSR-05 shared challenge storage and BSR-07 competing attendance writes.  
**Execution:** Read-only source/configuration inspection. No database connection, container creation, migration, test, package installation, or environment-file access occurred.

## Recommendation

**NO-GO for the first PostgreSQL integration test at present.** The repository has fail-closed test guards and a PostgreSQL 16 Compose image definition, but no BSR-05 schema/migration and no BSR-07 PostgreSQL integration test target exist. The guard cannot prove that a local URL points to an empty disposable container. BSR-05 schema/migration and test-harness work, review/authorization, then independent verification of a disposable PostgreSQL instance are prerequisites.

This is not authorization to connect to `ncc_local_dev`; it must remain untouched.

## 1. Isolation guard: exact behavior and limitations

`backend/src/__tests__/test-isolation-guard.ts` is intended as the first import of ordinary test suites. It sets `NODE_ENV=test` and `PURE_MOCK_TEST=true`, then calls `prepareTestDatabaseEnvironment()` from `backend/src/databaseSafety.ts` before Prisma construction.

### Mock-only mode

Unless `ALLOW_DISPOSABLE_TEST_DB=true`, the guard:

- Rejects inherited `DATABASE_URL` or `DIRECT_URL` unless each is the fixed unreachable loopback sentinel on port 9.
- Sets `PRISMA_DONT_LOAD_DOTENV=1`.
- Replaces both Prisma URLs with that sentinel and sets `NCC_TEST_DATABASE_ISOLATED=false`.
- In `backend/src/db.ts`, creates an extended Prisma client that throws on any unmocked model operation, raw query, or raw execute.

The script safety regression suite tests inherited URL rejection and verifies unmocked writes fail before any network call. This proves mock-mode protection in tests; it does not identify a running database.

### Explicit disposable-database mode

When `ALLOW_DISPOSABLE_TEST_DB=true`, `prepareTestDatabaseEnvironment()` requires `DISPOSABLE_TEST_DATABASE_URL` and the exact confirmation string `I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE`. It accepts PostgreSQL URLs whose hostname is `localhost`, `127.0.0.1`, `::1`, or `postgres-test`, and whose database path contains `test` or `mock`. Conflicting inherited `DATABASE_URL`/`DIRECT_URL` values are rejected; the mock sentinel or exact disposable URL is accepted. It sets both Prisma URLs to the explicit URL and sets `NCC_TEST_DATABASE_ISOLATED=true`.

`backend/src/db.ts` then creates a real Prisma client. `backend/src/testScriptBootstrap.ts` and `backend/src/scriptPrisma.ts` provide an explicit opt-in path for integration scripts.

### Limits requiring independent checks

The guard does **not** verify that the DB exists, is empty, is newly created, belongs to the intended container, has the expected role/server/version, or is bound only to loopback. It also does not prove the confirmation phrase was set for the correct target, or validate that `postgres-test` resolves to the intended container. The phrase is an operator acknowledgement, not proof of isolation.

Before writes, a future integration test must assert `NCC_TEST_DATABASE_ISOLATED === 'true'`, validate the URL, and independently query database name/role/version through the specific new container. Provision that container with temporary storage and a loopback-only port mapping, not an existing NCC service or volume.

With `ALLOW_DISPOSABLE_TEST_DB=true`, tests importing `test-isolation-guard.ts` may receive a real test DB client. **Do not run broad `npm test` in disposable mode.** Run a dedicated integration file only. Keep the normal mock suite separate with disposable mode unset.

## 2. PostgreSQL and Prisma configuration inspected

- `backend/prisma/schema.prisma` uses PostgreSQL and requires `DATABASE_URL` and `DIRECT_URL`.
- `backend/src/start.ts` loads `backend/.env` unless `PRISMA_DONT_LOAD_DOTENV=1`; it can default `DIRECT_URL` from `DATABASE_URL`.
- Local env-file names include `.env`, `.env.test`, `.env.staging`, and staging backup variants. Their contents were not read. Integration commands must not source them; they must supply explicit disposable URLs only.
- `npm run prisma:migrate` invokes `prisma migrate dev`; it is not suitable for the planned test sequence because it is development-oriented and may invoke shadow DB behavior or dotenv loading.
- There are three migration SQL files: baseline (`20261107000000_init_baseline`), cadet analytics, and auth-session hardening. A blank disposable database should receive the existing migration history via `prisma migrate deploy` after identity verification.
- `docker-compose.yml` defines PostgreSQL 16 Alpine as persistent container `ncc_postgres_db`, exposes host port 5432, mounts persistent volume `ncc_pgdata`, and defaults the DB name to `ncc_command_db`. **Do not use that Compose service or volume** for disposable biometric tests.
- No `.env` values were read or printed. Docker/PostgreSQL availability, port use and active database identity were not checked.

## 3. Schema and migration dependencies

### BSR-05 challenge store

The existing design report proposes a new `BiometricVerificationChallenge` model/table with an opaque ID, unique SHA-256 token digest, training session ID, operator user ID, auth session ID, creation/expiry/consumed timestamps, and relations to `TrainingSession`, `User`, and `AuthSession`.

Required schema/migration work, all currently absent:

1. Add the model and `User`, `TrainingSession`, and `AuthSession` back-relations.
2. Add `AuthSession @@unique([id,userId])` for Prisma composite FK `(authSessionId,operatorUserId) -> AuthSession(id,userId)`.
3. Add a unique token digest and expiry/quota indexes.
4. Add reviewed manual SQL checks for valid time ordering; Prisma cannot express every PostgreSQL check/partial-index requirement.
5. Choose deletion behavior and bounded cleanup/retention. Expiring challenge cleanup must not cascade-delete institutional audit evidence.
6. After schema approval, create and review a migration, then validate it only on a fresh disposable PostgreSQL 16 DB.

No BSR-05 migration exists. The challenge store remains process-local. This work does not include the separate consent schema.

### BSR-07 attendance race

`TrainingAttendance` already has `@@unique([sessionId,cadetId])`, and the baseline migration creates `TrainingAttendance_sessionId_cadetId_key`. Existing migrations also include `AuthSession`. The race test needs no schema change if those constraints remain; the disposable DB must have the current migration history applied. The test needs synthetic `User`/`TrainingSession` fixtures, two independent Prisma clients, and deterministic synchronization at the claim/write boundary.

The repository currently has mocked race coverage, but no dedicated PostgreSQL race test or package script. A future harness should exercise an extracted/injectable persistence-claim boundary so the race can be tested without enabling the biometric runtime route or setting `ENABLE_BIOMETRIC_ATTENDANCE=true`. If testing requires turning on that route/flag, the test design is not ready.

## 4. Disposable local PostgreSQL provisioning (prepared, not executed)

Future execution requires separate authorization, local Docker and the PostgreSQL 16 image already present. These commands are instructions only; they were not run. Do not pull/download an image as part of this task.

### Setup

```sh
set -euo pipefail
cd "/Users/syedabrarahmed/Desktop/NCC Web & App/backend"

# Use a dedicated shell with DB URLs unset; abort rather than overwrite them.
if [ -n "${DATABASE_URL:-}" ] || [ -n "${DIRECT_URL:-}" ]; then
  echo "Use a clean shell with DATABASE_URL and DIRECT_URL unset."
  exit 1
fi

# Read-only prerequisites: stop if the chosen port is occupied or image absent.
if lsof -nP -iTCP:55439 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 55439 is occupied; select another reviewed port."
  exit 1
fi
docker image inspect postgres:16-alpine >/dev/null

RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
CONTAINER="ncc-biometric-pg-test-${RUN_ID}"
DB_NAME="ncc_biometric_test_${RUN_ID//-/_}"
ENV_FILE="$(mktemp /tmp/ncc-biometric-pg.XXXXXX)"
chmod 600 "$ENV_FILE"
TEST_DB_PASSWORD="$(openssl rand -hex 32)"
printf 'POSTGRES_USER=postgres\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=%s\n' \
  "$TEST_DB_PASSWORD" "$DB_NAME" > "$ENV_FILE"

docker run --detach --pull=never \
  --name "$CONTAINER" \
  --label ncc.disposable.biometric-test=true \
  --publish 127.0.0.1:55439:5432 \
  --tmpfs /var/lib/postgresql/data:rw,size=1g \
  --env-file "$ENV_FILE" \
  postgres:16-alpine

for attempt in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -d "$DB_NAME"

# Compose the ephemeral URL in this shell only. Never print it.
export DISPOSABLE_TEST_DATABASE_URL="postgresql://postgres:${TEST_DB_PASSWORD}@127.0.0.1:55439/${DB_NAME}?schema=public"
export DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL"
export DIRECT_URL="$DISPOSABLE_TEST_DATABASE_URL"
export NODE_ENV=test
export PRISMA_DONT_LOAD_DOTENV=1
export ALLOW_DISPOSABLE_TEST_DB=true
export NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE
```

The password is random and held in a mode-600 file outside the repository. Keep shell tracing (`set -x`) disabled. Do not place the URL/password in logs, screenshots, source, or reports.

### Verify identity and empty state before writes

First confirm the unique container label and inspect its port mapping; then query identity through that exact container's own socket:

```sh
test "$(docker inspect --format '{{ index .Config.Labels "ncc.disposable.biometric-test" }}' "$CONTAINER")" = "true"
docker inspect --format '{{json .NetworkSettings.Ports}}' "$CONTAINER"
docker exec "$CONTAINER" psql -XAt -U postgres -d "$DB_NAME" \
  -c "SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num');"
docker exec "$CONTAINER" psql -XAt -U postgres -d "$DB_NAME" \
  -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public';"
```

Require database name=`$DB_NAME`, role=`postgres` (the disposable instance owner), server major version 16, host binding `127.0.0.1:55439`, and zero public tables. Abort on mismatch. Save only sanitized identity output. In the test process also assert the parsed connection host/database and `NCC_TEST_DATABASE_ISOLATED=true`.

### Migration and test execution (future only)

There is no BSR-05 migration or BSR-07 integration test file yet. Do not run until those are created/reviewed and execution is separately authorized:

```sh
# Non-connecting schema check, after the approved schema edit exists.
npx prisma validate

# Database write, only after target identity is rechecked and the reviewed
# BSR-05 migration is present and specifically authorized.
npx prisma migrate deploy

# Future dedicated test must import testScriptBootstrap first, assert the
# isolation marker/database identity, and open two independent Prisma clients.
NODE_ENV=test npx ts-node src/__tests__/biometric-postgres.integration.test.ts
```

Do not use `npm run prisma:migrate` (`migrate dev`), `prisma migrate reset`, `db push`, broad `npm test` with disposable mode enabled, or current `npm run test:biometric` as PostgreSQL evidence. Current biometric tests are mocked/controller tests; no PostgreSQL race test is configured. Run the regular suite separately in a clean mock-only shell with disposable mode and DB URLs unset.

## 5. Required integration assertions

### BSR-05

- Persist only the hash, bound to the right session/operator/auth session and expiry.
- Two clients race to consume one challenge: exactly one wins; replay, wrong binding, revoked session and expired challenge fail.
- Concurrent quota issuance does not exceed the operator cap.
- Database outage or bounded serialization retry exhaustion fails closed; no local fallback is used.
- Consumption commits before later matching, so a later error cannot make the token replayable.
- Cleanup deletes only expired/old eligible rows, not live challenges or unrelated rows.

### BSR-07

- Use synthetic fixtures and independent challenges. Barrier both clients after precheck and immediately before claim.
- First-mark race: one success, one `409 ALREADY_MARKED`, one attendance row in `PRESENT`, `presentCount=1`, one audit row, winner-only notification scheduling.
- Existing `ABSENT` row race: one conditional transition succeeds, the other conflicts; one row remains.
- Separate manual-path assertion proves `ABSENT` correction still works with audit in the same transaction.
- PostgreSQL audit failure causes rollback/no success. Mock transaction rollback is not sufficient evidence.
- No biometric template, real cadet, real message, camera, or liveness provider is required; feature flag remains unchanged and disabled.

## 6. Fixture cleanup, recovery and teardown

1. Test code tracks only the IDs it inserts and deletes only those rows in `finally`, in FK-safe order. Never use broad `deleteMany({})`, `TRUNCATE`, global seed data, or cleanup against a non-disposable DB.
2. Disconnect both Prisma clients in `finally`, including after assertion failure.
3. Preserve sanitized results, recheck the exact container label, stop only the generated container, then remove the temporary secret file:

```sh
test "$(docker inspect --format '{{ index .Config.Labels "ncc.disposable.biometric-test" }}' "$CONTAINER")" = "true"
docker stop "$CONTAINER"
rm -f -- "$ENV_FILE"
unset TEST_DB_PASSWORD DISPOSABLE_TEST_DATABASE_URL DATABASE_URL DIRECT_URL
unset ALLOW_DISPOSABLE_TEST_DB NCC_DISPOSABLE_DB_CONFIRMATION NCC_TEST_DATABASE_ISOLATED
```

With `--rm` and tmpfs, stopping that container removes the ephemeral database. If a shell exits unexpectedly, identify the exact generated container and verify its label before stopping it. Do not use broad `docker system prune` or remove volumes. No existing NCC backup should be used. Any future restore test must target a second newly provisioned disposable container/database containing only synthetic data.

## 7. Blockers and prerequisites

- **Schema:** BSR-05 model/back-relations, `AuthSession @@unique([id,userId])`, indexes and SQL checks are proposals only; no migration exists.
- **Harness:** no dedicated `biometric-postgres.integration.test.ts` or package target exists. Mocked race coverage does not establish PostgreSQL locking/unique behavior.
- **Test seam:** BSR-07 needs a persistence claim boundary testable without enabling the biometric runtime route/flag.
- **Approval:** repository approval records still treat schema/migration and disposable DB testing as requiring separate evidence/authorization. This report does not grant it.
- **Guard:** URL checks alone do not prove DB/container identity or emptiness; independent checks are mandatory.
- **Operations:** challenge quota, TTL, cleanup schedule and consumed-row retention must be selected before BSR-05 implementation.
- **Local prerequisites:** Docker, `postgres:16-alpine`, `lsof`, `openssl`, and `npx` must already be available; availability was not checked and nothing was installed.

Proceed only after schema/migration approval, an authorized disposable-test task, a reviewed dedicated test harness with identity assertions and cleanup, and confirmation of a unique empty loopback-only tmpfs database. Keep `ncc_local_dev`, `ncc_postgres_db`, and `ncc_pgdata` out of this workflow; keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled.

**Final recommendation: NO-GO today.** No command in this report was executed.
