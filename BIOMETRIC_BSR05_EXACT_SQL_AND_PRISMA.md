# BSR-05 Exact SQL and Prisma Blueprint

**Purpose:** Implementation-ready database blueprint for the BSR-05 PostgreSQL challenge store. This is a proposed schema and SQL contract, not an approved migration. Nothing in this file was executed.

**Source of truth:** This document resolves the polymorphic quota-table ambiguity in earlier BSR-05 drafts by splitting the singleton GLOBAL quota from per-user SUBJECT quota rows. The split gives the subject row a real User FK and avoids a pseudo-FK over a scope discriminator. Once reviewed, amend the architecture docs to point here rather than maintain two competing schema forms.

> **Status note (23 November 2026):** the current Prisma schema now includes the split quota, policy, integrity-gate, and canonical attendance-window representations. The operational register supplies approved values. This blueprint remains unexecuted and its older “unselected values” language is superseded by that register; policy must remain inactive until the audited activation path is implemented and verified.

## 1. Required state and invariants

- Every challenge has one cryptographically random raw token returned once; DB persists only its lowercase SHA-256 digest.
- Challenge is bound to one subject User, one TrainingSession, one AuthSession owned by that User, and one purpose.
- Raw token is 32 random bytes from the Node crypto CSPRNG; token encoding is exactly 64 lowercase hex characters. Input length/shape is checked before DB call; digest is computed server-side. Digest is not accepted as a token.
- Challenge creation, GLOBAL and SUBJECT outstanding increments, GLOBAL retained increment, and request accounting are atomic.
- Challenge consumption and both outstanding decrements are atomic and single-use.
- Retention deletion and all corresponding counter decrements are atomic.
- Limits and token bucket policy are database-owned/versioned, not caller parameters.
- Expiration is checked using DB time after locks. Expired rows continue to consume outstanding capacity until they are consumed or deleted by eligible cleanup. This deliberately fails closed during cleanup outage.
- No application role has direct challenge or quota writes. No Map fallback or dual store after cutover.
- This store is not proof of consent, image freshness, liveness, or a biometric match.

## 2. Prisma model proposal

Names are illustrative but should be retained consistently through SQL and application calls. Add the listed back-relations to User, AuthSession, and TrainingSession.

The proposal places new tables/enums in a restricted app_private schema while existing User/AuthSession/TrainingSession remain in public. Prisma 6 multi-schema support must be verified against the resolved CLI/client; if unavailable or incompatible with cross-schema relations, pause and redesign the namespace/ACL boundary rather than silently moving these objects into a writable schema.

    generator client {
      provider        = "prisma-client-js"
      previewFeatures = ["multiSchema"]
    }

    datasource db {
      provider  = "postgresql"
      url       = env("DATABASE_URL")
      directUrl = env("DIRECT_URL")
      schemas   = ["public", "app_private"]
    }

    enum BiometricChallengePurpose {
      ATTENDANCE_1_TO_1

      @@schema("app_private")
    }

    model BiometricVerificationChallenge {
      id                String   @id
      tokenHash         String   @unique(map: "biometric_challenge_token_hash_key") @db.VarChar(64) @map("token_hash")
      subjectUserId     String   @map("subject_user_id")
      trainingSessionId String   @map("training_session_id")
      authSessionId     String   @map("auth_session_id")
      purpose           BiometricChallengePurpose
      createdAt         DateTime @db.Timestamptz(3) @map("created_at")
      expiresAt         DateTime @db.Timestamptz(3) @map("expires_at")
      consumedAt        DateTime? @db.Timestamptz(3) @map("consumed_at")

      subjectUser    User            @relation("ChallengeSubject", fields: [subjectUserId], references: [id], onDelete: Restrict)
      trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Restrict)
      authSession    AuthSession     @relation(fields: [authSessionId, subjectUserId], references: [id, userId], onDelete: Restrict)

      @@index([subjectUserId, expiresAt, id], map: "biometric_challenge_subject_expiry_idx")
      @@index([authSessionId, expiresAt, id], map: "biometric_challenge_auth_expiry_idx")
      @@index([trainingSessionId, expiresAt, id], map: "biometric_challenge_session_expiry_idx")
      @@index([expiresAt, id], map: "biometric_challenge_cleanup_idx")
      @@map("biometric_verification_challenge")
      @@schema("app_private")
    }

    model BiometricChallengeGlobalQuota {
      key                    String   @id @default("GLOBAL")
      policyVersion          String   @map("policy_version")
      policyHash             String   @map("policy_hash")
      maxChallengeTtlMs      Int      @map("max_challenge_ttl_ms")
      globalOutstanding      Int      @map("global_outstanding")
      globalOutstandingLimit Int      @map("global_outstanding_limit")
      retainedCount          Int      @map("retained_count")
      retainedLimit          Int      @map("retained_limit")
      tokenBalance           Decimal  @db.Decimal(18, 6) @map("token_balance")
      tokenCapacity          Decimal  @db.Decimal(18, 6) @map("token_capacity")
      refillPerSecond        Decimal  @db.Decimal(18, 6) @map("refill_per_second")
      refilledAt             DateTime @db.Timestamptz(6) @map("refilled_at")
      updatedAt              DateTime @updatedAt @db.Timestamptz(6) @map("updated_at")

      @@map("biometric_challenge_global_quota")
      @@schema("app_private")
    }

    model BiometricChallengeSubjectQuota {
      subjectUserId      String   @id @map("subject_user_id")
      outstanding        Int
      outstandingLimit   Int      @map("outstanding_limit")
      tokenBalance       Decimal  @db.Decimal(18, 6) @map("token_balance")
      tokenCapacity      Decimal  @db.Decimal(18, 6) @map("token_capacity")
      refillPerSecond    Decimal  @db.Decimal(18, 6) @map("refill_per_second")
      refilledAt         DateTime @db.Timestamptz(6) @map("refilled_at")
      updatedAt          DateTime @updatedAt @db.Timestamptz(6) @map("updated_at")

      subjectUser User @relation("ChallengeQuotaSubject", fields: [subjectUserId], references: [id], onDelete: Restrict)

      @@map("biometric_challenge_subject_quota")
      @@schema("app_private")
    }

Add to User: challengeSubjects BiometricVerificationChallenge[] @relation("ChallengeSubject") and biometricChallengeQuota BiometricChallengeSubjectQuota? @relation("ChallengeQuotaSubject"). Add to AuthSession: biometricChallenges BiometricVerificationChallenge[]. Add to TrainingSession: biometricChallenges BiometricVerificationChallenge[].

Add to the existing AuthSession model (preserving its current fields/indexes/relation):

    biometricChallenges BiometricVerificationChallenge[]
    @@unique([id, userId], map: "AuthSession_id_userId_key")

The existing primary key on id does not meet a composite FK reference to (id,userId). The extra unique is logically redundant but required to express and generate the relation. Add the relation field once; do not duplicate the existing user relation.

Prisma-specific review still required for relation names, compound relation and SQL type mapping against the exact lockfile-resolved Prisma CLI/client. Do not edit schema in this planning task.

## 3. PostgreSQL table constraints and indexes

The migration should use mapped lower-case names above. Required constraints:

    ALTER TABLE app_private.biometric_challenge_global_quota
      ADD CONSTRAINT biometric_challenge_global_singleton
      CHECK (key = 'GLOBAL');

    ALTER TABLE app_private.biometric_challenge_global_quota
      ADD CONSTRAINT biometric_challenge_global_limits
      CHECK (
        max_challenge_ttl_ms > 0
        AND global_outstanding_limit > 0
        AND global_outstanding BETWEEN 0 AND global_outstanding_limit
        AND retained_limit > 0
        AND retained_count BETWEEN 0 AND retained_limit
        AND token_capacity > 0
        AND token_balance BETWEEN 0 AND token_capacity
        AND refill_per_second > 0
      );

    ALTER TABLE app_private.biometric_challenge_subject_quota
      ADD CONSTRAINT biometric_challenge_subject_limits
      CHECK (
        outstanding_limit > 0
        AND outstanding BETWEEN 0 AND outstanding_limit
        AND token_capacity > 0
        AND token_balance BETWEEN 0 AND token_capacity
        AND refill_per_second > 0
      );

    ALTER TABLE app_private.biometric_verification_challenge
      ADD CONSTRAINT biometric_challenge_digest_format
      CHECK (token_hash ~ '^[0-9a-f]{64}$');

    ALTER TABLE app_private.biometric_verification_challenge
      ADD CONSTRAINT biometric_challenge_time_order
      CHECK (
        expires_at > created_at
        AND (consumed_at IS NULL OR
             (consumed_at >= created_at AND consumed_at < expires_at))
      );

The TTL maximum is dynamic, so a simple row CHECK cannot reference the global policy row. Enforce maximum TTL inside the issue routine; use a DB trigger only if an independent table-level invariant is required. Do not claim a cross-table policy CHECK exists.

Add:

    CREATE INDEX biometric_challenge_subject_pending_idx
      ON app_private.biometric_verification_challenge (subject_user_id, expires_at, id)
      WHERE consumed_at IS NULL;

    CREATE INDEX biometric_challenge_auth_session_idx
      ON app_private.biometric_verification_challenge (auth_session_id, id);

The unique token_hash constraint and Prisma-mapped cleanup index above are created by Prisma migration SQL; do not create them a second time in hand-authored SQL. Do not add redundant duplicate indexes. The global outstanding and retained counters mean hot-path quota checks must not COUNT the table. Use EXPLAIN (ANALYZE only on disposable synthetic data) before retaining additional indexes.

Important correction: SQL CHECK constraints cannot reference a separate quota-policy row. Global singleton uniqueness is provided by a singleton key CHECK plus primary key; TTL-policy consistency belongs in the routine and policy-version startup check. Cross-table owner identity is enforced by the composite AuthSession FK.

## 4. Routine API and transaction contracts

Use a private schema, e.g. app_private, for tables and owner-only helper functions; expose only narrow functions in app_api/app_ops.

### Attempt gate

    app_api.admit_biometric_attempt(p_subject_user_id text)
      RETURNS TABLE (admitted boolean, retry_after_ms bigint)

Under one DB transaction: lock the User row FOR SHARE; lock GLOBAL quota FOR UPDATE; ensure a subject quota row exists via INSERT ON CONFLICT DO NOTHING; lock SUBJECT quota FOR UPDATE; read one clock_timestamp; refill both balances capped at capacity, debit one token only when both buckets can admit, save balances/refill timestamps, and return generic admitted/denied. The global lock must precede subject-row creation/locking. A denial is a normal result so refill state can commit; missing policy or invariant errors raise and fail closed. This gate is before expensive lookups, but it does not authorize the request. The issue routine later revalidates user/session/session scope.

The attempt gate uses a short transaction separate from issue to limit DB work on rejected authenticated requests. Thus a later authorization/issue failure still spends the attempt token. It never increments outstanding or retained counts.

Do not pass a client current time, rate limit, policy version, or operator identity. The DB function reads policy from the singleton row. Subject tokens are not reset on revocation. Policy updates are maintenance-only and versioned.

### Issue routine

    app_api.issue_biometric_challenge(
      p_challenge_id text,
      p_subject_user_id text,
      p_auth_session_id text,
      p_training_session_id text,
      p_token_hash text
    ) RETURNS TABLE (expires_at timestamptz)

Within caller transaction, in this order:
1. Lock User FOR SHARE; verify eligible account/role according to API contract.
2. Lock the exact AuthSession with both id and userId, FOR SHARE; verify not revoked and expires_at > DB time.
3. Lock TrainingSession FOR SHARE; verify status/window.
4. Lock GLOBAL quota FOR UPDATE.
5. Ensure subject quota row exists; lock it FOR UPDATE.
6. Read DB time. Validate digest syntax, purpose constant, policy consistency, and the policy maximum TTL.
7. Refill and debit request/challenge token buckets if the attempt gate is not a separate prior transaction; choose one design and avoid double-debit.
8. Conditionally increment global outstanding, global retained, and subject outstanding. Each UPDATE has count < limit and RETURNING; require one returned row per counter, else raise a typed cap exception.
9. Insert challenge using DB now and expiry derived from DB-owned max TTL.
10. Return expiry. Any exception rolls back all writes in this call/transaction.

API creates the challenge ID (UUID text) and raw token with Node crypto before call, hashes the token, calls the routine, commits, then returns raw token once. The explicit ID is required because Prisma's uuid() default is generated client-side and a raw SQL insert must not assume that default exists in PostgreSQL. If commit outcome is unknown, do not return the token. The persisted digest row remains accounted until expiry/cleanup.

### Consume routine

    app_api.consume_biometric_challenge(
      p_subject_user_id text,
      p_auth_session_id text,
      p_training_session_id text,
      p_token_hash text
    ) RETURNS TABLE (challenge_id text, consumed_at timestamptz)

Within one transaction: lock User, AuthSession and TrainingSession FOR SHARE; revalidate all live states; lock GLOBAL then SUBJECT quota FOR UPDATE; capture clock_timestamp after quota waits; select exact challenge by digest and all bindings FOR UPDATE; require unconsumed, correct fixed purpose, created_at <= now < expires_at; conditionally update consumed_at only when still null and still unexpired; require one affected row; decrement global and subject outstanding exactly once with lower-bound checks; return limited internal result; commit before inference. Missing, wrong binding, expired, replay and revoked state produce generic external response. Internal reason codes must not contain digest/token.

No attendance is written by this challenge routine. Final attendance persistence is a later, separate transaction that must recheck durable session, session status, consent/enrollment, eligibility and unique attendance claim.

### Cleanup routine

    app_ops.cleanup_biometric_challenges()
      RETURNS TABLE (deleted_count integer)

No caller-supplied deletion predicate, cutoff, or unrestricted table name. Read policy retention/batch from approved DB policy. Lock GLOBAL first; identify eligible subject IDs; lock corresponding subject rows sorted; lock bounded challenge rows ordered by expiry/id; capture DB timestamp after locks; recheck retention/expiry. Delete only consumed rows older than consumed retention or unconsumed rows expired beyond expired-row retention. Decrement global retained for every row; decrement global+subject outstanding only for rows not previously consumed. Commit deletion and counters together. If one subject quota is missing, abort and alert; don't guess/recreate during cleanup.

Because every challenge transition takes GLOBAL first, cleanup can use ordinary FOR UPDATE for selected challenge rows after acquiring the gate; SKIP LOCKED is optional if nonconforming writers are possible but must not obscure a drift condition. Bound both batch row count and distinct subjects. Exact SQL must prove aggregate decrements match deleted rows. Cleanup outage causes capacity backpressure.

### Controlled parent deletion

Account/session deletion is not the age-based cleanup worker. In the same application transaction, the authorized deletion service first locks all involved User rows FOR UPDATE and their AuthSession rows sorted, updates account/session state as required to deny new issue calls, then invokes a bounded app_ops.purge_subject_challenges(subject) or app_ops.purge_session_challenges(session) routine. The routine takes GLOBAL then affected SUBJECT rows sorted, deletes child challenges and updates counters, and removes an empty subject-quota row only if approved. The caller then deletes restricted AuthSession/User/TrainingSession rows and commits. A caller must not call purge after already taking a challenge/quota lock. Cleanup worker cannot execute parent-purge functions. These functions do not delete account or attendance rows themselves.

This is a trusted backend transaction contract: PostgreSQL cannot prove that the caller previously acquired every application-level parent lock unless the lock acquisition is inside the database routine. The source lock inventory must verify every caller uses this order. If the application cannot guarantee the same-transaction precondition, consolidate parent lock acquisition and purge into a separately reviewed definer function or postpone the parent deletion path; never silently use an ORM cascade.

### Reconciliation routine

Offline maintenance only, after admissions are stopped and a maintenance gate acquired. Compare globalOutstanding to count of unconsumed challenge rows, retainedCount to all challenge rows, and each subject outstanding to its subject's unconsumed rows. Emit only scope IDs/counts and run ID; no token/digest. Default operation is report-only. A separate reviewed repair operation may set exact counters after explicit authorization and a second consistency check. No auto repair at startup or request path.

## 5. Error semantics

- Invalid/missing/revoked session or scope: generic denial; no new challenge.
- Quota/rate exhausted: controlled 429 or capacity 503 according to distinct internal reason.
- DB unavailable, lock timeout, missing policy, counter drift or routine error: sanitized 503, no memory fallback.
- Serialization/deadlock confirmed abort: bounded whole-transaction retry only for idempotent operations.
- Unknown issue commit: no token returned. Unknown consume commit: token treated spent.
- Never expose token, digest, SQL text, constraint names, provider data, or account existence.

## 6. Role and function SQL shape

Role creation is for a fresh disposable target or separately approved deployment administration; it is not executed by this task. Credentials must be provisioned out of band and never embedded in migration SQL.

    CREATE ROLE ncc_biometric_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ncc_biometric_migrator
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ncc_biometric_runtime
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ncc_biometric_cleanup
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

    CREATE SCHEMA app_private AUTHORIZATION ncc_biometric_owner;
    CREATE SCHEMA app_api AUTHORIZATION ncc_biometric_owner;
    CREATE SCHEMA app_ops AUTHORIZATION ncc_biometric_owner;
    REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
    REVOKE CREATE ON SCHEMA app_private FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO ncc_biometric_owner;
    GRANT SELECT ON TABLE public."User", public."AuthSession",
      public."TrainingSession" TO ncc_biometric_owner;
    GRANT USAGE ON SCHEMA app_api TO ncc_biometric_runtime;
    GRANT USAGE ON SCHEMA app_ops TO ncc_biometric_cleanup;
    REVOKE ALL ON ALL TABLES IN SCHEMA app_private
      FROM PUBLIC, ncc_biometric_runtime, ncc_biometric_cleanup;

The controlled migration owner creates/makes the challenge objects owned by ncc_biometric_owner, which is NOLOGIN and not superuser. The owner receives only needed rights to challenge/quota tables. The DB routine can use SELECT ... FOR SHARE on User/AuthSession/TrainingSession to serialize against updates/deletes without granting parent-table UPDATE; confirm privileges and implicit locks on the actual PostgreSQL version. Runtime's shared application role may already need other non-biometric rights; this least-privilege boundary must still ensure it has no direct DML on these new private objects.

The role/schema statements are not a self-contained migration: CREATE SCHEMA AUTHORIZATION and later ownership transfer require the executing migration principal to own or be a member of the target owner role and have the required database/schema privileges. Provision that membership through a separate controlled bootstrap, use a reviewed SET ROLE/ownership-transfer sequence, and revoke temporary membership afterward. Validate the exact sequence on the disposable harness; do not grant the runtime role owner membership. Prisma migrate does not implicitly SET ROLE for the application.

SECURITY INVOKER is the default. Issue/consume functions likely require SECURITY DEFINER so the API role can mutate only through function checks while lacking table DML. Each definer function must be owned by ncc_biometric_owner and use a fixed function-level path such as:

    SECURITY DEFINER
    SET search_path = pg_catalog, app_private, app_api, app_ops, pg_temp

All table/function references are still schema-qualified in the body. Revoke default PUBLIC execution and grant the exact identity in the same transaction:

    BEGIN;
    REVOKE ALL ON FUNCTION app_api.issue_biometric_challenge(text,text,text,text,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION app_api.consume_biometric_challenge(text,text,text,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION app_api.admit_biometric_attempt(text) FROM PUBLIC;
    REVOKE INSERT, UPDATE, DELETE ON app_private.biometric_verification_challenge,
      app_private.biometric_challenge_global_quota,
      app_private.biometric_challenge_subject_quota FROM ncc_biometric_runtime;
    GRANT EXECUTE ON FUNCTION app_api.issue_biometric_challenge(text,text,text,text,text)
      TO ncc_biometric_runtime;
    GRANT EXECUTE ON FUNCTION app_api.consume_biometric_challenge(text,text,text,text)
      TO ncc_biometric_runtime;
    GRANT EXECUTE ON FUNCTION app_api.admit_biometric_attempt(text)
      TO ncc_biometric_runtime;
    GRANT EXECUTE ON FUNCTION app_ops.cleanup_biometric_challenges()
      TO ncc_biometric_cleanup;
    GRANT EXECUTE ON FUNCTION app_ops.purge_subject_challenges(text)
      TO ncc_biometric_runtime;
    GRANT EXECUTE ON FUNCTION app_ops.purge_session_challenges(text)
      TO ncc_biometric_runtime;
    COMMIT;

Signatures must exactly match final function definitions; these statements are illustrative ACL shape, not runnable migration SQL. CREATE FUNCTION and ACL changes must occur in one transaction so PUBLIC does not receive an access window. Runtime must not be a member of owner/migrator/cleanup roles. Cleanup worker cannot call repair or issue/consume. Migration role is absent from runtime environment.

Prisma's @updatedAt behavior is client-side. Raw SQL routines must set updated_at explicitly using the same database timestamp used for their quota transition; no routine may assume Prisma will populate it.

## 7. Required migration-owned SQL objects

- Two quota tables and challenge table.
- AuthSession compound unique index.
- Relations/FKs with restrictive challenge-parent delete behavior.
- Row-local CHECK constraints and indexes.
- Functions: attempt gate, issue, consume, bounded cleanup, reconciliation report, separately gated repair.
- Controlled challenge-child purge routines for authorized account/session deletion; cleanup worker cannot execute them.
- Optional transition trigger that rejects mutation of immutable challenge bindings and consumedAt reversal; it must not be the primary counter writer.
- Role ownership and grants.
- A single initialized GLOBAL policy row with approved immutable version/hash and numeric values.
- Catalog verification assertions.

**No values or actual SQL have been applied.** The SQL above defines behavior and shapes, not a runnable migration.
