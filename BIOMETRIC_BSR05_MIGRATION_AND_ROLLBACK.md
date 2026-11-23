# BSR-05 Migration and Rollback Plan

**Status:** Preparation only. No schema, migration, database, role, container, or migration command was executed. This plan is local-disposable-only and does not authorize any operation against an existing database.

> **Status note (23 November 2026):** the project-owner operational settings referenced below are now recorded as approved in `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`. This does not supply the missing executable migration, policy/recovery audit schema, role bootstrap verification, application lock implementation, or PostgreSQL test evidence. Do not seed or activate operational policy during migration.

## Scope and gates

This plan implements a shared PostgreSQL challenge store only. It does not enable the attendance route, add consent lifecycle, select a recognition/PAD model, or alter manual attendance. ENABLE_BIOMETRIC_ATTENDANCE remains disabled. Current process-local challenges are not migrated; pending tokens are intentionally invalidated at cutover.

Before implementation, approve: final Prisma model, SQL/function API, role matrix, TTL/caps/rates/timeouts, retention, account/session deletion semantics, and use of a new disposable PostgreSQL target. The earlier repository approval documents do not establish these exact database decisions.

## Migration ordering

### M0 — Freeze assumptions and inspect current migration chain

1. Record exact Prisma CLI/client versions from lockfile; current package.json ranges are not the resolved versions.
2. Review current migration history and schema from files only; do not introspect an existing DB.
3. Decide names, IDs, enum values, field mappings, index design and whether the proposed split global/subject quota tables supersedes the earlier polymorphic table.
4. Confirm all current binaries keep the biometric route disabled; no migration touches existing cadet, attendance, or template rows.

### M1 — Prisma relational schema

Proposed additive items from BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md:

- BiometricChallengePurpose enum.
- BiometricVerificationChallenge model with unique digest, subject, TrainingSession, durable AuthSession, purpose and timestamps.
- BiometricChallengeGlobalQuota singleton model.
- BiometricChallengeSubjectQuota per User model with restrictive FK.
- User/AuthSession/TrainingSession back-relations.
- AuthSession @@unique([id,userId]) required for composite owner relation.
- Ordinary indexes with explicit stable names and lower-case mapped table/columns.

No legacy data backfill and no inferred consent. Validate the model using the exact locked Prisma version before producing a migration. Do not run db push.

### M2 — Custom PostgreSQL migration SQL

One reviewed migration transaction (or ordered migrations if PostgreSQL DDL/role provisioning requires separate privileged deployment) adds:

1. Challenge enum/tables and FKs, using RESTRICT where controlled child deletion is required.
2. Checks for digest format, timestamp ordering, positive finite limits, counter bounds, token bucket ranges, valid singleton key.
3. Unique digest and cleanup/subject/session indexes, including partial pending index if query plan warrants it.
4. Trusted schemas and ownership assignment.
5. Dedicated routines: attempt admission, issue, consume, cleanup, reconciliation report, controlled account/session deletion. Repair routine is separately gated and not executable by runtime.
6. Optional immutable-binding/one-way-consume trigger; triggers never serve as a second write API or acquire locks in an inverted order.
7. Exact function ACLs and PUBLIC revocation.
8. One GLOBAL policy row with approved policy version/hash and exact finite values.
9. Catalog assertions verifying owner/grants/constraints/indexes.

Role creation is environment administration and may not belong in a regular Prisma migration. The disposable harness provisions roles before applying the schema. In a later deployment, role provisioning and grants need a separate approved infrastructure procedure; do not embed credentials in migration files.

### M3 — Application cutover, still flag-off

- Implement and verify the runtime routine adapter.
- Ensure old roster-wide issue/verify/getEligibleBiometrics routes remain disabled and cannot become active from an ENABLE_BIOMETRIC_ATTENDANCE-only change.
- Deploy the shared store code to every test instance while biometric endpoints remain unavailable.
- Drain old processes; invalidate process-local challenges; no dual-write, dual-read or local fallback.
- Verify manual attendance imports, corrections, session closure and marking use their existing behavior and have no challenge-store dependency.

### M4 — Disposable migration and test rehearsal

Only after separate authorization: create a new ephemeral PostgreSQL 16 target with temporary storage and unique identity; verify it out-of-band; apply existing migrations then the approved BSR-05 migration using a migration-only connection; verify catalogs; run T01–T80 applicable tests with synthetic fixtures and runtime/cleanup roles; archive sanitized results; destroy only the exact labeled disposable target.

No existing local DB is a test target. In particular, never use ncc_local_dev, persistent compose service ncc_postgres_db, volume ncc_pgdata, protected DBs, backups, or production.

## Existing-record handling

No challenge rows exist in the proposed schema today. Existing Map entries cannot be migrated because only process memory has them; all are invalidated at cutover/restart. Existing cadet, attendance and template records are not touched. Quota rows start empty; no counters are inferred. Legacy biometrics are outside this migration and remain subject to existing quarantine/policy decisions.

## Rollback and recovery

### Before production data exists

On the disposable target, rollback may drop only objects created by the exact migration/run after confirming the unique target identity. Prefer discarding the ephemeral database/container. Never use broad project database cleanup.

### After any shared challenge data exists

Operational rollback is non-destructive:
1. Disable challenge issue/consume endpoints at the application route/service boundary.
2. Stop cleanup only if needed for diagnosis; retain tables and records.
3. Do not fallback to the process-local Map.
4. Preserve counters, challenge rows and audit metadata until retention/security review.
5. Reconcile counters in offline maintenance mode after diagnosis.

A destructive down migration is not the default rollback. It needs separate approval covering challenge/audit retention, backups, account deletion, and data erasure. Do not drop quota/challenge rows if audit or incident review requires them. A restored older application binary must retain the biometric routes disabled.

### Unknown migration outcome

If connection is lost while applying migration, do not assume rollback or re-run blindly. Check the disposable target's _prisma_migrations and object catalog through the same verified instance; on uncertainty discard only that disposable target and recreate it. Never inspect an existing NCC database to resolve this.

## Backward compatibility and mixed versions

Database shape is additive, so old code may ignore tables, but runtime semantics are not mixed-version safe. A process-local issuer cannot share tokens with the PostgreSQL consumer. Keep both old and new biometric paths denied until every test instance uses the same store. No feature-flag-only activation. Do not remove netlify.toml or modify hosting configuration as part of BSR-05.

## Migration verification checklist

- Exact Prisma relation target (AuthSession id+userId unique) validates.
- Migration creates intended objects with no seed/account/template writes.
- Constraints reject malformed digest, invalid time order, invalid scope/counters, incompatible session owner.
- Global singleton present once; policy hash/version matches all instances.
- Runtime credentials cannot perform direct DML/DDL or trigger manipulation.
- Routine owner is NOLOGIN, non-superuser, and object privileges are minimum.
- Only approved role signatures execute routines.
- Cleanup cannot delete live challenges and counters match rows.
- Rollback leaves no fallback path and does not delete data by surprise.
- Manual attendance regression remains isolated and flag stays false.

## Commands intentionally not executed

Future commands may include prisma validate/generate and prisma migrate deploy, but only after the separate schema/migration approval and disposable harness identity gate. Do not use npm run prisma:migrate (migrate dev), prisma db push, prisma migrate reset, broad npm test with DB opt-in, or any connection string from repository .env files for this work.
