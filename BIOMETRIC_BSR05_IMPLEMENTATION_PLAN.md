# BSR-05 — Shared Challenge Store Implementation Plan

**Status:** Design only. No code, schema, migration, tests, or database access performed. Biometric attendance remains disabled.

## Current behavior and risk

backend/src/services/verificationChallengeStore.ts stores challenges in a process-local Map. It creates 32 random bytes encoded as hex, stores only the SHA-256 digest, binds to attendance session, operator and durable auth session, expires after 30 seconds, and enforces pending limits of 10 per operator and 10,000 globally per process. Synchronous get/delete makes consumption single-use in one Node process only. Worker restart loses all tokens; another worker cannot consume them. attendance.controller.ts instantiates it and prunes each minute. Current controller consumes before validating all binding fields, so wrong-context use can burn a valid token. This is fail-closed but harms availability.

The existing unit test covers in-process quota, expiry and replay, not multiple workers, PostgreSQL transaction ordering, DB outages, logout races or attendance finalization races. The independent review found NO-GO blockers R1–R6; resolve them before schema implementation.

## Target scope and model

The shared store should target the planned 1:1 cadet-initiated verification flow. It must bind a challenge to the authenticated cadet as subject, attendance session, purpose and durable AuthSession. Do not use it to enable current staff roster-wide 1:N matching. No consent is implied by a valid challenge.

Proposed Prisma model (illustrative; no schema edit):

    enum BiometricChallengePurpose {
      ATTENDANCE_1_TO_1
    }

    model BiometricVerificationChallenge {
      id                String   @id @default(uuid())
      tokenHash         String   @unique(map: "BiometricVerificationChallenge_tokenHash_key")
      subjectCadetId    String
      trainingSessionId String
      authSessionId     String
      purpose           BiometricChallengePurpose
      createdAt         DateTime @default(now()) @db.Timestamptz(3)
      expiresAt         DateTime @db.Timestamptz(3)
      consumedAt        DateTime? @db.Timestamptz(3)

      subjectCadet User            @relation("ChallengeSubject", fields: [subjectCadetId], references: [id], onDelete: Cascade)
      trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
      authSession AuthSession        @relation("ChallengeAuthSessionOwner", fields: [authSessionId, subjectCadetId], references: [id, userId], onDelete: Cascade)

      @@index([expiresAt, id], map: "BiometricVerificationChallenge_expiry_idx")
      @@index([subjectCadetId, consumedAt, expiresAt], map: "BiometricVerificationChallenge_subject_pending_idx")
      @@index([trainingSessionId, expiresAt], map: "BiometricVerificationChallenge_session_expiry_idx")
      @@index([authSessionId, expiresAt], map: "BiometricVerificationChallenge_auth_expiry_idx")
    }

    // Add to AuthSession:
    verificationChallenges BiometricVerificationChallenge[] @relation("ChallengeAuthSessionOwner")
    @@unique([id, userId], map: "AuthSession_id_userId_key")

Add User.subjectVerificationChallenges and TrainingSession.verificationChallenges back-relations. The FK (authSessionId,subjectCadetId) -> AuthSession(id,userId) makes challenge subject equal to durable session owner at the database boundary. Confirm the repository Prisma version accepts subjectCadetId participating in both the User FK and composite AuthSession FK; validate generated SQL on a disposable DB. For this 1:1 flow, subject is authenticated cadet, never a body parameter. TrainingSession.status is a string; service must require ACTIVE and recheck eligibility.

## SQL constraints and indexes

Prisma may not express these PostgreSQL CHECK constraints; put reviewed SQL in the migration and confirm schema drift behavior. Existing text ID conventions should be retained.

    ALTER TABLE "BiometricVerificationChallenge"
      ADD CONSTRAINT "challenge_token_hash_format"
        CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
      ADD CONSTRAINT "challenge_expiry_order"
        CHECK ("expiresAt" > "createdAt"),
      ADD CONSTRAINT "challenge_max_ttl"
        CHECK ("expiresAt" <= "createdAt" + INTERVAL '30 seconds'),
      ADD CONSTRAINT "challenge_consumed_order"
        CHECK ("consumedAt" IS NULL OR
               ("consumedAt" >= "createdAt" AND "consumedAt" <= "expiresAt"));

Use a unique tokenHash index; expiry index for bounded cleanup; subject/consumed/expiry index for pending counts; session and auth-session expiry indexes for scoped cleanup. A partial live-row index may improve queries but is not the quota invariant. No uniqueness constraint replaces conditional consumption.

Keep max TTL at the existing 30 seconds. Use consistent timestamp precision; do not widen TTL to mask rounding. Challenge foreign keys reference User, TrainingSession and AuthSession. Cascading deletion applies only to ephemeral challenge rows, never to separate audit records.

## Transaction rules

Short READ COMMITTED transactions only. No model inference/network work inside transactions. Establish and test a shared lock order. Proposed issue lock order: global quota advisory lock → subject User → AuthSession → TrainingSession → challenge insert. Consume: AuthSession → TrainingSession → exact challenge row. Final attendance: align AuthSession/TrainingSession/attendance locks with session finalization. Existing finalizer updates attendance before session status; do not introduce reverse lock order without refactoring both paths.

### Issue

1. Derive subject and durable session from auth middleware; purpose is a server constant.
2. Begin transaction; apply bounded local lock_timeout and statement_timeout.
3. Acquire one fixed namespaced transaction advisory lock for global admission. Lock subject User row, AuthSession, then TrainingSession.
4. Validate auth session owner, unrevoked and unexpired using DB time; validate session ACTIVE, authorization, and subject eligibility.
5. Capture one DB timestamp after locks. Count pending unconsumed and unexpired challenges; preserve caps 10 per subject and 10,000 global. Reject with sanitized 429 at cap.
6. Generate 32 random bytes, return lowercase hex once, persist only SHA-256 digest with createdAt=t, expiresAt=t+30 seconds and purpose.
7. Commit before returning the token. On failure or uncertain commit return no token; no local fallback.

The global advisory lock serializes all issuance and can bottleneck. It is correct as a simple prototype admission bound only if every issuer takes it. A pending-row cap does not bound rapid issue/consume churn; verify existing route-level throttling is cross-worker. If it is process-local, add an explicitly designed shared rate bucket/limiter and test it.

### Consume

1. Begin transaction and lock AuthSession; require correct owner, not revoked and not expired using post-lock DB time.
2. Lock TrainingSession; require ACTIVE and re-evaluate subject eligibility.
3. Find and lock the challenge by digest plus subject/session/auth-session/purpose. Wrong binding must not consume the rightful challenge.
4. Only after acquiring the exact challenge-row lock, capture one DB timestamp t.
5. Atomically update consumedAt=t where consumedAt IS NULL and expiresAt > t and all bindings match. Exactly one worker succeeds; zero rows means generic invalid/replay/expired.
6. Commit before inference. A later failure burns the token. Re-request is required.

Never use separate clock_timestamp() calls for expiry comparison and consumedAt. Expired equality is expired. An uncertain consume commit is treated as spent. Do not disclose whether a token exists for another subject.

### Cleanup

Use bounded batches with FOR UPDATE SKIP LOCKED. After row lock, capture DB time and delete only expired rows or consumed rows past a documented short operational retention. Logical expiry is enforced during consume even if cleanup is delayed. Cleanup never touches attendance audit. Retention for diagnostics must be decided before implementation.

## Session and attendance race semantics

Challenge consumption alone does not authorize final attendance. Final attendance transaction must recheck durable AuthSession live state, TrainingSession ACTIVE, subject eligibility, consent/enrollment state once implemented, and the unique (sessionId,cadetId) claim. Attendance and required audit commit together. Logout or session close that commits before the mark must make the mark fail; if mark commits first, later close includes it. Refactor/coordinate finalizer lock ordering and prove no deadlock using opposing two-client tests.

## Outage and quotas

Unavailable DB, missing migration, lock/statement timeout or bounded retry exhaustion: fail closed with sanitized 503; quota cap returns 429. Never accept a process-local fallback token. Manual attendance stays independent. Bound DB pool waits, lock/statement time, retries, request size, cleanup batches and inference time. Metrics must exclude raw tokens, digests, embeddings and personal data.

## Migration, disposable DB and rollback

1. Resolve review findings R1–R6 and finalize 1:1 contract.
2. Obtain separate migration authorization; add only the challenge model/relations/indexes/check constraints.
3. Create a fresh isolated local PostgreSQL instance/database only after separate test authorization. Never use ncc_local_dev, existing compose volumes, production or backups.
4. Validate target container ID/label, loopback-only port, exact DB name, role, server version and empty state before writes. Current guard does not prove those facts.
5. Apply reviewed migration only to that disposable database; run the dedicated two-client suite.
6. Keep biometric flag off. No deployment/cutover is part of this plan.
7. Rollback by stopping challenge issuance and invalidating outstanding DB challenges. Do not fall back to process memory. Prefer leaving additive table; dropping requires separately reviewed down migration after TTL drain and recovery review.

Required tests: digest-only storage; wrong-binding does not consume; two-client single winner/replay; expiry equality and lock waiter; cleanup race; issue quota and shared rate limit; restart/multi-instance; logout-vs-consume and logout-vs-final-mark; close-vs-consume and close-vs-mark; DB outage/uncertain commit; bounded cleanup; manual attendance unaffected.

## Recommendation and first safe implementation

**NO-GO for the database adapter/migration until** 1:1 subject contract, global/per-subject quota plus cross-worker rate limit, shared lock order, timeout/retention/error policy, strengthened disposable DB identity checks, and separate migration authorization are complete.

First safe coding task: define a storage interface and add pure mocked contract tests for cross-binding non-consumption and fail-closed errors without changing route enablement. No database or schema change is needed for that isolated task.
