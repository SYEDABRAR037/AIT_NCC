# BSR-05 PostgreSQL Challenge Store — Implementation Readiness

**Review type:** Read-only implementation preparation
**Recommendation:** **NO-GO for implementation and migration at this time**
**Scope:** Shared challenge persistence for a future biometric prototype. This report does not authorize a schema change, migration, database connection, feature activation, or attendance integration.

## Executive summary

The current challenge store is process-local: a restart loses challenges, and separate backend processes do not share consumption state or quotas. A PostgreSQL store can address persistence and multi-instance single-use semantics, but it is not safe to implement yet. The current attendance workflow is staff-operated roster-wide matching (1:N), while the BSR-05 design assumes authenticated-cadet 1:1 verification. The current manual attendance, biometric marking, and session finalization paths also do not follow one shared session-row lock protocol. Authentication-session revocation can race with a request already past middleware. Cross-instance quotas and rate limits have not been specified beyond process-local limits.

No database was contacted and no database, container, migration, test, environment file, source code, schema, or feature flag was changed for this report. The commands later in this document are a proposed future runbook only; they were not executed.

## 1. Findings and prerequisite status

| Prerequisite | Evidence from current implementation/design | Status |
|---|---|---|
| Subject-bound 1:1 verification | Existing attendance verification iterates an eligible roster and is 1:N. The later BSR-05 implementation plan calls for self-serve 1:1 verification with the authenticated cadet as subject. | **BLOCKER** — choose and implement the 1:1 contract before persistence work. Do not adapt the shared store to the current 1:N route. |
| Cross-instance quotas/rate limits | `verificationChallengeStore.ts` keeps per-operator and global counters in a process-local `Map` (10 per operator; 10,000 global in the reviewed code). These are neither shared nor robust against concurrent issuance. Per-subject, per-operator, per-session and global rate windows/thresholds are not finalized. | **BLOCKER** — approve quota dimensions, windows, limits, retention and overload response. |
| Consistent lock ordering | Manual marking, bulk import, biometric writes and session finalization do not share a common row-lock protocol. Session finalization reconciles attendance before closing the session. | **BLOCKER** — refactor all applicable writers to a documented common lock order and prove it with PostgreSQL race tests. |
| Durable auth-session validation | Middleware checks `sid` against a live `AuthSession` at request entry. Revocation may occur after that check and before challenge consumption/attendance commit. | **BLOCKER** — define and implement a final transactional session-validity check coordinated with logout. Existing `AuthSession` has no composite unique key for `(id,userId)`; the proposed FK needs one. |
| Database identity verification | Existing database-safety guard checks connection-string characteristics and explicit confirmation; it does not prove the connected server/container is disposable or empty. No existing database can be used for this task. | **BLOCKER** — use a new disposable local target, verify its identity and emptiness before any future operation, and fail closed on mismatch. |
| Expiration/cleanup races | In-memory store uses application time. The independent review found that PostgreSQL expiry must be evaluated once after locking the challenge; cleanup must not race consumption. | **BLOCKER** — implement lock-then-single-database-time semantics and bounded cleanup only after design approval. |
| Existing process-local store compatibility | Memory state disappears on restart and is private to each instance. Silent mixed operation would permit challenge creation in one store and consumption in another. | **BLOCKER** — perform a coordinated cutover; no dual-read/write or fallback to memory. Existing in-flight challenges become invalid and require a new login/verification attempt. |
| Provider/feature boundary | Provider startup trust work keeps mock selection constrained; biometric attendance remains disabled and the provider is not wired into attendance. | **PASS as a guardrail** — preserve this state; no provider integration is part of BSR-05. |

### Additional implementation risks

- Challenge issuance currently lacks sufficiently defined cross-instance issuance limits and route-level throttling; store persistence alone does not prevent denial of service.
- Consumption must bind the challenge to actor, subject cadet, attendance session, purpose, and durable authentication session, then revalidate current eligibility and open-session status before attendance commit.
- A database timeout during commit can leave the caller uncertain whether a challenge was consumed. The API must return a sanitized retryable/unavailable response and must never retry via the memory store. A client may have to request a fresh challenge.
- Storing only a digest limits exposure after a table read, but does not protect against a compromised application process while the raw token is in memory.
- PostgreSQL constraints can validate row-local shape and foreign-key ownership; they cannot by themselves prove that a session is open at the exact attendance commit, that the current consent is not revoked, or that related event history is semantically valid. These require transactional service logic and, where required, triggers/locking after schema review.

## 2. Conditional schema proposal (not approved or applied)

The following is the minimum additive shape suggested by the reviewed design. It is not a ready-to-apply Prisma diff: relation names, deployed Prisma version, generated SQL, and institutional retention/rate decisions must be confirmed first.

### Proposed Prisma-level additions

```prisma
enum VerificationChallengePurpose {
  ATTENDANCE_1_TO_1
}

model VerificationChallenge {
  id                    String   @id @default(cuid())
  tokenHash             String   @unique @db.VarChar(64)
  actorUserId           String
  subjectCadetId        String
  trainingSessionId     String
  authSessionId         String
  purpose               VerificationChallengePurpose
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  expiresAt             DateTime @db.Timestamptz(3)
  consumedAt            DateTime? @db.Timestamptz(3)

  actor                  User            @relation("ChallengeActor", fields: [actorUserId], references: [id], onDelete: Restrict)
  subject                User            @relation("ChallengeSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  trainingSession        TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Restrict)
  authSession            AuthSession     @relation(fields: [authSessionId, actorUserId], references: [id, userId], onDelete: Restrict)

  @@index([actorUserId, createdAt])
  @@index([subjectCadetId, createdAt])
  @@index([trainingSessionId, createdAt])
  @@index([authSessionId, createdAt])
  @@index([expiresAt])
  @@index([consumedAt, expiresAt])
}
```

Required back-relations would be added to `User`, `TrainingSession`, and `AuthSession`. `AuthSession` would need `@@unique([id, userId])` so the composite relation can ensure that the challenge's durable session belongs to its actor. Validate whether Prisma permits the redundant compound unique alongside the existing `id` primary key in the repository's Prisma version. The migration may require hand-authored SQL for checks and partial indexes.

### Required SQL-level integrity

- `tokenHash` must match exactly 64 lowercase hexadecimal characters (SHA-256 digest encoding).
- `expiresAt > createdAt`, with a maximum lifetime of 30 seconds enforced by the database as well as service validation. Confirm that this limit remains the approved product requirement.
- `consumedAt IS NULL OR (consumedAt >= createdAt AND consumedAt < expiresAt)`.
- For the initial self-service design, enforce `actorUserId = subjectCadetId` (or remove the redundant actor field if actor and subject are intentionally always identical). Keep the field only if the design needs independent operator and subject identities later.
- Composite FK `(authSessionId, actorUserId)` → `AuthSession(id,userId)`; this requires a unique referenced pair.
- Restrictive deletion behavior while audit/retention policy is unresolved. Explicitly define account deletion/anonymization later; do not cascade away evidence implicitly.
- Unique digest constraint prevents digest collisions/duplicate challenge rows. Add a unique idempotency key only if an approved issuance idempotency contract is adopted.
- Indexes for bounded expiry cleanup and the approved quota queries. A partial index for unconsumed challenges may require raw SQL (e.g. `WHERE consumed_at IS NULL`); Prisma schema support must be checked against the pinned version.

Ordinary constraints cannot enforce “session remains open at commit”, “authentication session was not revoked concurrently”, or “current biometric consent remains valid” without coordinated locking/transaction logic. A trigger is not a substitute for establishing a consistent lock order across every attendance writer.

## 3. Token and transaction protocol

### Token generation

1. Generate 32 bytes using Node.js `crypto.randomBytes(32)`.
2. Encode as 64-character hex for transport; return the raw token once over the authenticated TLS API response.
3. Persist only `SHA-256(rawToken)` as lowercase hex; never log raw token or digest.
4. Bind immutable row fields to authenticated actor/user, the same subject cadet, attendance session, purpose, and `AuthSession` id. Do not accept provider identity, actor id, creation time, or expiry from the client.
5. The server sets creation/expiry; issue lifetime is short (30 seconds proposed, subject to final design sign-off).

### Issuance transaction (proposed)

1. Validate authenticated durable session and self-service 1:1 eligibility. Reject if biometric attendance is disabled; this design is not permission to turn it on.
2. Begin transaction. Acquire a namespaced global quota advisory lock, then lock the actor/subject `User` row, `TrainingSession` row, and `AuthSession` row in the agreed order. Re-check account/session status and authorization under lock.
3. Evaluate database time once. Count current/unexpired challenges across the approved quota window and dimensions. Reject with a sanitized 429 when quota is reached.
4. Insert the digest and bindings with expiry computed by the database or from the one captured database timestamp. Commit before returning raw token.
5. On any failure, roll back and return controlled 503/500 by error class; never emit a token unless the row commit is known successful. For ambiguous commit outcome, return unavailable and require a new request; do not fall back to memory.

### Consumption transaction (proposed)

1. Hash supplied token; begin transaction. Lock `TrainingSession`, then `AuthSession`, then the exact challenge row, using one globally documented order also followed by every competing attendance/logout/finalization path.
2. Capture one database timestamp after locks are obtained. Validate digest lookup, unconsumed state, `createdAt <= now < expiresAt`, actor and subject, purpose, attendance-session id, and exact auth-session id. Re-check durable auth-session not revoked/expired and attendance session still open and in scope.
3. Atomically set `consumedAt = capturedNow` using a conditional update (`consumedAt IS NULL AND expiresAt > capturedNow`) and assert exactly one row changed. A zero-row result is a conflict/invalid challenge; do not report success.
4. Perform authorized attendance write and durable audit in the same transaction if this challenge is eventually integrated with attendance. Any attendance/audit failure rolls back both the attendance write and challenge consumption. If policy instead requires challenge consumption to persist on a rejected match, specify that separately; never accidentally burn it on a wrong-context request.
5. Commit, then return only the minimum typed outcome. On DB unavailable, fail closed with sanitized service-unavailable response. No process-local fallback.

**Lock-order prerequisite:** the current paths do not satisfy this proposal. A single order must be selected and applied consistently across logout, session finalization, biometric attendance, manual attendance correction/import, and challenge issuance/consumption. The sequence above is a design proposal, not an assertion about current code.

## 4. Quotas, expiry and cleanup

- Replace process-local counts with cross-instance enforcement. Proposed lock order begins with a stable, namespaced global advisory lock followed by a user row lock. Verify collision-resistant lock-key derivation and document lock scope. A global lock can serialize all issuance and become a throughput bottleneck; sharded locks or a quota-counter table would need separate design and tests.
- Keep current observed caps of 10 per operator and 10,000 global only as compatibility references, not approved effective limits. Decide per-user/per-subject, per-operator, per-session, global burst/window, and sustained limits before coding.
- Define whether quotas count pending unexpired rows, all issuance attempts, or both. Security rate limits should account for failed attempts without retaining raw tokens; use explicit counters/window state or an approved audit mechanism.
- Cleanup is bounded and asynchronous. Select expired/old consumed rows with `FOR UPDATE SKIP LOCKED`, lock each row, capture DB time once, and delete only after approved retention. Consumption and cleanup race safely because both lock the same row; cleanup never deletes an unexpired challenge.
- Keep consumed challenges long enough to satisfy replay/audit requirements only if approved; a consumed row can instead be retained as a minimal tombstone. Retention and deletion periods are unresolved institutional decisions.
- Cleanup failure must not make an expired challenge usable; consumption checks expiry independently. Alert/monitor cleanup lag without logging token material.

## 5. Migration and compatibility plan (future, approval required)

1. Finalize self-service 1:1 request/response contract, authorization scope, rate-limit policy, lock ordering, retention, error mapping, and rollback semantics.
2. Add the model, relations, indexes, check constraints, and any required unique key in a reviewed Prisma schema change. Generate a create-only migration for SQL review; do not apply until separately authorized.
3. Validate the migration on a newly provisioned disposable PostgreSQL database only. Verify the live identity, role, server version, schema emptiness, guard variables, and container label before schema creation or migration.
4. Implement store and service logic with no mixed-store fallback. Deploy/cut over only in a controlled non-production environment in a separately authorized phase. At cutover, invalidate process-local outstanding challenges; users request new challenges.
5. Rollback before application cutover: drop only the new table/index/constraints and remove corresponding schema additions, but only on the disposable test target or under separately approved operations. Never automatically drop production data. After rows exist, rollback requires explicit export/retention decision; do not silently discard challenge audit state.
6. If PostgreSQL store is unavailable, all challenge issue/consume operations fail closed. There is no in-memory fallback, because that would reintroduce cross-instance replay and split-brain behavior.

## 6. Integration test design (not executed)

Run these only after a new disposable PostgreSQL target is separately approved and identity-verified. Use two independent Prisma clients/processes (and, for multi-instance tests, two backend instances) sharing only that disposable database. Each test uses unique fixtures and cleans only its own rows; a failed cleanup invalidates the run and requires destroying the disposable target, not touching another database.

| ID | Scenario | Required assertion |
|---|---|---|
| C01 | Two consumers submit one token concurrently from separate clients | Exactly one conditional consume wins; loser receives conflict; at most one attendance result. |
| C02 | Replay after successful consume | Rejected; no second write or success response. |
| C03 | Different authenticated user submits token | Rejected without disclosing subject/roster details; token remains usable only by intended binding if policy allows wrong-context attempt. |
| C04 | Wrong cadet subject | Rejected; no attendance mutation. |
| C05 | Wrong attendance session or purpose | Rejected; no cross-session use. |
| C06 | Auth session revoked before consume | Rejected. |
| C07 | Auth session revocation races with consume | Outcome follows the chosen shared lock order; no success after a completed revocation. |
| C08 | Attendance session finalized before consume | Rejected. |
| C09 | Session finalization races with consume | Exactly one serializable order; closed session cannot accept a late write. |
| C10 | Challenge expires while consumer waits for row lock | Expired after lock acquisition is rejected using one post-lock DB timestamp. |
| C11 | Cleanup races with valid consumption | Valid unexpired challenge is not deleted; exactly one operation proceeds safely. |
| C12 | Cleanup races with expired consumption | Challenge cannot be consumed; cleanup may delete only after expiry and retention eligibility. |
| C13 | Two issuance requests race at per-subject quota boundary | Aggregate count never exceeds the configured cap. |
| C14 | Two issuance requests race at per-operator quota boundary | Aggregate count never exceeds the configured cap. |
| C15 | Multiple workers race at global quota boundary | Aggregate count never exceeds configured global cap. |
| C16 | Repeated challenge issuance burst | Rate limit returns sanitized 429; no excess rows. |
| C17 | Backend restart between issue and consume | Challenge remains consumable until expiry through shared store. |
| C18 | Two backend instances share challenge | One-time semantics and quotas are shared. |
| C19 | Database unavailable during issuance | No challenge/token success; sanitized unavailable response; no memory fallback. |
| C20 | Database unavailable during consume | No attendance success; no memory fallback; retry semantics documented for uncertain commit. |
| C21 | Injected transaction failure after consume update | Entire transaction rolls back; challenge and attendance state consistent. |
| C22 | Injected audit failure in attendance transaction | Challenge consumption and attendance write roll back if audit is transaction-critical. |
| C23 | Malformed digest/TTL constraints | Database rejects malformed digest and excessive/negative lifetime. |
| C24 | Expiry cleanup batch contention | `SKIP LOCKED` bounds contention; cleanup never removes active challenge. |
| C25 | Manual correction/import concurrent with finalization | Shared lock protocol yields deterministic conflict/closed-session result and preserves permitted correction rules. |
| C26 | Existing process-local challenge during cutover | Old challenge is rejected; no silent fallback; client can request fresh challenge. |
| C27 | AuthSession id belongs to another user | Composite FK/transaction validation rejects insertion/consumption. |
| C28 | Constraint and relation deletion behavior | Restrictive FK prevents unintended erasure while retention policy unresolved. |

### Test controls

- Never use `ncc_local_dev`, production, protected databases, or any existing configured URL.
- No real cadet biometric data: synthetic fixtures only, with mock provider outcomes unable to authorize real attendance.
- Assert feature remains disabled and provider is not wired to attendance.
- Do not bypass quotas or rate limits. Test boundary behavior using isolated fixtures/configuration in the disposable target.
- Use bounded connection/query/lock timeouts; test timeout and pool exhaustion explicitly.

## 7. Disposable PostgreSQL runbook (prepared, not executed)

These example commands adapt the existing PostgreSQL readiness plan. They assume Docker and `psql` are already installed; do not install anything as part of this task. Use a dedicated image already present locally, a new loopback-only port, a tmpfs data directory, a conspicuous label, and generated credentials. If any command output or identity check differs from the expected values, stop and remove only the newly created labeled disposable container.

### Setup and identity check

```sh
cd "$HOME/Desktop/NCC Web & App/backend"

# Confirm no existing database configuration is inherited into this shell.
env | cut -d= -f1 | rg '^(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|TEST_DATABASE_URL)$' && {
  echo "STOP: database URL variables already exist in this shell" >&2
  return 1 2>/dev/null || exit 1
}

# Inspect only local Docker state; select an already-present PostgreSQL image by digest.
docker image ls --digests postgres
docker ps --filter label=ait.ncc.purpose=bsr05-disposable

# Check that the chosen loopback port is unused before container creation.
lsof -nP -iTCP:55439 -sTCP:LISTEN
```

The `lsof` command must produce no listener. Set `PG_IMAGE` to an exact locally present digest, not a mutable tag; confirm it with `docker image inspect`. Then create a private temporary env file and launch the disposable target:

```sh
umask 077
BSR05_TMP="$(mktemp -d "${TMPDIR:-/tmp}/ait-ncc-bsr05.XXXXXX")"
BSR05_ENV="$BSR05_TMP/postgres.env"
BSR05_PASSWORD="$(openssl rand -hex 32)"
printf 'POSTGRES_DB=ait_ncc_bsr05_test\nPOSTGRES_USER=bsr05_test\nPOSTGRES_PASSWORD=%s\n' "$BSR05_PASSWORD" > "$BSR05_ENV"
chmod 600 "$BSR05_ENV"

# Set PG_IMAGE only to the exact locally cached image digest verified above.
docker run --rm --detach --pull=never \
  --name ait-ncc-bsr05-disposable \
  --label ait.ncc.purpose=bsr05-disposable \
  --label ait.ncc.owner=local-test \
  --env-file "$BSR05_ENV" \
  --publish 127.0.0.1:55439:5432 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  "$PG_IMAGE"

export PGPASSWORD="$BSR05_PASSWORD"
export BSR05_TEST_DATABASE_URL="postgresql://bsr05_test:${BSR05_PASSWORD}@127.0.0.1:55439/ait_ncc_bsr05_test?schema=public&connection_limit=5&connect_timeout=3"
```

Before Prisma or application code is allowed to connect, independently verify container label, DB identity, role, server version, and that `public` is empty. Do not print the connection URL/password:

```sh
docker inspect --format '{{ index .Config.Labels "ait.ncc.purpose" }}' ait-ncc-bsr05-disposable
psql "$BSR05_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT current_database(), current_user, inet_server_addr(), version();"
psql "$BSR05_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

Expected: label is `bsr05-disposable`, database is `ait_ncc_bsr05_test`, role is `bsr05_test`, endpoint is loopback, and public table count is zero. If the container is not ready, identity is unexpected, schema is non-empty, or any configured URL points elsewhere: stop. Do not point this runbook at any pre-existing database. Set the repository's required disposable-test confirmation variable only after these checks, using the exact variable/value documented in `backend/src/databaseSafety.ts`; never reuse a development confirmation. The application guard must validate the BSR05 URL before the dedicated integration test can run.

### Migration and test commands (future only)

First confirm the migration plan and repository scripts against current package files. The expected sequence is:

```sh
cd "$HOME/Desktop/NCC Web & App/backend"
DATABASE_URL="$BSR05_TEST_DATABASE_URL" npx prisma validate
DATABASE_URL="$BSR05_TEST_DATABASE_URL" npx prisma migrate dev --create-only --name bsr05_verification_challenge
# Review generated SQL, add/verify checks and partial indexes, then separately approve application:
DATABASE_URL="$BSR05_TEST_DATABASE_URL" npx prisma migrate deploy
# Run only the dedicated PostgreSQL integration suite, configured to reject every URL
# except the verified ait_ncc_bsr05_test target:
DATABASE_URL="$BSR05_TEST_DATABASE_URL" npm run test:biometric-challenge:postgres
```

These are examples, not verified package scripts or authorization to execute. Do not run `migrate dev` against any existing configured URL. Do not use `db push`, `migrate reset`, or any command that can target another database. The integration runner must assert the exact DB name/host/role and test label/guard before opening Prisma clients.

### Cleanup / teardown (future only)

Only stop the exact container whose label and name were created above. The `--rm` option removes its ephemeral container on stop; tmpfs data is discarded. Delete only the uniquely generated temporary directory after confirming its path begins with the expected `ait-ncc-bsr05.` prefix.

```sh
test "$(docker inspect --format '{{ index .Config.Labels "ait.ncc.purpose" }}' ait-ncc-bsr05-disposable)" = "bsr05-disposable"
docker stop ait-ncc-bsr05-disposable
case "$BSR05_TMP" in
  "${TMPDIR:-/tmp}"/ait-ncc-bsr05.*) rm -rf -- "$BSR05_TMP" ;;
  *) echo "STOP: unexpected temporary path; do not remove" >&2; exit 1 ;;
esac
unset PGPASSWORD BSR05_TEST_DATABASE_URL BSR05_PASSWORD BSR05_ENV BSR05_TMP PG_IMAGE
```

Do not use broad `docker prune`, volume deletion, database reset, or cleanup commands. Recovery is intentionally simple: because the target is a labeled, ephemeral, tmpfs-only container, stop only that target and discard it. There is no backup/restore of an existing database because the disposable database must contain only test fixtures.

## 8. Exact blockers and next action

### Decision: NO-GO

Do not implement or migrate the PostgreSQL store until all of these are resolved:

1. Approve a self-service, authenticated subject-bound **1:1** challenge contract; explicitly keep it separate from the existing staff roster 1:N flow.
2. Define and review shared quota/rate-limit dimensions, windows, thresholds, retention and overload/error responses.
3. Choose one lock order and apply it consistently to logout/session revocation, session finalization, biometric writes, manual attendance corrections/imports, issuance and consumption.
4. Define how durable session validity and training-session openness are rechecked through the final transaction commit.
5. Approve the exact DB constraints, cleanup retention, and behavior for consumed/replayed challenges.
6. Verify the disposable test guard’s required confirmation contract and implement a dedicated test runner that cannot accept any other URL.
7. Obtain separate approval for schema/migration work after design sign-off; this task does not provide that approval.

**Exact next action:** update and reconcile `BIOMETRIC_BSR05_FINAL_DESIGN.md` with the independent review findings—first locking the 1:1 subject contract, cross-instance quota model, common lock ordering, auth/session race semantics, cleanup retention and DB error policy. Then request design review. Only after that review should a separate task prepare an exact schema diff and migration for disposable-database approval.

## Verification performed for this report

- Read the listed design/readiness/security/progress documents and inspected the existing challenge store, attendance/authentication flow, Prisma relations and database-safety guard.
- No tests or TypeScript checks were run: this task is design/readiness only, and no database integration environment was provisioned.
- No database connection, database command, migration, container creation, package installation, application source/schema/feature-flag modification, commit, push, or deployment was performed.
- The report passed an untracked-file whitespace check; existing unrelated working-tree changes remain untouched.
