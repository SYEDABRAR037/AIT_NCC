# BSR-05 P0 Remediation Specification

**Purpose:** Close the seven pre-implementation blockers before staged BSR-05 work.
**Status:** Design only. No application/schema files edited, no SQL executed, no database or container accessed, and no migrations generated.
**Security boundary:** `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled. This work does not authorize or implement biometric enrollment, verification, or attendance.

> **Status note (23 November 2026):** this is a historical remediation specification. Prisma multi-schema, split quota, integrity-gate, and attendance-window representations have since been added to the working schema, and approved policy values are recorded in `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`. This document remains design evidence; it is not executable SQL or proof of PostgreSQL behavior. Newer final lock-order and nine-finding resolution documents supersede conflicting lock/write-boundary text below.

## 1. Decision summary

Use one canonical shared-store design:

- `BiometricVerificationChallenge`
- `BiometricChallengeGlobalQuota`
- `BiometricChallengeSubjectQuota`
- An additional immutable `BiometricChallengePolicy` table to represent versioned TTL, quota, retention, and batch settings.

Do not retain the polymorphic quota-table alternative. Treat the current Prisma excerpt and SQL fragments as a **proposal**, not executable or validated SQL. The only existing implementation is an in-process `Map`; the new store and all database routines remain future work.

The recommended correction to attempt-rate accounting is to combine token-bucket admission, cap checks, counter reservation, and challenge insertion in one `issue_biometric_challenge` database function/transaction. A separately executable admission function followed by issuance would permit a caller with `EXECUTE` on the issue function to bypass the earlier gate. There should be no runtime-executable standalone issue path that skips the bucket debit.

## 2. Prisma multi-schema specification

### Resolved versions and current configuration

- `backend/package-lock.json` resolves both `prisma` and `@prisma/client` to **6.19.3**. Package manifest ranges are not the resolved versions.
- `backend/prisma/schema.prisma` currently declares the PostgreSQL provider and `DATABASE_URL`/`DIRECT_URL`; it has no `schemas` list and no `@@schema` attributes.
- The local Prisma 6.19.3 validation warning recorded in `BIOMETRIC_BSR05_PRE_IMPLEMENTATION_RECONCILIATION.md` says `multiSchema` functionality is available without declaring it as a preview feature. For this resolved version, use `schemas = ["public", "app_private"]` and per-model/enum `@@schema(...)`; omit `previewFeatures = ["multiSchema"]` unless a later resolved CLI proves otherwise.
- Validation on a temporary combined schema failed when multiple schemas were declared but existing public models/enums had no `@@schema`. It passed after adding `@@schema("public")` to all existing public models/enums and `@@schema("app_private")` to the proposed private objects. That scratch result validated Prisma syntax/relations only, not SQL or a database.

### Existing declarations requiring `@@schema("public")`

Enums (3): `Role`, `AccountStatus`, `OtpPurpose`.

Models (41):

`User`, `ReviewRecord`, `GalleryPhoto`, `RankHolder`, `InstitutionalInfo`, `SeniorAssignment`, `PlatoonSeniorAssignment`, `DrillInstructorAssignment`, `Platoon`, `AuthSession`, `RecoveryChallenge`, `PerformanceAssessment`, `PerformanceScoreSnapshot`, `Notice`, `Event`, `EventParticipant`, `Achievement`, `Camp`, `CampDocument`, `CampParticipant`, `Leave`, `LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `Duty`, `AuditLog`, `RankHistory`, `Notification`, `NotificationPreferences`, `WebPushSubscription`, `NotificationRead`, `TrainingSession`, `TrainingAttendance`, `BiometricTemplate`, `TurnoutInspection`, `Certificate`, `AttendanceNotification`, `PasswordReset`, `OtpChallenge`.

The implementation diff must preserve all existing fields, relations, maps and defaults while adding those schema annotations. New `BiometricChallengePurpose`, `BiometricChallengePolicy`, `BiometricVerificationChallenge`, `BiometricChallengeGlobalQuota`, and `BiometricChallengeSubjectQuota` belong to `app_private`.

### Safe scratch validation commands (future implementation only)

These commands must operate on a temporary copy and use dummy unreachable URLs. They do not connect to PostgreSQL. Do not run `migrate`, `db push`, or `generate` as part of this validation step.

```sh
cd "/Users/syedabrarahmed/Desktop/NCC Web & App/backend"
scratch_dir="$(mktemp -d /tmp/ncc-bsr05-schema.XXXXXX)"
cp prisma/schema.prisma "$scratch_dir/schema.prisma"
# Apply the proposed models/relations and @@schema annotations to this scratch copy only.
env -i PATH="$PATH" PRISMA_DONT_LOAD_DOTENV=1 \
  DATABASE_URL='postgresql://scratch:scratch@127.0.0.1:9/scratch' \
  DIRECT_URL='postgresql://scratch:scratch@127.0.0.1:9/scratch' \
  ./node_modules/.bin/prisma validate --schema "$scratch_dir/schema.prisma"
```

A helper script used to annotate the scratch copy must assert exactly 41 model blocks and three enum blocks were annotated as `public`; it must not write to `prisma/schema.prisma`. Remove only the generated scratch directory in a `finally` block and verify its path is under `/tmp` before removal. No such validation command was executed for this task.

## 3. Canonical split-quota architecture and document reconciliation

### Canonical names and relationships

- `BiometricChallengeGlobalQuota` maps to `app_private.biometric_challenge_global_quota`; exactly one row with key `GLOBAL` is permitted, though missing-row detection must remain explicit because a CHECK cannot require row existence.
- `BiometricChallengeSubjectQuota` maps to `app_private.biometric_challenge_subject_quota`; PK/FK is `subject_user_id → public."User"(id)` with restrictive deletion.
- `BiometricVerificationChallenge` maps to `app_private.biometric_verification_challenge`; unique SHA-256 token digest; subject User, TrainingSession, durable AuthSession, purpose and policy version. The AuthSession relation uses composite `(auth_session_id, subject_user_id) → public."AuthSession"(id,user_id)` and therefore needs `@@unique([id,userId])` on AuthSession.
- `BiometricChallengePolicy` maps to `app_private.biometric_challenge_policy`; immutable versions and content hash; referenced by the active global quota row and each issued challenge.

### Exact artifact corrections

| Artifact / section | Required edit |
|---|---|
| `BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md` §1–2 | State split quota tables are canonical; delete any polymorphic alternative. Add policy model and all public annotations. Replace the inaccurate “request accounting is atomic with challenge creation” sentence. Remove duplicated attempt-gate paragraph. |
| `BIOMETRIC_BSR05_RECONCILED_ARCHITECTURE.md` §quota model / §counter architecture | Mark `BiometricChallengeQuotaBucket(scopeType,scopeKey,windowStart)` as superseded; replace active schema/routine guidance with separate global and subject quota tables. Preserve its historical review context with a dated/superseded note, not a second active option. |
| `BIOMETRIC_BSR05_LOCK_ORDER_SPECIFICATION.md` §0c | Replace the quota-bucket row ordering with `GlobalQuota` then sorted `SubjectQuota` rows, matching the selected table design and final lock protocol. |
| `BIOMETRIC_BSR05_INDEPENDENT_ARCHITECTURE_REVIEW.md` historical scope-key findings | Do not erase the historical finding. Add a disposition stating the scope-key concern applied to the superseded polymorphic design and is resolved structurally by separate global and User-FK subject rows; retain any generic privacy/retention concerns that still apply. |
| `BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md` §3–7 | Name the four tables consistently; add policy constraints, immutable policy trigger, canonical indexes, exact DDL/function bodies, role setup and catalog checks. Remove standalone admission/issue ambiguity; issue function must debit its own token bucket atomically. |
| `BIOMETRIC_BSR05_MIGRATION_AND_ROLLBACK.md` §M0 | Remove the question asking whether the split supersedes the polymorphic table. State the three required challenge/quota tables plus policy table. |
| `BIOMETRIC_BSR05_MIGRATION_AND_ROLLBACK.md` §M1–M4 | List exact models, FK/index/constraint names, policy seed gate, routine owners/roles and test IDs. Do not characterize the migration as executable until the full SQL passes on an authorized disposable target. |
| `BIOMETRIC_BSR05_APPLICATION_CHANGE_MAP.md` schema/routine/test rows | Replace generic “quota models” with canonical names and map all counter changes. Mark current `perOperatorLimit` as legacy operator-local behavior, not the future subject quota. Document no separate operator quota unless one is approved. |
| `BIOMETRIC_BSR05_APPLICATION_CHANGE_MAP.md` auth/lock rows | Make clear lock sequences are target behavior, not current behavior; add `otpAuth.controller.ts`, recovery reset and missing deletion paths. |
| `BIOMETRIC_BSR05_DISPOSABLE_DB_HARNESS_DESIGN.md` roles/test plan | Add the policy table and exact global/subject counters to catalog assertions and ACL tests. Keep the harness code-only/mock phase separate from real DB provisioning. |
| `BIOMETRIC_BSR05_HARNESS_IMPLEMENTATION.md` | Keep its mock-only guarantee. Add required mocked checks for the policy schema/expected table names and direct-DML/role-escalation denial; do not add a real mode or command yet. |
| `BIOMETRIC_BSR05_FINAL_TEST_MATRIX.md` T01–T80 | Preserve applicable cases; revise T35–T37/T78 to match atomic issue admission. Add the cases specified in §8. No test should enable the biometric feature flag. |

`BIOMETRIC_BSR05_PRE_IMPLEMENTATION_RECONCILIATION.md` is evidence of the previous review and should remain historical. Add a status/disposition if it is maintained, but do not rewrite evidence about what failed at that time. Search all `BIOMETRIC_BSR05_*.md` files for `BiometricChallengeQuotaBucket`, `scopeKey`, and polymorphic quota language during the documentation reconciliation; active plans must point only to the split design, while historical reviews retain a clearly labeled superseded disposition.

## 4. Versioned retention and operational policy

### Proposed database representation (not applied)

Use an immutable `BiometricChallengePolicy` version row. Fields (Prisma names shown; SQL uses snake case):

- `policyVersion String @id @map("policy_version")`
- `policyHash String @unique @db.Char(64) @map("policy_hash")`
- `maxChallengeTtlMs BigInt`
- `globalOutstandingLimit Int`
- `subjectOutstandingLimit Int`
- `retainedLimit Int`
- `globalTokenCapacity Decimal @db.Decimal(18,6)`
- `globalRefillPerSecond Decimal @db.Decimal(18,6)`
- `subjectTokenCapacity Decimal @db.Decimal(18,6)`
- `subjectRefillPerSecond Decimal @db.Decimal(18,6)`
- `consumedRetentionMs BigInt`
- `expiredRetentionMs BigInt`
- `cleanupBatchLimit Int`
- `cleanupSubjectLimit Int`
- `createdAt DateTime @db.Timestamptz(6)`

`BiometricChallengeGlobalQuota` stores `activePolicyVersion` (FK to policy), global outstanding/retained counters, global token balance/refill timestamp and update timestamp. `BiometricChallengeSubjectQuota` stores user ID, outstanding count, subject token balance/refill timestamp and update timestamp. Each challenge stores its immutable `policyVersion`, enabling expiry/retention provenance.

### Constraints and fail-closed behavior

- Policy version is nonempty and PK; policy hash is canonical lowercase SHA-256 hex and unique.
- `max_challenge_ttl_ms > 0`; outstanding/retained limits and cleanup batch limits are positive; retention durations are `>= 0`.
- Token capacities and refill rates are positive; balances must be between zero and the active capacity. Numeric values must reject PostgreSQL `NaN`/infinity if supported by the chosen `numeric` representation.
- Global outstanding and retained counters remain between zero and the limits from the active immutable policy; subject outstanding remains between zero and its active policy limit.
- Global singleton key has PK and CHECK `key = 'GLOBAL'`. Every issue/consume/cleanup routine errors with a sanitized service-unavailable result if the row or referenced active policy is absent, hash/version validation fails, or counters disagree with row-local bounds. A zero-row singleton cannot be prevented by a table CHECK; add startup/catalog assertion and fail closed on every function call.
- Policy rows cannot be updated/deleted by trigger and ACL. A policy change inserts a new version and atomically changes the global pointer under maintenance admission lock; bucket balances are clamped/refilled under the new capacity. Exact activation procedure requires review and test.
- Do not seed operational values in a real environment until separately approved. Disposable integration tests may use clearly named fixture policy values only within their verified disposable target; those values are not deployment recommendations.

Technical expiration is independent from retention: a challenge is unusable at `db_now >= expires_at`; passage of expiry does not decrement quota. Expired-unconsumed rows remain counted until cleanup. Consumed and expired retention decide when metadata rows can be physically removed. Audit retention is separate and is not inferred from challenge retention. Values remain unresolved.

## 5. Proposed SQL inventory (all unverified; not executed)

### Verified versus proposed SQL

**Verified:** only Prisma 6.19.3 scratch-schema syntax/relation validation was previously observed as described in §2.
**Not verified:** every SQL object below, including types, DDL, constraints, indexes, triggers, functions, roles, grants, seed behavior and catalog assertions. Existing fragments in `BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md` were not executed and are not evidence of PostgreSQL validity.

### Proposed DDL shape

```sql
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE SCHEMA IF NOT EXISTS app_api;
CREATE SCHEMA IF NOT EXISTS app_ops;

CREATE TYPE app_private.biometric_challenge_purpose AS ENUM ('ATTENDANCE_1_TO_1');

CREATE TABLE app_private.biometric_challenge_policy (
  policy_version text PRIMARY KEY CHECK (length(policy_version) > 0),
  policy_hash char(64) NOT NULL UNIQUE CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  max_challenge_ttl_ms bigint NOT NULL CHECK (max_challenge_ttl_ms > 0),
  global_outstanding_limit integer NOT NULL CHECK (global_outstanding_limit > 0),
  subject_outstanding_limit integer NOT NULL CHECK (subject_outstanding_limit > 0),
  retained_limit integer NOT NULL CHECK (retained_limit > 0),
  global_token_capacity numeric(18,6) NOT NULL CHECK (global_token_capacity > 0),
  global_refill_per_second numeric(18,6) NOT NULL CHECK (global_refill_per_second > 0),
  subject_token_capacity numeric(18,6) NOT NULL CHECK (subject_token_capacity > 0),
  subject_refill_per_second numeric(18,6) NOT NULL CHECK (subject_refill_per_second > 0),
  consumed_retention_ms bigint NOT NULL CHECK (consumed_retention_ms >= 0),
  expired_retention_ms bigint NOT NULL CHECK (expired_retention_ms >= 0),
  cleanup_batch_limit integer NOT NULL CHECK (cleanup_batch_limit > 0),
  cleanup_subject_limit integer NOT NULL CHECK (cleanup_subject_limit > 0),
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE app_private.biometric_challenge_global_quota (
  singleton_key text PRIMARY KEY CHECK (singleton_key = 'GLOBAL'),
  active_policy_version text NOT NULL REFERENCES app_private.biometric_challenge_policy(policy_version) ON DELETE RESTRICT,
  global_outstanding integer NOT NULL DEFAULT 0 CHECK (global_outstanding >= 0),
  retained_count integer NOT NULL DEFAULT 0 CHECK (retained_count >= 0),
  global_token_balance numeric(18,6) NOT NULL CHECK (global_token_balance >= 0),
  global_refilled_at timestamptz(6) NOT NULL,
  updated_at timestamptz(6) NOT NULL
);

CREATE TABLE app_private.biometric_challenge_subject_quota (
  subject_user_id text PRIMARY KEY REFERENCES public."User"(id) ON DELETE RESTRICT,
  outstanding integer NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
  token_balance numeric(18,6) NOT NULL CHECK (token_balance >= 0),
  refilled_at timestamptz(6) NOT NULL,
  updated_at timestamptz(6) NOT NULL
);

-- Add the referenced candidate key to the existing AuthSession table in the
-- reviewed schema migration, using the actual public table owner.
ALTER TABLE public."AuthSession"
  ADD CONSTRAINT "AuthSession_id_userId_key" UNIQUE (id, "userId");

CREATE TABLE app_private.biometric_verification_challenge (
  id text PRIMARY KEY,
  token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  subject_user_id text NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
  training_session_id text NOT NULL REFERENCES public."TrainingSession"(id) ON DELETE RESTRICT,
  auth_session_id text NOT NULL,
  policy_version text NOT NULL REFERENCES app_private.biometric_challenge_policy(policy_version) ON DELETE RESTRICT,
  purpose app_private.biometric_challenge_purpose NOT NULL,
  created_at timestamptz(3) NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  consumed_at timestamptz(3),
  CONSTRAINT biometric_challenge_auth_owner_fk
    FOREIGN KEY (auth_session_id, subject_user_id)
    REFERENCES public."AuthSession"(id, "userId") ON DELETE RESTRICT,
  CONSTRAINT biometric_challenge_time_order
    CHECK (expires_at > created_at AND
      (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at)))
);

CREATE INDEX biometric_challenge_cleanup_expiry_idx
  ON app_private.biometric_verification_challenge (expires_at, id);
CREATE INDEX biometric_challenge_consumed_retention_idx
  ON app_private.biometric_verification_challenge (consumed_at, id)
  WHERE consumed_at IS NOT NULL;
CREATE INDEX biometric_challenge_subject_pending_idx
  ON app_private.biometric_verification_challenge (subject_user_id, expires_at, id)
  WHERE consumed_at IS NULL;
CREATE INDEX biometric_challenge_auth_session_idx
  ON app_private.biometric_verification_challenge (auth_session_id, id);
CREATE INDEX biometric_challenge_training_session_idx
  ON app_private.biometric_verification_challenge (training_session_id, id);
```

The Prisma schema and migration must agree exactly on field types, schema/table/column maps, relations, FK names and indexes. Prisma cannot express partial-index predicates or all cross-table policy/invariant rules; put those in custom migration SQL. The proposed indexes above replace the overlapping index list in the older blueprint; confirm via disposable query plans before retaining additional indexes.

### Proposed triggers and write boundaries

1. `biometric_challenge_policy_immutable`: reject UPDATE and DELETE for policy rows. A new policy is a new INSERT; migration/owner-only role owns that operation.
2. `biometric_challenge_immutable_binding`: reject changes to ID, digest, subject, attendance session, auth session, purpose, policy version, created time or expiry. Permit only `consumed_at: NULL → a timestamp < expires_at`; reject reversal or repeated change.
3. Triggers do **not** modify quota counters. All challenge/counter changes are owned by functions in one transaction. The runtime and cleanup roles have no direct table DML.

### Proposed routine bodies and transaction contracts

All routines below are **function-body specifications**, not verified SQL. They execute as one database statement/transaction under the caller; PostgreSQL functions do not commit independently. API must return a raw challenge token only after the function statement/transaction is known committed. On ambiguous issue commit, do not return token; on ambiguous consume, treat token as spent. No Map fallback.

#### `app_api.issue_biometric_challenge(subject, auth_session, training_session, challenge_id, token_hash)`

Inputs are server-derived after authentication; never accept user/subject/auth-session IDs from request body. Return `(issued boolean, denial_code text, expires_at timestamptz)`. Do not accept policy values, clock, or operator-supplied limits.

Exact ordered body:

1. Validate fixed-length lowercase digest and bounded ID shapes; on malformed request return generic invalid result before writes.
2. `SELECT id, role, status FROM public."User" WHERE id = p_subject FOR SHARE`; require exactly one active/approved CADET. Subject ID must be copied from verified request context by backend.
3. `SELECT id,"userId",expires_at,revoked_at FROM public."AuthSession" WHERE id=p_auth AND "userId"=p_subject FOR SHARE`; require exactly one, `revoked_at IS NULL`, expiry strictly later than `clock_timestamp()`.
4. `SELECT id,status FROM public."TrainingSession" WHERE id=p_training FOR SHARE`; require `status='ACTIVE'` and applicable attendance window.
5. Lock `GLOBAL` quota row `FOR UPDATE`; require exactly one. Read its active immutable policy row and verify hash/version/config invariants.
6. `INSERT` subject quota row with zero outstanding and full initial balance only if absent; then select that subject row `FOR UPDATE`. Global lock serializes quota-row initialization through all authorized writers.
7. Read one `v_now := clock_timestamp()` after locks. Refill global and subject token buckets from elapsed DB time, capped by current policy capacities. Persist refilled balances and timestamps. If either bucket has <1 token, return a generic rate-limited result after persisting refill state, without counters/challenge. If tokens are available, debit one from each bucket. This happens in this same function, so direct execution cannot bypass it.
8. If global outstanding, subject outstanding, or retained count is at limit, return a generic capacity result. The attempt token debit remains spent (normal return commits it); do not increment counters.
9. Conditionally update global outstanding and retained counters, and subject outstanding, each with `... WHERE current < policy_limit RETURNING ...`; require exactly one row per update. If any condition fails, raise an internal typed exception so the entire statement rolls back. No `COUNT(*)` hot-path quota decision.
10. Insert one challenge row with the supplied ID/digest, same subject/session bindings, active `policy_version`, fixed purpose, `created_at=v_now`, `expires_at=v_now + maxChallengeTtl`, `consumed_at=NULL`. The table check plus function policy check enforce time order/TTL. If insert conflicts/errors, all counter increments and token debit roll back.
11. Return success and expiry only after the function completes; API emits raw token after transaction commit acknowledgement.

Do not keep a separate runtime-executable `admit_biometric_attempt` function. If preserving a pre-lookup gate becomes mandatory, it must issue a persisted one-use admission capability that the issue function atomically claims; that extra table/cleanup/quota design is a separate change and is not selected here.

#### `app_api.consume_biometric_challenge(subject, auth_session, training_session, token_hash)`

Return only generic success/conflict externally and a minimal internal result. Lock/revalidate in order: User `FOR SHARE`; exact AuthSession `(id,userId)` `FOR SHARE`; TrainingSession `FOR SHARE`; Global quota `FOR UPDATE`; Subject quota `FOR UPDATE`; exact challenge by digest `FOR UPDATE`. Read DB time after waits. Require all identifiers match, active user/session/session, fixed purpose, `consumed_at IS NULL`, and `created_at <= now < expires_at`. Wrong binding/replay/expiry must not mutate counters or reveal whether a digest exists.

Claim with conditional update:

```sql
UPDATE app_private.biometric_verification_challenge
SET consumed_at = v_now
WHERE id = v_id AND token_hash = p_token_hash
  AND subject_user_id = p_subject AND auth_session_id = p_auth
  AND training_session_id = p_training AND purpose = 'ATTENDANCE_1_TO_1'
  AND consumed_at IS NULL AND created_at <= v_now AND expires_at > v_now
RETURNING id;
```

Require exactly one returned row. Then decrement global and subject outstanding with `WHERE counter > 0 RETURNING`; require one row each, otherwise raise to roll back the consume update. Retained count is unchanged. Commit before any later inference call. No attendance write occurs in this routine.

#### `app_ops.cleanup_biometric_challenges()`

No caller-supplied cutoff, IDs or SQL fragment. Only cleanup role receives EXECUTE. Algorithm:

1. Lock GLOBAL quota `FOR UPDATE`; require one row and valid active policy.
2. Capture candidate subject IDs with eligible rows, ordered by subject ID and bounded by `cleanup_subject_limit`; lock matching subject quota rows in ascending ID order. If a candidate lacks its subject counter row, abort and emit a sanitized invariant alert; do not recreate counters.
3. Capture one `v_now=clock_timestamp()` after locks.
4. Select up to `cleanup_batch_limit` rows for locked subjects, ordered by `(expires_at,id)`, `FOR UPDATE SKIP LOCKED`, where either (a) `consumed_at IS NOT NULL AND consumed_at <= v_now - consumed_retention` or (b) `consumed_at IS NULL AND expires_at <= v_now - expired_retention`.
5. For each selected ID, delete with the same eligibility predicate and `RETURNING subject_user_id, consumed_at`. For each actually deleted row, decrement retained exactly once. If returned `consumed_at IS NULL`, also decrement global and subject outstanding exactly once; otherwise do not touch outstanding. Every decrement has a `>0` predicate and `RETURNING`; mismatch raises and rolls back the entire batch.
6. Return deleted row count only. No direct delete path outside the routine. Because all challenge writers lock GLOBAL before challenge rows, cleanup-vs-consume serializes. If operations violate that protocol, the concurrency tests must expose it; `SKIP LOCKED` alone is not the consistency mechanism.

#### `app_ops.reconcile_biometric_challenge_counters()`

Maintenance-only, report-only, no automatic repair. Lock GLOBAL quota `FOR UPDATE` to stop admissions while counting. Return global expected/actual outstanding and retained, per-subject expected/actual outstanding, missing quota rows, and orphan/inconsistent references as scope IDs/counts only. Never return digests/tokens. If mismatch is detected, issue/consume/cleanup routines fail closed until operator review. Any repair function is separate, not executable by runtime/cleanup, and requires an explicitly approved maintenance procedure plus pre/post reconciliation evidence.

### SQL object creation order

1. Create private/API/ops schemas and enum.
2. Add public AuthSession composite unique with the current public schema owner.
3. Create policy, global quota, subject quota and challenge tables; add FKs/checks/indexes.
4. Install policy immutability and challenge immutability triggers.
5. Create functions with fully schema-qualified references, fixed `search_path = pg_catalog, app_private, app_api, app_ops, pg_temp`, no dynamic SQL.
6. In the same migration transaction, revoke PUBLIC function execution and grant precise execute rights.
7. Install catalog assertions and create no operational policy seed until its values are approved. Disposable tests seed only their own fixture policy/global row.

## 6. Database roles and permissions

### Role separation

- **Bootstrap administrator:** local disposable-target provisioning only; not used by backend tests. Never reuse application credentials.
- **Schema migrator:** temporary login for migrations on the verified disposable DB only; not in runtime environment; no superuser/CREATEDB/CREATEROLE. It must have a reviewed `SET ROLE`/ownership path.
- **`ncc_biometric_owner`:** NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT; owns app_private tables and SECURITY DEFINER functions; no runtime member can assume it.
- **Runtime role:** login used by API integration test; USAGE on `app_api`, EXECUTE only issue/consume functions, required SELECT on specifically authorized objects; no direct INSERT/UPDATE/DELETE/TRUNCATE/ALTER on private tables, no owner/migrator membership.
- **Cleanup role:** separate login; USAGE on `app_ops`, EXECUTE only cleanup; no issue/consume, repair, direct DML, owner/migrator membership.
- **Maintenance role:** separate controlled identity for report-only reconciliation and separately approved repair; absent from application environment.

### Row-lock and FK permissions

PostgreSQL does not provide a standalone privilege for `SELECT ... FOR SHARE`; row-locking SELECT also requires UPDATE privilege on at least one column in each locked table. The proposed owner’s SELECT-only grant is insufficient. For the disposable proof, grant only the minimum selected-column UPDATE privilege to the NOLOGIN function owner on User/AuthSession/TrainingSession, and ensure no function body updates those columns. Runtime must not inherit this grant. If the parent-table ownership model cannot support this safely, use a separately reviewed lock-helper owned by the public table owner; do not silently broaden runtime access.

The role creating FKs also needs REFERENCES privilege on referenced public columns or ownership of those public tables. On disposable DB, run baseline Prisma migrations under the controlled schema-owner/migrator, then use a temporary least-privilege REFERENCES grant (User.id; AuthSession.id/userId; TrainingSession.id) for the role that adds FKs, revoking temporary grants afterward where PostgreSQL permits. The existing AuthSession unique constraint requires the current public table owner; a BSR owner role for `app_private` cannot alter a public table it does not own. The production/public-table owner identity is unknown because no DB was inspected; this remains a deployment blocker, while disposable test ownership must be explicit.

### Required negative ACL tests

- Runtime direct INSERT/UPDATE/DELETE/TRUNCATE on all four private tables returns insufficient privilege (`42501`).
- Runtime cannot `ALTER TABLE`, disable triggers, set replication role, create objects in private/API/ops schemas, execute cleanup/reconcile/repair, or `SET ROLE` to owner/migrator/cleanup.
- Cleanup role cannot execute issue/consume/repair or directly mutate any private table.
- Runtime can execute issue/consume only; cleanup can execute bounded cleanup only.
- Verify `has_table_privilege`, `has_schema_privilege`, `has_function_privilege`, `pg_roles` membership and `pg_proc.prosecdef/proconfig` against exact allowlist. Run only on a disposable DB after authorization.

## 7. Application lock-order remediation

### Target global order

All multi-row operations choose their strongest required lock mode once, and acquire rows in this order:

1. All involved `User` rows ascending by ID.
2. All involved `AuthSession` rows ascending by ID.
3. All involved `TrainingSession` rows ascending by ID.
4. `BiometricChallengeGlobalQuota` singleton.
5. All involved `BiometricChallengeSubjectQuota` rows ascending by subject ID.
6. Challenge rows ascending by ID/digest key.
7. `TrainingAttendance` rows ascending by `(sessionId,cadetId)`.
8. Audit inserts last; notifications only after commit.

A routine may start at a later level only if it never subsequently acquires an earlier-level lock. Cleanup takes Global→Subject→Challenge and never locks a User/AuthSession/TrainingSession afterward. Account deletion takes User→AuthSession→Global→Subject→Challenge before deleting restricted parents. TrainingSession closure takes relevant User rows→actor AuthSession→TrainingSession and never acquires quota/challenge locks afterward. Session issue/consume take User→AuthSession→TrainingSession→Global→Subject→Challenge. No code path may lock a challenge/quota and later lock a parent.

### Source trace and required changes

| Path and current evidence | Required transaction change | Files requiring modification |
|---|---|---|
| Logout: `auth.controller.ts::logout` updates AuthSession and audit inside per-token transaction, but no User lock. | For each unique signed sid, lock User `FOR UPDATE`, then exact AuthSession `FOR UPDATE`; recheck owner, expiry/revocation; compare-and-set revoke and audit atomically. Do not clear cookie as proof of server revocation if transaction failed. | `backend/src/controllers/auth.controller.ts`; transaction-aware helper in `backend/src/services/sessionPolicy.ts`. |
| Single session revoke: `revokeMySession` updates AuthSession and writes audit without User lock. | Lock User then target AuthSession; verify caller/target scope and active state inside tx; update and audit in same transaction. | `auth.controller.ts`, `sessionPolicy.ts`. |
| Revoke all: `revokeAllMySessions` array transaction updates sessions/OTP/audit without explicit locks. | Callback transaction: User `FOR UPDATE`, active AuthSessions `FOR UPDATE` sorted, then revoke set, consume login OTPs, audit; recheck count/session state. | `auth.controller.ts`. |
| Password change: password check is outside transaction; array tx updates User then AuthSessions. | Inside callback tx lock User `FOR UPDATE`, re-read/recheck current password hash or compare an optimistic version, lock sessions sorted, then update password/revoke sessions/OTP/audit atomically. Avoid issuing a new session based on a stale pre-change password proof. | `auth.controller.ts`, tests `session-policy.test.ts` and password tests. |
| Password recovery: `resetPassword` claims RecoveryChallenge first, then updates User, AuthSessions and OTPs. | Lock User `FOR UPDATE` first; lock AuthSessions sorted; lock and claim exact recovery challenge; recheck verified/unused/expiry; update password/revoke sessions/OTP/other recovery state/audit atomically. No challenge-store cleanup locks are acquired after biometric locks. | `backend/src/controllers/recovery.controller.ts`. |
| Login OTP/session creation: `otpAuth.controller.ts` creates AuthSession in a transaction and signs JWT after. | Lock/recheck User before inserting AuthSession so it follows User→AuthSession order and cannot race a password/status/deletion transition. Return JWT only for the committed durable session. | `backend/src/controllers/otpAuth.controller.ts`; auth tests. |
| Middleware: `auth.middleware.ts` checks durable AuthSession before controller. | Keep middleware security. Every challenge SQL function rechecks User/AuthSession/TrainingSession under transaction locks; middleware check alone is a TOCTOU precheck. | `backend/src/middleware/auth.middleware.ts` only if context propagation needs correction; no weakening. |
| Manual single mark: `attendance.controller.ts::markAttendance` reads session, cadet, scope and leave before transaction; then upserts attendance, recounts, updates session, audits. | Lock User actor+target in sorted order, actor AuthSession, TrainingSession `FOR UPDATE`; recheck status/eligibility/authorization and leave inside transaction; perform unique attendance upsert/update, counts, audit. Preserve correction/leave rules; stable closed-session conflict. | `backend/src/controllers/attendance.controller.ts`; manual attendance tests. |
| Manual bulk import: `bulkImportAttendance` validates and upserts records sequentially outside one session-level transaction; partial success is current behavior. | Preserve per-record partial success. For each item, lock User keys sorted (actor + cadet), actor AuthSession, TrainingSession, then attendance key; recheck session is open; never hold an unsorted multi-cadet set. | `attendance.controller.ts`; bulk-import race tests. |
| Session close: `endAttendanceSession` reads session/attendance/eligible roster and leave before tx; transaction upserts absences then closes session. | Snapshot eligible IDs, then in tx lock actor+eligible Users sorted, actor AuthSession, TrainingSession `FOR UPDATE`; re-read status/attendance/leave and calculate final set under locks; apply absent rows, close once, counters and audit atomically. If close wins, later marks conflict; if mark wins, it is included. Notifications after commit. | `attendance.controller.ts`; close/mark concurrency tests. |
| Account/user deletion: search found no `user.delete`/`deleteMany` path in inspected `backend/src`; current schema has User→AuthSession cascade. | No silent ORM cascade after adding RESTRICT challenge FKs. Locate any external utility or keep deletion unavailable. If later added: lock User then AuthSessions sorted, revoke/deny new requests, lock Global→Subject→Challenge, purge challenge rows and decrement counters exactly once, then delete AuthSessions/User in the same tx. | No existing deletion controller found; add a dedicated reviewed account-deletion service only if such functionality is required. Keep DB RESTRICT as backstop. |
| AuthSession hard delete: no `authSession.delete/deleteMany` route found; current user relation cascades. | Revoke remains an update. Any future hard-delete path must purge challenge children first under User→AuthSession→Global→Subject→Challenge. | New deletion service if introduced; `auth.controller.ts` only if a current route is later discovered. |
| TrainingSession hard delete: no `trainingSession.delete/deleteMany` path found in inspected `backend/src`. | Keep restrictive FK. If introduced, lock TrainingSession first after any earlier hierarchy rows, Global→sorted Subjects→Challenges, purge then delete session, same transaction. Do not cascade blindly. | New session deletion service if introduced. |
| Challenge issue/consume/cleanup: current Map and disabled routes only. | Implement a store service invoking the single atomic issue function and consume function; no memory fallback; cleanup function uses cleanup role. Keep legacy staff roster-wide routes denied, and do not wire store into attendance in this P0. | `backend/src/services/verificationChallengeStore.ts` replacement/interface; new PostgreSQL store service; later `attendance.controller.ts`/routes only behind separately reviewed disabled boundary. |

The `User`/`AuthSession`/`TrainingSession`/`TrainingAttendance` cascade and FK key-share interactions require real PostgreSQL multi-connection tests. Application lock order alone is not sufficient evidence; FKs and all direct SQL writers must be included in the tests.

## 8. PostgreSQL race-test specification

All PostgreSQL cases below are **future disposable-DB tests**. Use two independent connections (and two app processes for multi-instance claims), barriers rather than sleeps where possible, unique synthetic fixtures, and database-clock boundaries. Keep `ENABLE_BIOMETRIC_ATTENDANCE` false; these tests invoke store functions or manual attendance paths only. Mock/unit tests may test error mapping but cannot prove PostgreSQL locks/counters.

| Test | Setup / race | Exact assertions |
|---|---|---|
| Issue at subject cap | Set fixture policy cap to N; run N+K issue calls concurrently for one subject. | Exactly N issue successes; remaining normal capacity denials; challenge count and subject/global outstanding equal N; retained equals N; never above caps. |
| Issue at global/retained cap | Concurrent distinct subjects at global outstanding or retained boundary. | Exactly available slots succeed; all counters and persisted rows reconcile; no overshoot. |
| Token-bucket race | Concurrent issue calls across connections/instances at refill/burst boundary. | Accepted calls fit DB-time token balance; one combined issue debit per attempt; no separate admission bypass; policy and balance shared. |
| Two consumers | Barrier two transactions after same valid digest lookup/attempt. | Exactly one consume succeeds; exactly one conflict/generic denial; consumedAt set once; outstanding decremented once; retained unchanged. |
| Replay | Consume then submit same raw token/digest again. | Second call denied; no row/counter/audit state mutation beyond allowed security audit; no second verification. |
| Wrong subject/session/auth session | Submit challenge from different User, durable AuthSession, TrainingSession, or purpose. | Generic denial; original challenge remains pending if not expired; no counter change; no identity/digest existence leak. |
| Consume vs expiry boundary | Hold row/quota lock until after DB expiry, release and continue. | Time is captured after all required locks; challenge is denied at `now >= expires_at`; no consume/decrement. |
| Cleanup wins vs consume | Both clients barrier on Global quota; cleanup owns first after row is beyond expiry+retention. | Cleanup deletes one row; consumed state cannot occur; retained and outstanding each decrement once. Consumer denies. |
| Consume wins vs cleanup | Consume owns Global quota while challenge is valid; cleanup follows after consumed-retention eligibility. | Consume succeeds; outstanding decrements once; cleanup later removes consumed row and decrements retained only. |
| Expired but not yet retention-eligible | Challenge expired but retention delay not met; call consume and cleanup. | Consume denies; cleanup does not delete; counters stay outstanding/retained until later eligible cleanup. |
| Two cleanup workers | Two clients process same batch concurrently. | Each row deleted at most once; aggregate counter deltas equal actual deleted rows; counters nonnegative; batch/subject bounds respected. |
| Rollback after quota reservation | Fault/raise after counters update but before challenge insert, in same issue function. | No challenge row; all counters and bucket debit rollback for exception; subsequent issue behaves as if transaction did not happen. Normal cap/rate denials are separately asserted to commit intended refill/debit semantics. |
| Missing Global/policy row | Remove fixture singleton or active policy in isolated test setup, then call issue/consume/cleanup. | Sanitized fail-closed error; no row/counter/token change; no implicit seed or fallback. |
| Missing Subject quota with existing challenge | Create a controlled invariant violation in fixture role, call consume/cleanup. | Function aborts and reports invariant failure; no counter guess/recreation/decrement; no success. |
| Counter reconciliation | Alter fixture counters through owner-only test fixture path, run report-only reconciliation. | Exact drift (global, retained, subject, missing rows) is returned; no automatic mutation; runtime cannot invoke repair. |
| Database outage | Terminate or deny disposable DB connection in a controlled test. | API returns sanitized 503; no raw challenge token; no in-memory fallback or fake success; recovery requires a new issue. |
| Role and direct-write denial | Connect as runtime/cleanup roles. | Runtime direct DML/DDL/escalation fails `42501`; cleanup can only invoke cleanup; permitted functions work with expected outcomes. |
| Logout vs consume | Barrier revoke and consume with consistent parent locks. | If revoke wins, consume denies. If consume wins while session active, it spends challenge; later attendance commit rechecks revoked sid and denies. No deadlock; bounded retries only for 40P01/40001. |
| Session close vs manual mark | Concurrent `markAttendance` and `endAttendanceSession`. | Deterministic lock winner: mark-first included in close result; close-first yields closed conflict; unique attendance and counts correct; manual correction contract preserved. |
| Account deletion vs challenge operation | Controlled fixture-only delete/purge and issue/consume. | Delete-first blocks issue/consume. Challenge-first completes or is consumed, then delete purges children/counters before parent deletion. FK cascade never bypasses purge; no orphan/drift/deadlock. |

### Existing matrix traceability

Retain/revise these existing cases in `BIOMETRIC_BSR05_FINAL_TEST_MATRIX.md`:

- Issue/consume/replay and scope: T05–T15, T33–T38.
- Cleanup races/retention: T16–T19, T39, T59–T60, T73.
- Persistence/outage/rollback: T20–T21, T38–T45, T63–T64.
- Session revocation/close/attendance: T22–T32, T55–T56, T69–T71, T80.
- Constraints, ACL, operational limits: T47–T51, T61, T68, T72, T75, T77–T79.
- Manual fallback and disabled feature: T27–T32, T52–T53, T76.

Revise T35–T37 and T78: authoritative rate-token debit and quota reservation are part of the single issue transaction; an independent issuance function cannot bypass the bucket. Add policy immutability/version tests and tests for consumed-vs-expired retention cutoff, absent/duplicate global policy state, and cross-instance policy mismatch. No T case may flip the feature flag to true.

## 9. Traceability matrix

| P0 finding | Source evidence | Required change | Verification test | Acceptance condition |
|---|---|---|---|---|
| 1. Prisma multi-schema | `backend/prisma/schema.prisma`; `backend/package-lock.json`; earlier scratch result in reconciliation §Scratch Prisma validation | Add `schemas` and annotate all 41 current models + three enums public; annotate all new private models/enum; remove deprecated preview flag unless exact CLI says otherwise. | Scratch copy `prisma validate` with dummy URLs; no database. | Exit 0 using lockfile Prisma 6.19.3; no missing schema warning; actual schema untouched until implementation approval. |
| 2. Split quota architecture | Exact SQL §1–7; Migration §M0–M4; Application Change Map schema/test rows; Harness Design roles/tests; Harness Implementation | Canonicalize four models/tables and remove every polymorphic option/open question; sync counters, policy references, catalog checks, and revised T matrix. | Static documentation search; mocked harness expected-table tests; future disposable catalog assertions. | No relevant artifact describes a polymorphic quota alternative; all name global/subject/challenge/policy and their counter ownership consistently. |
| 3. Retention policy | Exact SQL Global/Subject models and cleanup function §4; Migration §M2; T16–19/T59/T73 | Add immutable versioned policy table and policy FK; include consumed/expired retention and row/subject batch limits; no deployment values seeded until approval. | Prisma scratch validation; disposable CHECK/immutability/retention cutoff tests. | Missing/invalid policy fails closed; expired token never usable; no counter release before eligible cleanup; consumed cleanup decrements retained only. |
| 4. Complete SQL | Exact SQL §3–7 currently fragments/contracts only; Migration §M2 | Produce canonical reviewed DDL/function/trigger/ACL/seed/catalog SQL; no separate gate bypass; table changes atomic with counters. | SQL parse/migration on a separately authorized empty disposable target; T issue/consume/cleanup/reconciliation suite. | Full migration applies once, catalog assertions match, all transitions atomic, rerun/unknown-outcome procedure defined; no existing DB target. |
| 5. Least privilege | Exact SQL §6 grants; Harness roles; PostgreSQL parent-table ownership unknown | Separate bootstrap/migrator/owner/runtime/cleanup/maintenance roles; resolve row-lock UPDATE privilege and FK REFERENCES privilege; no runtime role escalation. | Disposable ACL tests listed in §§6 and 8, including direct DML/SET ROLE failure. | Only intended EXECUTE grants work; all direct DML/DDL/role escalation denied; FK creation succeeds with temporary minimal rights. |
| 6. Application lock order | `auth.controller.ts` logout/revoke/change; `recovery.controller.ts` reset; `otpAuth.controller.ts` session creation; `sessionPolicy.ts`; `attendance.controller.ts` mark/bulk/end; no delete route found | Add transaction-aware locks/rechecks for all extant writers; preserve manual semantics; discover or explicitly gate parent deletes; purge children/counters before restrictive parent delete. | Unit transaction-order mocks plus disposable two-client races T22–32/T55–60/T69–71/T80. | All paths comply with ordered locks, use same transaction, preserve manual attendance, no test deadlock or stale closed-session mark; deletion cannot cascade past live challenge. |
| 7. PostgreSQL races | T01–T80 matrix and challenge Map unit tests; no PG routine exists | Add exact multi-connection assertions from §8; distinguish unit/mock from PG proof; no flag activation. | Disposable PostgreSQL integration and controlled fault/concurrency tests only after authorization. | Every critical race has deterministic barrier-based assertions; counters equal rows; zero over-cap, duplicate consume/decrement, orphan or fallback; all API/database failures fail closed. |

## 10. Unresolved decisions and implementation gates

1. Exact policy values: challenge TTL; global/subject outstanding caps; retained cap; token bucket capacities/refill; consumed/expired retention durations; cleanup row/subject batch limits; lock/statement timeouts. Do not invent or seed production values.
2. Policy governance: who approves policy version/hash, how canonical policy text/config is hashed, and how a version switch is authorized and audited.
3. Parent table ownership/permissions: actual owner of public User/AuthSession/TrainingSession is unknown because this review did not inspect a DB. Decide authorized migration principal, column-level UPDATE lock privilege, and temporary FK REFERENCES grants in the disposable design before database work.
4. Deletion inventory: no user/AuthSession/TrainingSession hard-delete route was found in inspected source. Confirm no separate script/operational utility exists. Until found, retain restrictive FK behavior and block uncontrolled deletion.
5. Locking policy for bulk attendance at large roster sizes: confirm maximum batch and sorted-lock behavior while preserving current partial-success semantics.
6. Global quota-row contention: one global row serializes admission/issue/consume/cleanup for correctness; measure on synthetic disposable fixtures before any optimization.
7. Disposable DB/container creation and migration execution require separate explicit authorization. The current harness remains mock-only and cannot perform these operations.
8. Model licensing, institutional biometric consent, and PAD remain separate gates. No approval is inferred, no real cadet data is used, and this specification does not enable biometric attendance.

## Readiness conclusion

**Specification status: COMPLETE ENOUGH TO BEGIN STAGED P0 IMPLEMENTATION.** Begin with documentation reconciliation, scratch-schema validator tooling, SQL review artifacts, and application lock-helper/test design. Keep schema edits and runtime code separated into reviewable stages. Do not connect a database or run migrations until the schema/retention/SQL/permissions blockers are closed and the disposable target run is separately authorized. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled and manual attendance available throughout.
