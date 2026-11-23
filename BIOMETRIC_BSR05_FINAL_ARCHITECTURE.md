# BSR-05 Final Architecture — PostgreSQL Challenge Store

**Status:** Revised design only; the Prisma representation exists in the working schema, but SQL constraints/routines, migration, permissions, and PostgreSQL tests are not implemented or verified.
**Decision:** Operational settings are recorded in the decision register; **NO-GO for implementation/activation until SQL, application integration, permission checks, and disposable PostgreSQL verification pass.**
**Invariant:** `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled. Existing manual attendance is unchanged and independent of this service.

> **Canonicalization (23 November 2026):** use the split global/subject quota tables and integrity-gate models in the current Prisma schema. The binding amendment below is authoritative over older trigger/direct-DML and quota-order variants. Operational values are approved in the decision register but remain inactive until implemented and verified. No PostgreSQL behavior has been verified.

## 1. Scope and non-goals

This design supports only future cadet-initiated **1:1** challenge authorization. The subject is the authenticated cadet. The backend derives subject/user and durable auth-session identity from verified middleware context. Client input cannot choose another cadet, operator, template, purpose, provider, timestamps, or result.

The challenge is a short-lived bearer secret used to prevent challenge replay. It does not prove consent, liveness, a trusted camera capture, or a face match. It does not enable biometric attendance. No model/provider is selected or connected here.

The current staff-operated roster-wide 1:N routes and browser-generated descriptor flow remain distinct legacy paths. They must remain disabled/isolated; enabling the existing flag would expose the old path, so a later activation must not be a flag-only change.

## 2. Existing paths that must stay isolated

- `backend/src/routes/attendance.routes.ts` mounts `GET /sessions/:sessionId/verification-challenge`, `POST /sessions/:sessionId/verify-face`, and `GET /sessions/:sessionId/eligible-biometrics` for officer roles.
- `backend/src/controllers/attendance.controller.ts::issueVerificationChallenge` binds the process-local challenge to the operator/session.
- `attendance.controller.ts::verifyFaceAttendance` accepts a browser descriptor and matches against an eligible roster; `getEligibleBiometrics`, `getEligibleCadetsForMuster`, and `getAuthorizedCadetIds` support that 1:N flow.
- `frontend/src/components/attendance/FaceAttendanceModal.tsx` preloads eligible biometrics and submits a descriptor plus challenge token.
- `attendance.controller.ts::markAttendance`, `bulkImportAttendance`, and `endAttendanceSession` implement independent manual operations; they must never require a biometric challenge/provider.
- `backend/src/services/verificationChallengeStore.ts` is process-local. Its entries are lost on restart and not shared across workers. No Map fallback, dual-read, or dual-write is permitted after a future DB cutover.

The proposed 1:1 API is not mounted today. Its contract is:

```text
POST /api/attendance/sessions/:sessionId/biometric/challenge
POST /api/attendance/sessions/:sessionId/biometric/verify
```

Both require authenticated cadet role, JWT validation, and a live durable `AuthSession`. Body is not allowed to select `cadetId`; `sessionId` is checked against current eligibility and session status/time window. The subject template query must be `cadetId = authenticated subject id`, never a roster list. Staff manual routes remain separate. With the feature flag off, these proposed APIs must not issue challenges or write attendance.

## 3. Token and challenge data

1. Generate 32 cryptographically random bytes (`crypto.randomBytes(32)`); return a 64-character hex token once over the authenticated API.
2. Persist only `SHA-256(rawToken)` as lowercase 64-character hex. The API hashes the supplied raw token; it never accepts a digest as a credential.
3. Challenge fields are limited to: opaque ID, digest, subject user id, training session id, durable auth-session id, purpose, created/expiry/consumed timestamps. No face image, embedding, score, raw token, IP, contact information, or provider response is stored.
4. Proposed lifetime remains 30 seconds to match current behavior, pending explicit product/security approval. PostgreSQL time is authoritative; `expiresAt <= dbNow` is expired. Expiry alone does not decrement outstanding/retained counters; only consume or deletion does. Cleanup outage can temporarily block issuance at a per-subject/global outstanding cap, but cannot exceed the cap or extend token validity.
5. Challenge binding is immutable. Allowed state change is `consumedAt: NULL → timestamp`; a consumed row cannot be reset or rebound.

## 4. Proposed schema shape (not a migration)

The exact Prisma model remains subject to relation validation. The counter design intentionally replaces process-local/in-memory limits with database-maintained state.

```prisma
enum BiometricChallengePurpose {
  ATTENDANCE_1_TO_1
}

enum ChallengeQuotaScope {
  GLOBAL
  SUBJECT
}

model BiometricVerificationChallenge {
  id                String   @id @default(uuid())
  tokenHash         String   @unique @db.VarChar(64)
  subjectCadetId    String
  trainingSessionId String
  authSessionId     String
  purpose           BiometricChallengePurpose
  createdAt         DateTime @db.Timestamptz(3)
  expiresAt         DateTime @db.Timestamptz(3)
  consumedAt        DateTime? @db.Timestamptz(3)

  subjectCadet    User            @relation(fields: [subjectCadetId], references: [id], onDelete: Restrict)
  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Restrict)
  authSession     AuthSession     @relation(fields: [authSessionId, subjectCadetId], references: [id, userId], onDelete: Restrict)

  @@index([expiresAt, id])
  @@index([subjectCadetId, expiresAt, id])
  @@index([trainingSessionId, expiresAt, id])
  @@index([authSessionId, expiresAt, id])
}

model BiometricChallengeQuota {
  scope       ChallengeQuotaScope
  scopeId     String   // GLOBAL sentinel or internal subject UUID; no regimental/contact identifier
  policyVersion String
  outstandingCount Int
  outstandingLimit Int
  retainedCount Int       // GLOBAL row only; subject row may keep zero/not used
  retainedLimit Int       // GLOBAL row only
  tokenBalance Decimal    @db.Decimal(12, 4)
  tokenCapacity Decimal   @db.Decimal(12, 4)
  refillPerSecond Decimal @db.Decimal(12, 4)
  refilledAt DateTime     @db.Timestamptz(3)
  updatedAt DateTime      @updatedAt @db.Timestamptz(3)

  @@id([scope, scopeId])
}
```

Add User, TrainingSession and AuthSession back-relations; add `@@unique([id,userId])` to AuthSession for the owner composite FK. Validate the pinned Prisma version and generated SQL before proposing a migration.

### Operator bound

The new cadet-self-service challenge has no operator field and no staff issuance permission. Therefore the database-enforced per-operator outstanding count for this flow is **zero**: no operator-owned challenge can be represented by the accepted purpose/schema. Existing staff challenge endpoints must remain denied/disabled. If an institution later approves a separate staff-assisted biometric flow, it requires a separately reviewed purpose, explicit operator binding, per-operator quota row and authorization tests; do not extend this 1:1 purpose implicitly.

### Database checks and indexes

Required SQL constraints (names illustrative):

```sql
CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
CHECK ("expiresAt" > "createdAt");
CHECK ("expiresAt" <= "createdAt" + INTERVAL '30 seconds');
CHECK ("consumedAt" IS NULL OR
       ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt"));
CHECK ("outstandingCount" >= 0 AND "outstandingCount" <= "outstandingLimit");
CHECK ("outstandingLimit" > 0);
CHECK ("tokenCapacity" > 0 AND "tokenBalance" >= 0 AND
       "tokenBalance" <= "tokenCapacity" AND "refillPerSecond" > 0);
```

Also require `retainedCount >= 0 AND retainedCount <= retainedLimit` on the GLOBAL quota row; require subject rows to follow a single explicit convention for retained fields. Enforce valid `(scope,scopeId)` pairs and one GLOBAL row using a constant ID. The digest unique constraint is essential.

Use a partial pending index for global and subject outstanding checks (`WHERE consumedAt IS NULL`) if retained counters are not the only query path. This is a hot path and should not remain optional without query-plan evidence. Account for `expiresAt > dbNow` in the count. FK columns need supporting indexes for bounded referential checks and cleanup.

### Database-enforced quota mechanism

Use database-owned quota rows plus triggers, not a service-only count. The application role may insert/consume/delete challenge rows but must not own tables, disable triggers, change quota policy rows, or set replication role. A narrowly granted trigger function with fixed `search_path` owns counter changes. Exact function security and grants require security review.

- Before expensive session/template lookup, a short authenticated-attempt gate locks User, then GLOBAL and SUBJECT quota rows, refills/debits both token buckets from one DB timestamp, and commits. This counts rejected authenticated attempts and limits DB work. Challenge issuance revalidates auth/session state afterward.
- Before insert: the issue routine locks User → AuthSession → TrainingSession; the trigger locks GLOBAL quota then SUBJECT row, checks outstanding caps, reserves one global retained slot, and increments outstanding/retained counters. Rate tokens are not debited a second time. If any cap is exhausted, the routine raises a controlled limit error; the insert and counter changes roll back.
- On `consumedAt NULL → timestamp`: the consume routine already holds GLOBAL then SUBJECT quota locks before locking the challenge; the trigger decrements outstanding counts exactly once. It rejects any attempt to clear/change `consumedAt` or alter immutable bindings.
- Before delete: cleanup/account-deletion routine already holds GLOBAL then all affected SUBJECT quota rows before challenge locks; trigger decrements retained count; if still outstanding, it also decrements outstanding. Counter update and challenge deletion are atomic.
- Any underflow, missing quota row, counter inconsistency or trigger error fails closed. No fallback to approximate count or process-local state.
- Use one fixed-size, nonpartitioned challenge table with a hard retained-row cap. Partitioning by time complicates a globally unique token digest because PostgreSQL partitioned-table uniqueness must include the partition key; do not partition unless a revised key/uniqueness design is separately approved.

The quota rows enforce finite count bounds while cleanup is unavailable. Once the retained cap is reached, issuance returns sanitized 503/capacity unavailable until cleanup succeeds. Physical disk exhaustion from other tables/cluster load is outside this row-count guarantee and needs normal database capacity monitoring.

## 5. Quota policy comparison

No numeric limit is selected here. Deployment must configure finite values and a policy version; zero, missing, negative, unlimited, or inconsistent configuration must prevent challenge issuance/startup.

| Model | Burst behavior | Concurrency/multi-instance | Cost and limitations |
|---|---|---|---|
| Fixed window | Allows boundary burst approaching roughly two windows' allowance around reset. | Atomic counter row can enforce each bucket, but all instances must share exact window and policy version. | Lowest state complexity; boundary burst and bucket lifecycle must be accepted. Bucket rows grow with subjects × windows unless retained carefully. |
| Sliding window | Tighter rolling-window bound. | Exact event log needs atomic insertion/retention and indexed per-subject/global queries; approximate bucketed sliding windows need documented error. | Higher row/query cost and cleanup sensitivity; not preferred for this bounded prototype unless boundary burst is unacceptable. |
| Token bucket | Explicit burst capacity and refill rate; does not have fixed-window reset burst. | Atomic update/lock per GLOBAL and SUBJECT quota row using database time; counter trigger/update serializes globally and per subject. | Recommended for request-rate control. Global row is a contention point; bound wait/pool use. State remains one row per scope and avoids per-window row growth. |

Use token buckets for request-rate enforcement and hard outstanding/retained counters for storage. Rate tokens are consumed for authenticated requests even when a later session/eligibility check rejects them. Global policy configuration must be database-authoritative or every instance must reject startup on policy-version/config fingerprint mismatch.

## 6. Corrected transaction and lock protocol

The canonical order is detailed in `BIOMETRIC_BSR05_FINAL_LOCK_ORDER.md`. Summary:

```text
User rows (all involved, sorted) → AuthSession rows (sorted) → TrainingSession rows
→ integrity gate → GLOBAL quota → sorted SUBJECT quota rows → challenge rows
→ attendance rows sorted → audit/event insert
```

Counter changes are owned by narrowly scoped database routines; triggers must not be an alternate counter API or acquire quota locks after challenge locks. Direct application DML is denied. Issuance locks User/AuthSession/TrainingSession, then the gate, GLOBAL/SUBJECT quota rows, then inserts. Consumption and cleanup lock quota rows before changing/deleting challenge rows. Account deletion locks User/AuthSession/TrainingSession as applicable, then the gate and quotas, then explicitly deletes challenge rows. Cleanup never holds the gate/quota locks while waiting for parent User/AuthSession/TrainingSession rows.

### Account deletion

The existing `AuthSession.user` relation is `ON DELETE CASCADE`. Do not rely on a bare `User.delete()` to clean future challenge/counter state. A controlled account-deletion transaction must first lock the User row, then lock its AuthSession rows in id order, explicitly delete challenge rows while quota triggers can still reach their counters, delete AuthSession rows, remove/reset the subject quota row under approved retention rules, then delete/anonymize the User and commit. Restrictive challenge FKs intentionally force this sequence. If a User deletion wins the initial User lock, challenge issue/consume waits and then fails after rechecking subject/session. If issue/consume wins, deletion waits, then removes those ephemeral challenges in its ordered transaction.

PostgreSQL FK checks acquire key-share protection on referenced rows; delete/update and referential-action triggers acquire additional row/table locks. These implicit locks are not visible in service pseudocode. The chosen order is a target for validation, not a proof: inspect PostgreSQL 16 lock behavior with concurrent tests and inspect cascades/trigger DML. PostgreSQL recommends consistent acquisition order because deadlocks can arise from row locks as well as explicit locks. See [PostgreSQL 16 explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html), [transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html), [constraints and referential actions](https://www.postgresql.org/docs/16/ddl-constraints.html), and [partitioning unique-key limits](https://www.postgresql.org/docs/16/ddl-partitioning.html). PostgreSQL's RI trigger implementation uses `FOR KEY SHARE` for FK checks ([PostgreSQL 16 RI trigger source](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/backend/utils/adt/ri_triggers.c)).

## 7. Transaction pseudocode

All operations are short `READ COMMITTED` transactions with bounded `lock_timeout`, `statement_timeout`, pool wait, and request deadline. Set transaction isolation before its first query. Do not run inference, network calls, notifications, or user interaction while locks are held.

### Challenge issuance

```text
derive subjectUserId/authSessionId from authenticated middleware; reject body target fields
begin READ COMMITTED
  lock User(subject) FOR UPDATE
  lock AuthSession(authSessionId, subject) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  recheck role, account state, session state/window and eligibility
  call single challenge INSERT; DB trigger atomically refills/charges quotas and enforces caps
  create token with CSPRNG; persist digest only
commit
return token only after commit acknowledgment; on unknown commit return no token
```

### Challenge consumption

```text
derive subjectUserId/authSessionId from authenticated middleware; hash bounded token input
begin READ COMMITTED
  lock User(subject) FOR UPDATE
  lock AuthSession(authSessionId, subject) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  select exact digest+binding challenge FOR UPDATE (wrong binding does not mutate)
  capture dbNow = clock_timestamp() after challenge row lock
  validate unconsumed, createdAt<=dbNow<expiresAt, all bindings, current eligibility
  update consumedAt=dbNow conditionally; require one row
  DB trigger decrements outstanding quota counters exactly once
commit
infer outside transaction; failed inference spends token
```

### Logout/session revocation

```text
derive userId/sid from verified JWT
begin
  lock User(userId) FOR UPDATE
  lock AuthSession(sid,userId) FOR UPDATE
  compare-and-set revokedAt using DB time; audit in same transaction
commit
```

### Attendance session finalization and manual write

```text
begin
  lock all involved User rows in sorted id order (actor and target cadets if state must serialize)
  lock actor AuthSession, then TrainingSession
  recheck role/scope and ACTIVE/closed state inside transaction
  acquire TrainingAttendance row/unique claims in sorted cadet id order
  apply permitted manual status/correction OR finalize reconciliation and close session
  insert required audit in same transaction
commit
notifications after commit only
```

Manual attendance never reads or writes challenge/quota tables. Final biometric attendance remains a separate later phase and cannot run while the feature flag is off. Its final transaction would additionally recheck consent/enrollment, trusted inference provenance, and exact 1:1 subject before the unique attendance claim.

## 8. Expiry, cleanup, failure, and rollback

- Consume checks expiry even if cleanup is delayed. After locking the challenge row, capture one `clock_timestamp()` and use that exact value for the `expiresAt > dbNow` predicate and `consumedAt`.
- Cleanup uses bounded batches and `SKIP LOCKED`, but must preserve the canonical order with the quota trigger. Do not remove an unexpired challenge. Delete rows only after expiry and the separately approved challenge-row retention rule. Quota-trigger deletion decrements counters in the same transaction.
- If cleanup fails, no count can exceed stored limits: outstanding and retained counters prevent new inserts; issuance fails closed at capacity. Alert on cleanup lag. No quota reset or blind counter reconciliation.
- If counters drift or trigger execution fails, stop issuance and require a reviewed reconciliation procedure that locks the global quota row and compares counters to table state. Never “repair” counters while serving writes.
- PostgreSQL unavailable, lock/statement timeout, exhausted bounded retries, missing migration, quota-row missing, or unknown commit: no success and no in-memory fallback. Return sanitized 503 or quota 429 where known. Unknown issue commit means no token returned; unknown consume commit means token treated as spent.
- Migration is additive, but mixed application binaries are not safe: keep feature disabled; drain/stop old challenge routes; deploy shared-store code everywhere; invalidate old Map challenges; never dual-store/fallback. Rollback means stop issue/consume and keep additive tables. Dropping data requires separate retention approval.

### Migration/cutover sequence (future, separate approval)

1. Approve schema, finite quota-policy values/version, retention, account deletion, and database-role model.
2. Validate Prisma composite relations and create a reviewed create-only migration containing quota table, challenge table, AuthSession composite unique key, FKs/checks/indexes, trigger functions and restricted stored routines.
3. Apply only to a newly provisioned identity-verified disposable PostgreSQL database; test migration and rollback there. The existing URL/name guard alone is not enough to prove server/container identity.
4. Keep the feature flag off. Deploy DB schema first (additive), then code to every local/test instance while legacy challenge routes remain blocked; drain old processes and invalidate every Map challenge. No mixed-store operation.
5. A rollback stops challenge issue/consume and retains additive tables/counters. Do not restore Map fallback or drop records without a separately approved retention/recovery decision.


## Binding amendment — Nine-finding resolution (2026-11-23)

This section is authoritative and supersedes any earlier wording in this document or the lock specification that permits direct challenge-table DML or makes a trigger the primary counter API. It does not change schema or implement routines.

### One write boundary

Challenge and quota mutations are available only through tightly scoped PostgreSQL routines. The runtime API role has no direct INSERT, UPDATE, or DELETE on either table. It calls a transaction-scoped attempt-gate, issue, or consume routine. A separate cleanup identity calls a bounded cleanup routine. Account deletion calls a controlled deletion routine. No routine performs count-then-insert.

Quota rows are the authoritative counters. Every operation locks GLOBAL first, then SUBJECT quota rows in sorted subject-id order; it changes counters and challenge rows in one transaction. Trigger logic, if retained, is defense-in-depth for allowed transitions, must validate one-way state changes and must not acquire quota locks after challenge locks. The design must not use both “direct DML plus trigger” and “routine-only DML” as alternate supported paths.

### Atomic transition contract

- Issue: after parent locks and eligibility recheck, lock GLOBAL and SUBJECT rows; use conditional capacity updates with RETURNING; require exactly one row per required counter; insert the challenge digest and bindings; commit all together. Any cap/error rolls back all writes.
- Consume: lock parent rows, quota rows, then exact challenge; after locks capture one database timestamp; conditional update requires matching digest, subject, AuthSession, TrainingSession and purpose, consumedAt IS NULL, and expiresAt > timestamp; require exactly one row; decrement outstanding counters exactly once; commit. Inference runs after commit.
- Cleanup: quota-first exception; lock GLOBAL, then affected SUBJECT rows sorted, then bounded challenge rows. After locks capture one database time and recheck retention and expiry. Delete plus retained/pending counter decrement is atomic.
- Account deletion: parent-first; lock User, owned AuthSessions sorted, then GLOBAL/SUBJECT quota; explicitly remove challenge rows/counters before deleting restricted parents. TrainingSession deletion likewise needs controlled challenge cleanup.
- Reconciliation: admissions stop; maintenance gate and GLOBAL lock; compare counter values to challenge rows; report mismatch; reviewed repair only; verify again before resuming. No request-path repair.

The routine must not trust a client subject/operator identifier as proof of identity. Express verifies JWT and durable session; routine rechecks row ownership/status and binds arguments. SQL cannot validate the JWT signature.

### Policy rows and limits

Migration creates the initial integrity gate in `BLOCKED/NOT_CONFIGURED` state and its first transition event. It does not seed an operational policy or active quota singleton. Two-person policy activation creates/activates policy and GLOBAL quota state atomically through the audited maintenance path. Runtime never initializes policy or quota rows. Subject quota rows are created race-safely during eligible issuance while GLOBAL is locked. Missing or invalid policy/gate/quota is fail-closed. SQL checks must enforce finite positive limits, counter bounds, singleton key, token-bucket ranges and timestamp invariants. Retained cap counts all challenge rows; outstanding cap counts all unconsumed rows, including expired ones until eligible cleanup. The cap bounds logical challenge rows only, not overall cluster disk/WAL/backups.

Token-bucket request limits use DB time and one GLOBAL plus one SUBJECT row, independently from outstanding and retained capacity. The approved values and schedules are recorded in the operational decision register. This approval does not create or activate a policy row; no policy version becomes active until its two-person approval, immutable audit record, and PostgreSQL checks succeed.

### Database role policy

Migration principal is separate from application credentials. Object owner is NOLOGIN and not superuser. Runtime API is execute-only for challenge writes. Cleanup worker has execute-only bounded cleanup. Audit readers use restricted read-only views/functions. DBA access is separately monitored. Routine ownership/ACL is established in the migration.

SECURITY INVOKER is default. A function uses SECURITY DEFINER only where narrow privilege elevation is required. Such functions use fully qualified object names and a trusted fixed search_path with pg_temp last, no unsafe dynamic SQL, validated parameters, PUBLIC execution revoked, and exact EXECUTE grants applied in the same migration transaction. Runtime cannot own/alter tables, disable triggers, TRUNCATE, set replication role, or change policy.

### Lock order and PostgreSQL behavior

For operations touching overlapping resources: all involved User rows sorted → all AuthSession rows sorted → all TrainingSession rows sorted → quota GLOBAL then SUBJECT sorted → challenge rows sorted → TrainingAttendance claims sorted → audit insert. Cleanup starts at quota and never later locks parent rows. No external I/O occurs while locks are held.

Explicit ordering reduces deadlock risk but does not prove absence of cycles from FK checks, referential actions, triggers, cascades, or unreviewed writers. Existing AuthSession.user and attendance relations include cascades; challenge FKs are restrictive. Ordinary ORM parent deletion is therefore not an allowed deletion path. All account/session/attendance writers must be inventoried and migrated or proved disjoint. Test FK lock behavior with two clients on disposable PostgreSQL.

Set bounded lock and statement timeouts. Retry the entire operation only after a known 40P01 or 40001 abort, only if idempotent, with a small bound and jitter. Never retry an ambiguous commit as a fresh operation. Unknown issue commit returns no token; unknown consume commit treats the token as spent.

### Prisma and custom SQL boundary

Prisma schema represents row models, enums, relations, compound unique keys, ordinary indexes and referential actions. PostgreSQL CHECK constraints, partial indexes, triggers, procedures, permissions and ownership require reviewed hand-authored migration SQL and catalog assertions. Compound AuthSession owner FK requires @@unique([id,userId]). Exact relation shape and generated SQL remain to be checked against the lockfile-resolved Prisma CLI/client version. No schema or migration is created by this amendment.

### Cutover and rollback

No process-local Map fallback, dual read or dual write is allowed after the future cutover. Legacy roster-wide 1:N routes stay unavailable; a feature flag alone must never expose them. Migration may be additive at the database layer, but mixed old/new app binaries are unsafe. Rollback stops shared challenge issue/consume and keeps additive data; it does not restore Map behavior or drop evidence. Manual attendance never calls challenge, quota or provider routines.
