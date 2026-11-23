# AIT NCC — BSR-05 Final Technical Design

**Status:** Design proposal only  
**Date:** 2026-11-22  
**Scope:** Shared PostgreSQL storage for attendance-verification challenges  
**Not performed:** No application/schema edits, migration generation, database connection, container creation, test execution, or feature-flag change.

## Decision summary

Replace the process-local challenge map with a PostgreSQL-backed, short-lived, single-use challenge table after schema/migration approval. Retain the existing opaque challenge-token API and 30-second lifetime initially. Store only a SHA-256 digest of a 256-bit CSPRNG token. Consume by a conditional database update inside a short transaction that locks and validates the durable auth session first. Commit consumption before biometric comparison. All backend instances share this store; database errors fail closed with a controlled service-unavailable response and manual attendance remains available.

This design does not establish liveness, descriptor authenticity, consent, or model validity. It does not authorize enabling biometric attendance.

## 1. Current behavior and compatibility boundary

`backend/src/services/verificationChallengeStore.ts` currently creates a 32-byte random token rendered as 64 hex characters. It stores only the SHA-256 digest as a key in a per-process `Map`, binds the challenge to `sessionId`, authenticated `userId`, and `authSessionId`, applies a 30-second TTL and in-process pending limits, and synchronously removes a challenge when it is consumed. The map is not shared across workers and is cleared on process restart.

The attendance flow is roster-wide matching: the request is bound to an attendance session and operator, and the server later selects only session-eligible cadets. The cadet being matched is not known when the challenge is issued. Therefore the proposed challenge binds to the operator/user, durable auth session, and training session. It must not accept a client-supplied cadet ID as authority. If a later API changes to one-to-one cadet verification, a subject-cadet binding must be added and enforced before that API is enabled.

## 2. Proposed Prisma model and PostgreSQL structure

Illustrative Prisma proposal (names may be adjusted during schema review; this is not a schema edit):

```prisma
model BiometricVerificationChallenge {
  id                String   @id @default(uuid())
  tokenHash         String   @unique(map: "BiometricVerificationChallenge_tokenHash_key") @db.Char(64)
  trainingSessionId String
  operatorUserId    String
  authSessionId     String
  createdAt         DateTime @default(now()) @db.Timestamptz(3)
  expiresAt         DateTime @db.Timestamptz(3)
  consumedAt        DateTime? @db.Timestamptz(3)

  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
  authSession     AuthSession     @relation("VerificationChallengeAuthSession", fields: [authSessionId, operatorUserId], references: [id, userId], onDelete: Cascade)

  @@index([expiresAt], map: "BiometricVerificationChallenge_expiresAt_idx")
  @@index([operatorUserId, consumedAt, expiresAt], map: "BiometricVerificationChallenge_operator_pending_idx")
  @@index([trainingSessionId, expiresAt], map: "BiometricVerificationChallenge_session_expiry_idx")
}
```

Required back-relations and referenced uniqueness:

```prisma
// AuthSession
verificationChallenges BiometricVerificationChallenge[] @relation("VerificationChallengeAuthSession")
@@unique([id, userId], map: "AuthSession_id_userId_key")

// TrainingSession
verificationChallenges BiometricVerificationChallenge[]
```

The composite auth-session relation prevents a challenge row from pairing an operator with another user's `AuthSession`. `operatorUserId` is the authenticated user identity and is related to `User` through `AuthSession.user`; this avoids declaring overlapping Prisma relation scalar fields. The composite unique on `(id,userId)` is redundant with `id` uniqueness for lookup, but PostgreSQL requires a unique referenced tuple for that composite FK and Prisma needs the corresponding unique criterion. Relation names must be checked against the complete current schema before implementation. Prisma's relation rules require the referenced field tuple to be unique and the `fields`/`references` lists to match in order; validate the final schema with the repository's Prisma version before generating a migration ([Prisma ORM v6 relations](https://www.prisma.io/docs/orm/v6/prisma-schema/data-model/relations)).

### SQL-level table and invariant sketch

Expected PostgreSQL structure:

```sql
CREATE TABLE "BiometricVerificationChallenge" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "trainingSessionId" TEXT NOT NULL REFERENCES "TrainingSession"("id") ON DELETE CASCADE,
  "operatorUserId" TEXT NOT NULL,
  "authSessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "BiometricVerificationChallenge_auth_owner_fkey"
    FOREIGN KEY ("authSessionId", "operatorUserId")
    REFERENCES "AuthSession"("id", "userId") ON DELETE CASCADE,
  CONSTRAINT "BiometricVerificationChallenge_valid_expiry_check"
    CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "BiometricVerificationChallenge_valid_consumed_check"
    CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt")
);
```

The actual Prisma migration will likely use Prisma's configured `TEXT` IDs and migration-generated defaults; the sketch shows invariants, not exact generated SQL. Table/FK names, identifier type and delete actions must match Prisma and existing conventions. Do not add biometric-consent columns or models as part of BSR-05.

### Indexes and uniqueness

- Unique `tokenHash`: one challenge row per digest and efficient exact lookup.
- Index `expiresAt`: bounded expiry cleanup.
- Index `(operatorUserId, consumedAt, expiresAt)`: pending challenge count for an operator.
- Index `(trainingSessionId, expiresAt)`: session-scoped cleanup/diagnostics.
- Composite `AuthSession(id,userId)` unique target for owner-binding FK.
- PostgreSQL `CHECK` constraints for expiry ordering and consumed timestamp ordering.
- No partial unique index is needed for single consumption: a conditional row update is the atomic claim. A partial pending index may be considered after measuring actual query plans; it is not a correctness constraint.

Prisma may not express all check constraints or partial-index forms in the project's selected Prisma version. Put any unsupported constraints in a reviewed SQL migration and ensure schema drift checks account for them. Do not depend on service validation alone for referential owner-binding.

## 3. Token generation and digest handling

1. Generate 32 bytes with Node `crypto.randomBytes(32)`; preserve the current external token encoding (64 lowercase hex characters) to avoid client contract changes.
2. Compute `SHA-256(token)` and persist the 64-character hex digest in `tokenHash`. A domain prefix such as `ncc:biometric-challenge:v1:` may be included in the hash input if documented consistently; the raw token must never be persisted or logged.
3. Return the raw token only in the existing challenge response. Do not put it in audit details, URLs, exception strings or telemetry.
4. Validate token format and maximum length before hashing to bound request work. A malformed token receives the same invalid-challenge response as an unknown token.
5. A unique collision is cryptographically negligible; if it occurs, generate a fresh token and retry insert a small bounded number of times. Do not return collision or database detail to the client.

## 4. Binding, eligibility and issuance

The stored identity tuple is `(trainingSessionId, operatorUserId, authSessionId)`:

- `operatorUserId` is sourced from verified request authentication (`req.user.id`), never from the request body.
- `authSessionId` is sourced from the authenticated middleware (`req.authSessionId`), and must match `(AuthSession.id, AuthSession.userId)`.
- `trainingSessionId` is validated from the route/request against an existing active attendance session and the operator's role/assignment scope.
- At issue and consume time, recheck that the durable auth session is not revoked and not expired, and that the attendance session is active. Eligibility must be checked again before matching and again at attendance persistence; challenge binding alone cannot make a stale role, assignment, roster or closed session valid.
- No client-supplied cadet identity is bound in the existing roster-wide flow. Server-side matching must continue filtering eligible candidates before descriptor comparison and must not reveal out-of-scope candidates.

Issue transaction:

1. Begin a short PostgreSQL transaction at `READ COMMITTED`.
2. Lock the operator's `User` row `FOR UPDATE` to serialize pending-quota checks for that operator across app instances. Then lock/read the `AuthSession` row; keep this lock order consistent in challenge code. Verify owner, unrevoked state and expiry using database time.
3. Confirm the target `TrainingSession` exists, is active, and operator authorization/scope succeeds.
4. Count rows where `operatorUserId` matches, `consumedAt IS NULL`, and `expiresAt > clock_timestamp()`. Enforce the existing pending-per-operator limit (currently 10) inside the serialized transaction. A separately approved global quota, if required, needs its own shared serialization strategy.
5. Generate token/digest and insert with `createdAt=clock_timestamp()` and `expiresAt=clock_timestamp()+30 seconds` initially, preserving the current TTL. Use a database-side time expression or bind one server-selected time only after transaction lock acquisition; avoid comparing expiry using unsynchronized app-instance clocks.
6. Commit, then return the raw token and expiry. If insert/commit fails, return no token and make no local-store fallback.

Use row locking rather than a process-local counter. A transaction-scoped advisory lock is an alternative, but requires raw SQL and a collision-resistant lock-key scheme; the user-row lock is simpler and ties quota serialization to the authenticated principal. Keep each issuance transaction short.

## 5. Atomic single-use consumption and multi-instance races

### Lock order and transaction

Challenge consumption must serialize with durable-session revocation. Use this fixed order:

1. Begin transaction at `READ COMMITTED`.
2. Lock the matching `AuthSession` row by both `id` and `userId` using `SELECT ... FOR UPDATE`.
3. After acquiring the lock, check `revokedAt IS NULL` and `expiresAt > clock_timestamp()`. This prevents a revocation race from relying on a stale pre-lock snapshot. Logout/revocation updates the same row; whichever obtains the lock first determines the ordering.
4. Recheck the target training session is active (lock/read it consistently if session closure must serialize with the consume operation).
5. Atomically claim the challenge with one conditional update:

```sql
UPDATE "BiometricVerificationChallenge"
SET "consumedAt" = clock_timestamp()
WHERE "tokenHash" = $1
  AND "trainingSessionId" = $2
  AND "operatorUserId" = $3
  AND "authSessionId" = $4
  AND "consumedAt" IS NULL
  AND "expiresAt" > clock_timestamp()
RETURNING "id", "createdAt", "expiresAt", "consumedAt";
```

6. Exactly one affected row means this request owns the challenge. Zero rows means missing, mismatched, already consumed, expired or otherwise invalid. Return a generic invalid response across wrong-owner/missing/replayed cases. If preserving a distinct `CHALLENGE_EXPIRED` response is required, only distinguish expiry after an exact token + full binding match; never disclose whether another user's token exists.
7. Commit the transaction **before** descriptor matching/inference. The challenge is burned even if matching, later eligibility checks, or attendance persistence fails. The user must request a new challenge.

The conditional update is the single-use correctness point. If two backend instances execute it simultaneously, PostgreSQL row locking serializes their updates: one sets `consumedAt`; the other re-evaluates the predicate and affects zero rows. No process affinity or sticky routing is needed. The auth-session row lock serializes consumption against logout/revocation; the challenge row update serializes competing consumers.

Do not hold the transaction open during image processing, descriptor comparison, network calls, notification dispatch, or other slow work. The attendance write must still have its own atomic duplicate claim and audit transaction. If the attendance write loses a race after challenge consumption, return conflict and require a new challenge for another scan.

## 6. Expiration, cleanup and retention

- Preserve current 30-second challenge lifetime for initial compatibility; use PostgreSQL `clock_timestamp()` for creation/expiry and consumption checks. Any TTL extension/reduction is a separate security and operational decision.
- Expiry is logical first: every consume and pending count checks `expiresAt > clock_timestamp()`. A delayed cleanup job must never make an expired challenge usable.
- Run bounded cleanup for consumed or expired rows, using batches with `FOR UPDATE SKIP LOCKED` so several backend workers can safely perform cleanup. It is acceptable for every instance to run a low-frequency cleanup loop if each batch is bounded and indexed; alternatively use a single existing maintenance scheduler. Do not introduce a paid service.
- Determine consumed/expired-row retention before implementation. Minimal option: delete consumed/expired challenge metadata promptly in bounded batches because no challenge audit history is required for attendance accountability; longer diagnostic retention requires an approved period and must still exclude raw tokens. Do not invent an institutional retention period.
- Cleanup failures are observable through sanitized operational logging/metrics and retried later; cleanup failure does not relax expiry checks or affect attendance/manual attendance.

## 7. Replay and cross-user isolation

- Raw token is high entropy, returned once, stored only as a digest, and bound in SQL to session, operator and durable auth session.
- Database composite FK prevents pairing `operatorUserId` with another user's auth-session ID.
- Request JWT subject (`userId`) must equal `operatorUserId`, and middleware session ID must equal stored `authSessionId`.
- `consumedAt IS NULL` conditional update makes same-token replay and same-token concurrency fail across all instances.
- A challenge from one attendance session cannot be consumed in another because `trainingSessionId` is part of both the conditional update and binding check.
- A challenge from a revoked/expired auth session cannot be consumed because the session row is locked and checked inside the consume transaction.
- Do not treat a challenge as liveness, proof of image freshness, trusted capture, or authorization to use a cadet's template. Existing `CLIENT_UNATTESTED` behavior remains fail-closed.

## 8. Failure and database-unavailability behavior

- Issue/consume DB unavailable, timeout, serialization exhaustion or migration mismatch: fail closed with a generic `503`/service-unavailable response; do not issue or accept an in-memory fallback token.
- If a transaction fails before commit, no challenge is issued/consumed. If the consume commit succeeds but response delivery fails, the token remains consumed and the client obtains a new one.
- A lost/uncertain commit result must be treated as consumed/unknown; never re-accept the token on retry. A client retry may receive invalid/replayed and request a replacement challenge.
- Database/Prisma/constraint detail, token hash, raw token, auth token and personal data must not be sent in API responses. Use sanitized error codes and operational logs without secrets.
- Challenge-store outage affects biometric challenge flow only. Ordinary login, portal access and manual attendance remain available; there is no requirement to fail manual attendance when this store is down.
- Rate limits remain in force. Pending quota is database-serialized; broader per-IP or global throttles remain a separate control and must not rely on the challenge table count alone.

## 9. Migration, rollback and process-local compatibility

### Forward sequence

1. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled.
2. Approve model, indexes, SQL constraints, retention/cleanup and test isolation plan. Add the table/relation migration additively; do not alter/delete attendance or biometric template rows.
3. Apply and validate the migration on a newly verified disposable PostgreSQL instance only. No `ncc_local_dev` use is part of this design.
4. Deploy code that can use the PostgreSQL store, while the biometric feature remains disabled. Verify database connectivity and store behavior only through isolated tests.
5. At cutover, stop issuing process-local challenges and wait at least the current 30-second TTL (plus a conservative deployment/clock grace window) before relying exclusively on persisted challenges. Pending local challenges are not migrated; users repeat challenge issuance. No dual-store fallback is used.
6. Keep the public challenge response shape stable (`challengeToken`, `expiresAt`, `ttlSeconds`). API code must not reveal whether a challenge was stored in memory or PostgreSQL.

### Rollback

- Stop challenge issuance/use first. Ensure no new backend instance is using the PostgreSQL model.
- Treat all PostgreSQL-issued tokens as invalid after rollback; do not fall back to a legacy local map to consume them. Users request a new challenge after the compatible code is restored.
- The migration is additive. Prefer leaving the now-unused table in place during code rollback; this avoids destructive rollback and preserves safe forward recovery.
- If table removal is later required, wait for all token TTLs to lapse, verify no application process uses it, take an authorized disposable-only backup if required, and run a separately reviewed down migration only on the intended database. Dropping the table is destructive to ephemeral challenge metadata; Prisma has no automatic rollback for `migrate deploy`.
- Do not roll back/drop table on a shared or production database under this design. Do not edit migration history manually to force rollback.

### Mixed-version compatibility

Old instances know only their local maps; new instances know PostgreSQL. During rolling deployment, an old instance cannot consume a token issued only in PostgreSQL. Avoid mixed behavior by keeping the feature disabled and completing deployment before any challenge use. If a future live rollout cannot guarantee that, require a controlled drain/maintenance window or an explicit versioned transition protocol; do not silently accept either store opportunistically.

## 10. Unit and PostgreSQL integration test plan

### Unit tests (mocked; no DB)

1. Token is 32 random bytes in current hex representation; only its digest reaches persistence abstraction/logs.
2. Token format/length validation rejects malformed oversized values before DB calls.
3. Issue binds authenticated operator, auth session and attendance session; rejects client-supplied ownership values.
4. AuthSession owner mismatch, missing/revoked/expired auth session and closed session reject issuance.
5. Pending quota under issuance lock; at limit returns controlled throttling/conflict; no raw token on failed insert.
6. Valid token consumes once; replay and cross-session/operator/session bindings fail.
7. Expired token cannot consume; database outage and unknown commit outcome fail closed.
8. Matching failure after successful consume does not restore challenge.
9. Cleanup removes only expired/consumed rows in bounded batches and tolerates concurrent cleanup workers.
10. Store outage does not block the manual attendance route; process-local fallback is never called.

### PostgreSQL integration tests (dedicated disposable DB only)

1. Migration deploys to a blank isolated PostgreSQL 16 DB; constraints, FK owner binding and indexes exist.
2. Insert a synthetic challenge; inspect that `tokenHash` is stored but raw token is absent.
3. Use two independently constructed Prisma clients/processes and a barrier to consume the same token; exactly one returns valid and one gets replay/invalid.
4. Race the same token with different operator, auth-session and attendance-session bindings; none of the mismatched requests consume it; its rightful binding remains usable once.
5. Race consume against logout/session revocation using the same `AuthSession` lock; one serial order results, and no challenge is consumed after revocation commits first.
6. Verify expiry with DB clock (including application clock skew); no request succeeds after `expiresAt`.
7. Concurrent issue calls for the same operator do not exceed pending cap across clients.
8. Concurrent issues by different operators proceed independently except harmless DB contention.
9. Two cleanup workers use `SKIP LOCKED`/bounded batches without double-processing or deleting live rows.
10. Inject failures before insert commit and before consume commit; assert no partial state. Simulate response failure after commit and assert replay remains rejected.
11. Revoke/close session between challenge issue and consume; consume fails closed. Recheck session active state before attendance persistence.
12. Verify a node restart or second instance does not lose access to a valid persisted challenge.
13. Verify store DB outage yields controlled 503 and no in-memory acceptance; manual attendance remains available.
14. Verify all fixtures are synthetic and only IDs created by the test are removed in cleanup; clients disconnect in `finally`.

The integration test must import the database-isolation bootstrap before constructing Prisma clients, assert the explicit disposable marker and database/container identity, and run by itself. Do not run the broad mock suite with disposable mode enabled. Do not use real cadet data, real messages, a real camera, biometric attendance activation, `ncc_local_dev`, or an existing Compose volume.

## 11. Risks not solved by this design

- Does not provide liveness/PAD, trusted image capture, or protection against a malicious operator who can submit a forged descriptor under the current API.
- Does not fix the current in-memory challenge-rate limiter elsewhere; database pending caps alone may not stop distributed request floods.
- Does not establish consent, lawful purpose, data minimization policy, guardian eligibility, retention authority or authorization approval.
- Does not itself guarantee the matched cadet remains eligible between roster query and attendance write; the final persistence transaction must recheck the attendance session and scope-sensitive invariants as appropriate.
- Does not provide global outage resilience; PostgreSQL availability is required for biometric challenge issuance/consumption.
- Does not guarantee challenge database cleanup if all app instances stop; expired rows remain unusable but may occupy storage until cleanup resumes.
- Does not protect against database administrator access or backups; token digests are non-reversible in practice given 256-bit random input, but metadata still reveals operator/session activity.
- Does not provide exactly-once API response semantics after network loss. It guarantees at-most-once challenge consumption; callers may need a new challenge after uncertain commit.
- Does not test actual PostgreSQL behavior until the separately isolated integration suite is run.

## 12. Institutional and technical decisions still required

Technical choices requiring implementation-owner review:

- Final model/table/constraint names, ID type, FK delete actions, and exact Prisma/raw-SQL boundary.
- Whether pending quota remains 10 and whether there is a global cap across all operators.
- Whether the 30-second TTL remains fixed; the design recommends preserving it initially.
- Cleanup frequency, batch size and consumed/expired metadata retention.
- Exact API error distinction for expired versus invalid/replayed tokens.
- Deployment topology and whether a maintenance/drain window is available during cutover.
- Runtime DB role privileges for locking, cleanup and migration ownership.
- Metrics/logging and incident response for challenge-store outage or anomalous replay rates.
- Whether any future verification flow must bind one challenge to a specific cadet subject rather than a session roster.

Institutional/privacy approvals remain separate: permitted biometric purpose, consent text/policy version, guardian/minor/assent policy, retention/deletion, authorized personnel, manual alternative, and explicit approval for any future biometric attendance operation. Existing approval documents reviewed in the project still record decisions as pending; this design does not infer approval.

## 13. Existing behavior changes

Required behavior changes are deliberately narrow:

- Challenge records move from process memory to shared PostgreSQL. Tokens retain the same response field and encoding.
- A valid challenge becomes usable on any backend instance, rather than only the issuing process.
- Replay, expiry, cross-user/session binding and single-use semantics stay at least as strict. DB/store failure becomes a controlled fail-closed response; it never falls back to memory.
- During cutover, any outstanding process-local challenges are invalidated and must be reissued; this is safe because they are short-lived and the feature must remain disabled during migration/rollout.
- Manual attendance, login, ordinary portal access, attendance correction, consent state, template data and existing attendance rows are unchanged.
- No model, liveness, recognition, consent, biometric enrollment or automatic attendance behavior is enabled or added.

## Final recommendation

**NO-GO for implementation now; GO for technical design review.** Implementation prerequisites:

1. Approve the final schema, SQL constraints, indexes, deletion behavior and cleanup/retention choices.
2. Resolve the institutional/privacy decisions that govern purpose, retention, access and future biometric operation; do not infer approval from general project approval.
3. Separately authorize schema implementation and migration generation; later migration execution requires its own explicit disposable-DB test authorization.
4. Implement the guarded PostgreSQL adapter and dedicated two-client integration tests; preserve mock-only guard behavior and ensure tests never turn on `ENABLE_BIOMETRIC_ATTENDANCE`.
5. Run migration and concurrency/failure tests only on a newly verified disposable local PostgreSQL instance, with sanitized evidence and exact-fixture cleanup.
6. Review deployment cutover and rollback procedures; ensure no mixed-version challenge use and no local fallback.

Until those gates are met, retain the existing process-local implementation, accept its documented multi-instance availability limitation, and keep biometric attendance disabled.
