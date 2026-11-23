# BSR-05 Reconciled Challenge Architecture

**Status:** Design only; no implementation, database connection, schema edit, migration, or test execution.
**Recommendation:** **GO for design review; NO-GO for schema/code implementation until the remaining gates at the end are closed.**
**Safety boundary:** Biometric attendance remains disabled. The mock provider remains unwired. Manual attendance stays an independent workflow.

## 1. Decision summary

The shared challenge store is redesigned for a distinct, future **cadet-initiated 1:1** verification flow. It must not be attached to the current staff-operated roster-wide 1:N scan. The authenticated user is the subject. The server derives the cadet id and durable authentication-session id from verified request context; request bodies cannot choose a cadet, operator, provider, template, descriptor, enrollment, or outcome.

The challenge provides a short-lived, single-use server authorization token. It does not establish consent, liveness, trusted camera capture, or face match. A separate trusted inference/consent design is required before biometric attendance can be enabled.

Shared atomic quotas use PostgreSQL transaction-scoped advisory locks in a fixed order plus persisted rate-window counters. Challenge issuance and consumption fail closed when PostgreSQL is unavailable. No process-local fallback is permitted.

## 2. Existing workflow and incompatibilities

### Current source workflow

| Area | Existing implementation | Consequence for redesign |
|---|---|---|
| Attendance routes and UI | `backend/src/routes/attendance.routes.ts`: `GET /sessions/:sessionId/verification-challenge`, `POST /sessions/:sessionId/verify-face`, and `GET /sessions/:sessionId/eligible-biometrics` require officer roles. `frontend/src/components/attendance/FaceAttendanceModal.tsx` preloads eligible biometrics and sends a browser descriptor plus challenge token. | These are operator/roster workflows, not cadet self-service. Do not repurpose these route contracts in place. |
| Challenge issuance | `backend/src/controllers/attendance.controller.ts::issueVerificationChallenge` derives operator/session bindings and uses a module-level `VerificationChallengeStore`. | It has no subject-cadet binding and is process-local. |
| Challenge consumption / matching | `attendance.controller.ts::verifyFaceAttendance` consumes the challenge and loads eligible templates for roster matching. It computes a best match across eligible cadets. | This is 1:N and must not serve the new 1:1 contract. The new API loads exactly one subject template after server-side authorization. |
| Eligible roster endpoint | `attendance.controller.ts::getEligibleBiometrics` and route `/sessions/:sessionId/eligible-biometrics`. | Staff-facing roster preloading is incompatible with a 1:1 privacy boundary; retain only if separately approved and disabled per existing gates. |
| Scope helpers | `getAuthorizedCadetIds`, `getEligibleCadetsForMuster`, `attendanceCadetInScope`, and `drillInstructorMayAccessTarget` in `attendance.controller.ts` and `backend/src/services/attendanceScope.ts` / `drillInstructorScope.ts`. | These helpers define staff roster scope; the new self-service check must validate the authenticated cadet against one session, not enumerate a staff roster. |
| Manual attendance | `markAttendance`, `bulkImportAttendance`, and correction paths are separate staff workflows. | They remain available regardless of challenge service, consent, or provider availability. The shared row-lock protocol must preserve authorized manual corrections. |
| Finalization | `endAttendanceSession` reconciles absent/leave rows and sets session status `CLOSED` in a transaction, but its current read/reconcile/order differs from challenge and marking paths. | It must be refactored to use the protocol in `BIOMETRIC_BSR05_LOCK_ORDER_SPECIFICATION.md` before biometric attendance integration. |
| Authentication sessions | `auth.middleware.ts` verifies JWT and durable `AuthSession` on request entry. `auth.controller.ts::logout` revokes a session by conditional update. | Every biometric stage must revalidate and lock the durable session at its final write boundary; request-entry middleware alone is insufficient against races. |
| Existing challenge store | `backend/src/services/verificationChallengeStore.ts` uses a per-process `Map`, SHA-256 digest keys, 30-second TTL, 10-per-user and 10,000-global process-local pending caps. | It is not restart-safe, cross-instance, or globally rate-limited. Do not dual-read, dual-write, or fallback to it after cutover. |

The existing biometric verification handler currently returns before matching when `ENABLE_BIOMETRIC_ATTENDANCE` is disabled. This must remain true. No existing UI or route should imply that the new workflow is implemented by this design document.

## 3. Future API contract

Paths below are proposed, not mounted routes. They require a separate implementation and API review.

### Challenge issuance

`POST /api/attendance/sessions/:sessionId/biometric/challenge`

- Authentication: existing JWT plus live durable `AuthSession`; role must be `CADET`.
- Body: empty. Reject unexpected `cadetId`, `userId`, `operatorId`, `purpose`, timestamps, provider, descriptor, or model fields (or ignore only if repository-wide request policy explicitly requires it; rejection is safer).
- Subject: `req.user.id`, which must be an active/approved cadet and eligible for the requested session.
- Session: `sessionId` URL parameter, loaded and authorized server-side; must be open and within the permitted time window.
- Purpose: server constant `ATTENDANCE_1_TO_1`; never client-selected.
- Response: one random challenge token and expiry only. No subject roster, template data, descriptor, or other cadet information.
- Rate/quotas: shared PostgreSQL enforcement. Limit values and windows remain pending policy/operational approval.

### Face verification

`POST /api/attendance/sessions/:sessionId/biometric/verify`

- Authentication: same cadet and durable auth session as issuance; identity is always derived from auth context.
- Body: challenge token and a capture/sample reference or bounded image input only after a separate trusted server-side inference design is approved. Browser-supplied embeddings are never trusted.
- Bindings checked: token digest, authenticated subject, exact durable session id, session id, purpose, expiry, unconsumed state, current eligibility, current enrollment/consent, and provider/model trust state.
- Candidate: exactly one biometric template for the authenticated cadet. No roster query, `IN` list, best-match loop, or client-selected target.
- Outcome: minimal status; no score, embedding, template identifier, roster identity, or provider internals in the response.
- Attendance: no attendance write while the feature flag is off. When a later phase enables a controlled prototype, a final transaction must recheck auth session, open attendance session, eligibility, consent/enrollment and unique attendance claim.

### Manual routes

The existing staff manual mark, correction and import contracts remain separate. They never issue/consume biometric challenges and must continue working during biometric database/provider outages and consent withdrawal.

## 4. Revised database design (proposed only)

The model below intentionally stores no separate operator field: in this flow actor and subject are the same authenticated cadet. If future staff-assisted enrollment/operation is approved, represent the operator explicitly in a separately reviewed extension; do not overload the subject field.

```prisma
enum BiometricChallengePurpose {
  ATTENDANCE_1_TO_1
}

model BiometricVerificationChallenge {
  id                String   @id @default(uuid())
  tokenHash         String   @unique(map: "BiometricVerificationChallenge_tokenHash_key") @db.VarChar(64)
  subjectCadetId    String
  trainingSessionId String
  authSessionId     String
  purpose           BiometricChallengePurpose
  createdAt         DateTime @default(now()) @db.Timestamptz(3)
  expiresAt         DateTime @db.Timestamptz(3)
  consumedAt        DateTime? @db.Timestamptz(3)

  subjectCadet    User            @relation("ChallengeSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Restrict)
  authSession     AuthSession     @relation("ChallengeAuthSessionOwner", fields: [authSessionId, subjectCadetId], references: [id, userId], onDelete: Restrict)

  @@index([expiresAt, id], map: "BiometricVerificationChallenge_expiry_idx")
  @@index([subjectCadetId, consumedAt, expiresAt], map: "BiometricVerificationChallenge_subject_pending_idx")
  @@index([trainingSessionId, expiresAt], map: "BiometricVerificationChallenge_session_expiry_idx")
  @@index([authSessionId, expiresAt], map: "BiometricVerificationChallenge_auth_expiry_idx")
}

model BiometricChallengeQuotaBucket {
  scopeType  String   // GLOBAL | SUBJECT; constrained by SQL
  scopeKey   String   // GLOBAL literal or opaque keyed digest of subject id
  windowStart DateTime @db.Timestamptz(0)
  issuedCount Int     @default(0)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)

  @@id([scopeType, scopeKey, windowStart])
  @@index([windowStart])
}
```

Add `User.subjectBiometricChallenges`, `TrainingSession.biometricChallenges`, and `AuthSession.biometricChallenges` back-relations. Add `@@unique([id, userId])` to `AuthSession` for the composite owner FK, after validating compatibility with the pinned Prisma version and generated SQL. Existing `AuthSession.id` remains primary key.

`BiometricChallengeQuotaBucket` is an architectural option to account for issuance bursts across instances. The schema must not be implemented until limits, window shape and retention are selected. `scopeKey` should not expose a cadet id in a quota table; use a domain-separated SHA-256 digest of the random internal user UUID as a pseudonymous key (this is not anonymization). Do not put tokens, token hashes, email, regimental number, biometric status, or request IP into challenge/quota rows.

### PostgreSQL constraints and indexes

Required migration SQL (names illustrative; review actual quoted names):

```sql
ALTER TABLE "BiometricVerificationChallenge"
  ADD CONSTRAINT "challenge_token_hash_format"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "challenge_expiry_order"
    CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "challenge_max_ttl"
    CHECK ("expiresAt" <= "createdAt" + INTERVAL '30 seconds'),
  ADD CONSTRAINT "challenge_consumed_order"
    CHECK ("consumedAt" IS NULL OR
           ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt"));

ALTER TABLE "BiometricChallengeQuotaBucket"
  ADD CONSTRAINT "challenge_quota_scope_type"
    CHECK ("scopeType" IN ('GLOBAL', 'SUBJECT')),
  ADD CONSTRAINT "challenge_quota_count_nonnegative"
    CHECK ("issuedCount" >= 0);
```

Further constraints:

- Composite FK `(authSessionId, subjectCadetId) → AuthSession(id,userId)` binds the challenge to its owner. `subjectCadetId → User(id)` and `trainingSessionId → TrainingSession(id)` use restrictive deletion while retention is undecided.
- The challenge table has no soft “valid” boolean. Validity is derived from immutable binding, consumed state, expiry, durable auth-session status, eligibility and session status.
- Quota bucket unique primary key gives one counter row per scope/window. A SQL `CHECK` cannot enforce a configurable cap; conditional upsert must enforce cap atomically.
- Use a partial index on unconsumed challenges for pending counts/cleanup only if query plans justify it (`WHERE "consumedAt" IS NULL`). Prisma may require hand-authored SQL; partial index is an optimization, not a correctness guard.
- Unique `tokenHash` is mandatory. No index/unique constraint replaces conditional consume.
- Do not cascade challenge rows through user/session deletion without an approved deletion and audit policy. A controlled deletion workflow first invalidates/deletes ephemeral challenges and separately handles durable audit/retention evidence.

### Privacy-minimizing fields

Challenge row stores only opaque id, SHA-256 digest, subject user id, training session id, auth session id, purpose, and issue/expiry/consume timestamps. It stores no raw capture, descriptor, match score, consent text, provider output, identity numbers, or IP. Rate-limit/audit records use opaque keyed identifiers where feasible. Audit records are separate, access-controlled, and must follow an approved retention schedule.

## 5. Issuance and quota protocol

Use short PostgreSQL transactions at `READ COMMITTED` with explicit row/advisory locks. Set bounded local `lock_timeout` and `statement_timeout`; values must be selected against the actual pool and deployment topology before implementation. Never run model inference or network I/O in a transaction.

### Shared quotas

Enforce both:

1. **Pending-resource quotas:** count unconsumed, unexpired rows for subject and globally. Under a transaction-scoped global advisory lock and subject advisory lock, count then insert. All instances must use the same stable lock-key derivation and namespace. A global lock serializes issuance; it is a simple bounded prototype design, not a production throughput claim.
2. **Issuance-rate quotas:** increment persisted fixed-window bucket rows (global and subject) with conditional `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE issuedCount < configuredLimit RETURNING`. No process-local limiter and no Redis/paid dependency. Bucket counter updates and challenge insertion commit atomically. Failed authentication requests should be bounded by existing middleware/rate limiter; if challenge attempts themselves need count-on-failure, extend the bucket event semantics deliberately.

Pending limits and rate limits are different controls. Pending row counts cap stored active work; persistent buckets cap churn. Numeric caps, window duration, boundary strategy, retention and retry-after response remain unresolved and must be approved. The old in-memory limits (10 per operator, 10,000 global) are historical process-local behavior, not automatically adopted: the new subject flow has no operator identity and these do not define rate windows.

### Issue transaction pseudocode

```text
derive subjectUserId and authSessionId from verified request context
reject unless role=CADET; if biometric attendance is disabled, the application endpoint remains disabled
validate session id syntax and bounded request size; body cannot specify subject/purpose
BEGIN READ COMMITTED
  acquire GLOBAL_QUOTA advisory xact lock
  acquire SUBJECT_QUOTA advisory xact lock (fixed order: global, then subject)
  lock AuthSession(subject id, authSessionId) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  capture dbNow := clock_timestamp() once, after locks
  verify AuthSession owner, revokedAt IS NULL, expiresAt > dbNow
  verify TrainingSession.status='ACTIVE' and within allowed time
  re-check subject cadet state, role, session eligibility and applicable current consent/enrollment
  atomically increment global and subject issuance-window buckets; reject if either cap reached
  count pending challenge rows; reject if subject or global pending cap reached
  generate 32 random bytes in application; persist only SHA256(raw token)
  insert challenge(createdAt=dbNow, expiresAt=dbNow+30 seconds, all bindings)
COMMIT
return raw token once, only after acknowledged commit
```

If the commit outcome is unknown, return sanitized unavailable and do not return the token. Any orphan row expires within TTL and consumes quota temporarily. A request retry must create a new token under normal quota rules; no idempotent response may reproduce a token that is not stored.

## 6. Challenge consumption and attendance authorization

### Consume transaction

```text
derive subjectUserId and authSessionId from verified request context
hash supplied opaque token; validate length/hex without logging it
BEGIN READ COMMITTED
  lock AuthSession(authSessionId, subjectUserId) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  select challenge by tokenHash FOR UPDATE
  if absent -> generic invalid response
  capture dbNow := clock_timestamp() once after challenge row lock
  verify exact subject, authSessionId, sessionId, purpose, createdAt<=dbNow<expiresAt
  verify AuthSession remains unrevoked/unexpired at dbNow
  verify TrainingSession remains ACTIVE and subject remains eligible
  verify current consent/enrollment gates when implemented
  UPDATE challenge SET consumedAt=dbNow
    WHERE id=? AND consumedAt IS NULL AND expiresAt>dbNow
  require affected rows=1; else generic conflict/invalid
COMMIT
```

Wrong subject/operator/session/purpose must not consume the rightful challenge. Externally, missing, wrong-binding, expired and replayed tokens should have a generic response to avoid token enumeration; internally emit a sanitized outcome category without token or biometric data.

After consume commits, inference occurs outside the transaction. A failed match spends the challenge and requires a new one. Before attendance is recorded, a second **final-mark transaction** re-locks and revalidates the durable auth session and training session in the required order, rechecks eligibility/consent/enrollment, and claims the unique `(sessionId,cadetId)` attendance row. Logout or session closure may win during inference; then final marking is rejected and no attendance is written. This deliberately favors security over retry convenience.

The later final-mark operation and durable attendance audit should be one transaction. If the audit is security-critical, audit insert failure rolls back the attendance claim. Challenge consumption need not be rolled back after inference failure; the token is one-use by design.

## 7. Expiration, cleanup, outage, rollback

### Expiration and cleanup

- Proposed technical lifetime remains 30 seconds, aligned to current behavior. Database check enforces `expiresAt > createdAt` and `expiresAt <= createdAt + interval '30 seconds'`. Expiry is `expiresAt <= dbNow` (equality is expired).
- Use `clock_timestamp()` once, after all relevant locks. Do not use `now()`/`transaction_timestamp()` as a substitute for post-lock time because they reflect transaction start. Use that one captured value for predicate and `consumedAt`.
- Cleanup runs in bounded batches, parallel workers may use `FOR UPDATE SKIP LOCKED`. Each deletion transaction checks DB time after locking and deletes only expired rows. Consumption independently checks expiry, so cleanup lag cannot make an expired token valid.
- Retain consumed/expired challenge metadata only for the shortest approved operational need. If no audit retention is approved, challenge rows are ephemeral and cleanup deletes consumed rows after a short technical delay; security audit events remain separate and do not include raw token/digest. Numeric retention, failed-attempt audit retention and batch size require operational/privacy review. Do not infer institutional policy.
- Cleanup lock order is challenge row only and must never acquire auth/session/quota locks afterward. This avoids a cycle with issue/consume, which acquire parent/quota locks before challenge rows.

Illustrative PostgreSQL cleanup statement (parameters are batch size `$1` and approved consumed-row retention interval `$2`; validate column/table mappings against the eventual migration). The dependency from `after_lock` to the materialized locked CTE makes the captured database time occur after candidate row locks have been taken. The final predicate rechecks expiry at that one timestamp.

```sql
WITH candidates AS MATERIALIZED (
  SELECT "id"
  FROM "BiometricVerificationChallenge"
  WHERE "expiresAt" <= clock_timestamp()
  ORDER BY "expiresAt", "id"
  LIMIT $1
  FOR UPDATE SKIP LOCKED
), lock_barrier AS MATERIALIZED (
  SELECT count(*) AS n FROM candidates
), after_lock AS MATERIALIZED (
  SELECT clock_timestamp() AS db_now FROM lock_barrier
), doomed AS MATERIALIZED (
  SELECT c."id", t.db_now
  FROM candidates c CROSS JOIN after_lock t
  WHERE EXISTS (SELECT 1 FROM lock_barrier)
)
DELETE FROM "BiometricVerificationChallenge" AS ch
USING doomed d
WHERE ch."id" = d."id"
  AND ch."expiresAt" <= d.db_now
  AND (ch."consumedAt" IS NULL OR ch."consumedAt" <= d.db_now - $2::interval)
RETURNING ch."id";
```

This is design SQL, not executed or migration-ready. Verify PostgreSQL planner/materialization semantics and expected `SKIP LOCKED` behavior with a two-client test. If there are no candidates, the barrier still yields a timestamp and deletion is empty. Expiry remains enforced by consume regardless of cleanup.

### Outage/error behavior

- PostgreSQL unavailable, missing migration, lock timeout, statement timeout, bounded retry exhaustion, or unknown commit outcome: fail closed. Sanitized service-unavailable response; do not expose SQL, host, credentials, raw token, digest, subject, or template details.
- Quota exhausted: sanitized 429 with retry hint only when the applicable fixed-window reset is known.
- No retries for arbitrary callback transactions. Retry only documented serialization/deadlock cases with bounded attempts and idempotent transaction logic. Token issuance is not retried after ambiguous commit.
- No process-local challenge fallback, including during rolling restart or rollback.
- Manual attendance does not depend on this database path and remains operational under biometric outage.

### Migration sequence and rollback

1. Approve the self-service route contract and all unresolved limit/retention settings. Finish the common lock protocol and session-race refactor in a separate implementation plan.
2. Validate Prisma relations (especially composite AuthSession FK and User/TrainingSession back-relations) against the pinned toolchain without connecting to an existing DB.
3. Additive schema proposal: challenge enum/table; quota bucket table; AuthSession compound unique; back-relations; SQL checks/indexes. No existing template or attendance record is rewritten.
4. Create a migration only after separate authorization. Review generated SQL and hand-authored CHECK/partial indexes.
5. Apply only to a newly provisioned, identity-verified, disposable local PostgreSQL database; run multi-client tests. Do not use `ncc_local_dev` or any existing database.
6. For future controlled cutover, drain old challenge endpoints and invalidate all process-local pending challenges. No dual-store mode. Existing in-flight attempts must request a fresh challenge.
7. Rollback application: keep feature disabled, stop new issuance/verification, leave the additive tables in place. Do not fallback to Map. Dropping tables is a separate destructive migration requiring data-retention decision and explicit approval. On disposable test DB only, discard the entire labeled ephemeral container.

## 8. Remaining blockers

1. Numeric global, per-subject, pending, and rate-window limits; quota bucket window semantics and retry responses.
2. Challenge row and audit retention, cleanup cadence/batch size, and account-deletion behavior (organizational privacy decision remains unresolved).
3. Lock protocol adoption by all logout, finalization, manual attendance, import/correction, and future biometric write paths; current code does not comply.
4. A distinct cadet self-service 1:1 UI/API is not implemented; existing routes are staff-operated 1:N. Subject identity must be derived from durable authenticated context.
5. `FaceEnrollmentModal.tsx` and `enrollBiometricTemplate` currently accept a browser-generated descriptor; consent lifecycle, model licensing, trusted server-side capture/inference, and PAD remain separate prerequisites for any biometric attendance activation.
6. The current database-safety guard does not prove target container identity/emptiness. Dedicated disposable test runner and identity checks need separate review before any DB connection.
7. No migration authorization or PostgreSQL integration evidence exists. This work does not request or grant either.

## 9. Decision

**GO for architecture review. NO-GO for schema implementation, migration, or attendance integration.** The structural design resolves the previous 1:N mismatch, defines cross-instance quota primitives and a lock protocol, and specifies linearization behavior. Numeric quota/retention decisions, application lock-order adoption, disposable-target guard verification, and separate migration authorization remain blockers. The existing feature flag stays disabled throughout; no test configuration should turn it on.

**Exact next action:** review and approve the two companion documents—`BIOMETRIC_BSR05_LOCK_ORDER_SPECIFICATION.md` and `BIOMETRIC_BSR05_REVISED_TEST_MATRIX.md`—then settle quota and retention parameters. Only afterward prepare a separate exact schema-diff/migration approval request. No database commands are authorized by this document.
