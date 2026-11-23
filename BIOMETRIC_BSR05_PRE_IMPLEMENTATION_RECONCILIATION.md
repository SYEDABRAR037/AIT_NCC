# BSR-05 Pre-Implementation Reconciliation

**Review type:** Read-only artifact, schema, and source reconciliation  
**Scope:** BSR-05 shared PostgreSQL challenge-store preparation  
**Database access:** None. No database was connected to, inspected, or modified.  
**Migration/container/package actions:** None. No migration, container, install, or model operation was performed.  
**Code/schema changes:** None. This report is the only file created by this review.

## Executive result

**Final readiness: READY FOR DISPOSABLE HARNESS IMPLEMENTATION — code and mocked tests only.**

The proposed harness can be implemented as an isolated, fail-closed local tool without applying a migration or connecting to any database. The current guard is not sufficient by itself; the harness must implement the independent Docker/container/database identity attestation described in its design and must not construct a Prisma client before attestation.

**The challenge-store schema, migration, and PostgreSQL test run are NOT READY.** The current Prisma blueprint does not validate as written with multi-schema enabled, the retention policy referenced by cleanup is absent from the proposed models, full function/DDL definitions are not supplied, role grants conflict with row-locking queries, and the current authentication/attendance writers do not follow the proposed lock protocol. Correct and validate these items before any database provisioning, migration, or integration-test execution.

## Critical requirement status

| Requirement | Status | Evidence and consequence |
|---|---|---|
| Separate global and per-subject quota tables are the selected design | **PASS** | `BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md` §1–3 specifies `BiometricChallengeGlobalQuota` and `BiometricChallengeSubjectQuota`; it explicitly supersedes the polymorphic proposal. |
| The split is consistently closed across all four artifacts | **FAIL** | `BIOMETRIC_BSR05_MIGRATION_AND_ROLLBACK.md` §M0 still asks the implementer to decide whether the split supersedes the polymorphic form. The application map refers generically to “quota models”; the harness does not name the two tables or their counters. No direct alternate table design is proposed in those latter documents, but the cross-document decision is not closed. |
| Proposed Prisma relations and multi-schema syntax | **FAIL as written; PASS after scratch correction** | See “Scratch schema validation.” The blueprint omits `@@schema("public")` from every existing model and enum after declaring multiple schemas. The proposed relations themselves validated after adding those annotations in a temporary copy. |
| Challenge bindings and relational uniqueness | **PASS at model-design level** | Proposed challenge references subject User, TrainingSession, and composite AuthSession `(id,userId)`; it adds `AuthSession @@unique([id,userId])`. Scratch validation accepted those relations. SQL constraints/FKs were not executed or database-validated. |
| Issuance, consumption, cleanup counter semantics | **PASS as intended pseudocode; NOT VERIFIED in PostgreSQL** | Exact blueprint §4 makes issue + increments, consume + decrements, and cleanup + deletion transactional; expired rows retain quota until cleanup. No routines exist in application code, and no DB test was run. |
| Request-rate accounting is atomic with challenge creation | **FAIL / wording conflict** | Exact blueprint §1 says request accounting is atomic with challenge creation. §4.1 and §4.2 explicitly place the attempt-gate debit in a separate prior transaction, retained even if issue fails. The intended separate-gate behavior should be stated consistently. |
| Retention policy is represented in schema | **FAIL** | Cleanup reads consumed/expired retention and batch policy, but neither proposed quota model contains consumed-retention, expired-retention, or cleanup-batch fields, and no separate policy model is defined. |
| Current application follows the proposed lock order | **FAIL** | Logout, individual/all-session revocation, password change/recovery, attendance marking, and session closure do not acquire the documented parent/quota locks in that order. Details below. |
| Account/session deletion is safely integrated with RESTRICT challenge FKs | **NOT VERIFIED / BLOCKED** | The new design requires controlled purge before deleting parents; no matching account-deletion or challenge-purge path exists in the inspected controller/service scope. Existing User→AuthSession cascade would be blocked by child challenge RESTRICT FKs until coordinated. |
| Exact SQL is implementation-ready | **FAIL** | The “Exact SQL” artifact contains Prisma snippets, constraint fragments, routine signatures/contracts and illustrative grants, not complete `CREATE TABLE`/`CREATE FUNCTION` definitions. Important routine queries and ACL preconditions remain prose. |
| Disposable test target is protected against accidental existing DB use | **PASS as a design goal; NOT VERIFIED as implementation** | Harness design requires a local engine, pinned already-present image, fresh labeled container, loopback port, tmpfs/no persistent volume, direct and forwarded identity comparison, DB OID, empty schema, manifest and post-migration re-attestation. The harness does not exist yet. |
| Current generic database guard alone proves target isolation | **FAIL** | `backend/src/databaseSafety.ts` validates URL syntax/local host/name/opt-in but does not attest server/container identity, database OID, emptiness, or run ID. Its `postgres-test` hostname is not intrinsically proof of loopback. The harness design correctly says not to rely on it alone. |
| PostgreSQL concurrency tests exist and ran | **NOT VERIFIED** | The application map calls the integration test future; no disposable harness or PostgreSQL challenge tests exist in the inspected paths. Existing challenge tests exercise the process-local Map, not PostgreSQL. |

## Artifact reconciliation and exact corrections

### 1. `BIOMETRIC_BSR05_EXACT_SQL_AND_PRISMA.md`

**Section 1 — Required state and invariants**

- The statement that challenge creation, quota increments, and “request accounting” are atomic conflicts with §4.1–4.2, where token-bucket admission is a separate transaction. Change it to: *challenge row, global/subject outstanding counters, and global retained counter commit atomically; the earlier attempt-gate debit is a separate committed transaction and is not refunded when later authorization or issue fails.*
- Section §4.1 repeats its full first paragraph twice. Remove the duplicate to avoid ambiguity.

**Section 2 — Prisma model proposal**

- `schemas = ["public", "app_private"]` requires each model and enum to declare its schema. The scratch validation failed when the proposed addition was applied without public annotations. Add `@@schema("public")` to every existing public model and enum in the implementation diff (or provide a different supported namespace strategy); keep new objects in `app_private`.
- `multiSchema` is deprecated as a preview feature in the locally installed Prisma CLI 6.19.3; the validator warns it is now available without the preview flag. Decide whether to omit `previewFeatures = ["multiSchema"]` for the resolved version, then validate with the exact project lockfile version and generate the client only in a later approved implementation step.
- Add actual retention/batch-policy fields or a separate immutable policy table/model and relation. Include allowed ranges, nullability, index/uniqueness, policy-version/hash constraints, and update semantics.
- Explicitly document that global singleton key CHECK plus PK permits **zero** rows; startup and every routine must fail closed on absent or duplicate policy state. The proposed routine text says missing policy errors, but there is no enforceable “exactly one row” constraint for the zero-row case.

**Section 3 — PostgreSQL constraints and indexes**

- Reconcile the Prisma indexes `(auth_session_id, expires_at, id)` and `(training_session_id, expires_at, id)` with the handwritten `(auth_session_id,id)` index and the migration’s generic index list. State one canonical index inventory, distinguish required from query-plan-dependent, and avoid duplicate indexes.
- The global quota row lacks checks for a canonical policy hash format and positive/valid retention/batch values because those values are not present yet. Add after policy representation is resolved.
- Confirm SQL FK and CHECK definitions exactly match Prisma mappings, including referenced constraint names and `ON DELETE RESTRICT`. No actual SQL was run.

**Section 4 — Routine API and transaction contracts**

- Replace contracts with complete, reviewable SQL/function bodies before migration approval. The current text does not show exact update predicates/`RETURNING`, counter aggregation, trigger behavior, `ON CONFLICT` handling, or function signatures for purge/reconciliation/repair.
- Define transaction ownership explicitly: PostgreSQL functions cannot independently commit; caller must execute each routine call in a transaction and must not return a challenge token until commit acknowledgement. Clarify that a single SQL statement’s implicit transaction is acceptable only if API behavior and unknown-commit handling are defined.
- Attempt admission uses a global row lock and therefore serializes all subjects. This is coherent for correctness but a throughput/availability hotspot. Put performance/load bounds and lock/statement timeouts in the decision list; do not weaken atomicity to optimize without tests.
- Specify a keyset/CTE or equivalent exact cleanup selection and ensure the cleanup batch limits both challenge rows and distinct subject rows. Prove deletes and counter deltas use the same selected IDs, including when consumed rows and expired pending rows are mixed.

**Section 6 — Role and function SQL shape**

- `ncc_biometric_owner` is granted only SELECT on public parent tables, but issue/consume need `SELECT ... FOR SHARE`. PostgreSQL row-locking SELECT requires UPDATE privilege as well as SELECT. Add the narrowly justified required privilege (or redesign the lock owner/function boundary), and verify it with the disposable PostgreSQL role tests. Do not grant broad parent-table DML to runtime.
- Creating FKs to public tables requires appropriate REFERENCES privilege for the role creating those constraints (or table ownership). The shown owner grant is SELECT only. Define which role creates FKs and grant the minimum REFERENCES rights for migration, then revoke temporary rights as appropriate.
- The migration/principal/owner arrangement remains illustrative rather than runnable. Specify role membership/`SET ROLE`, who owns schemas, tables, functions, and migration history, and exact grants/revokes for default privileges. Verify functions are not publicly executable at any point and no runtime role can `SET ROLE` to owner/migrator.

**Section 7 — Required migration-owned SQL objects**

- Include retention policy representation, canonical index names, exact policy seed/constraints, and role bootstrap prerequisites. The present list says “two quota tables” but does not carry the table names into migration acceptance assertions.

### 2. `BIOMETRIC_BSR05_MIGRATION_AND_ROLLBACK.md`

**§M0 — Freeze assumptions**

- Remove the open decision to choose between a split and polymorphic quota table. The user-designated source of truth is the split global and subject quota tables, subject to the blockers in this report.
- Replace generic “policy values” with explicit, still-unselected categories: challenge TTL; global and subject outstanding caps; global/subject token-bucket parameters; retained-row cap; consumed and expired retention; cleanup row/subject batch sizes; lock/statement timeouts. Values remain unset until deliberately configured.

**§M1–M2 — Schema/SQL**

- List the exact three table names, constraints, FKs, retention-policy fields, canonical indexes, and parent-schema annotation change required by Prisma multiSchema.
- State role row-lock and FK REFERENCES privilege corrections, and distinguish schema migration principal from function owner and bootstrap administrator.
- Do not call the migration additive/ready until actual SQL/function bodies and `prisma validate`/migration rehearsal pass on the disposable target.

**§M4 and rollback**

- The plan is appropriately explicit that there are no old Map entries to migrate and no fallback after cutover. Keep this. Clarify test matrix source/version and exact T01–T80 case inventory; that matrix is not included in the four reviewed artifacts.
- “Check target migration status/catalog” after an uncertain migration must use the same already-attested target and credential only. This is stated in principle; harness implementation must enforce target ID/OID equality for diagnostic reads too.

### 3. `BIOMETRIC_BSR05_APPLICATION_CHANGE_MAP.md`

**§Current paths and planned changes / schema and tests rows**

- Name the chosen models explicitly: `BiometricChallengeGlobalQuota`, `BiometricChallengeSubjectQuota`, `BiometricVerificationChallenge`. Tie each planned routine and test assertion to the actual split counters.
- Update bootstrap row to emphasize current import-time behavior in `testScriptBootstrap.ts`; ensure no Prisma client is constructed until after harness attestation, not merely after URL-shape validation.
- Add the separate attempt-gate transaction semantics and test that its debit is not confused with outstanding/retained challenge counters.
- Do not describe current application limits as subject quotas: the existing Map’s `perOperatorLimit` actually counts `binding.userId` (currently the authenticated staff operator in the legacy route). The planned self-service design derives subject from the authenticated cadet, so this is a contract change. Document that there is no separate operator quota in the proposed split models; decide if staff/operator throttling is needed for any staff-mediated API.

**§Lock-order change inventory**

- Mark every listed lock sequence as proposed, not existing. Add references to the source paths below. Current logout/session revocation, password reset, manual mark and close transactions do not yet follow these sequences.
- Include the actual attendance writer behavior: mark checks session/cadet/leave outside its write transaction, then upserts attendance and updates the session counter; close reads session/attendance and computes the absent roster outside its write transaction, then upserts attendance and marks the session closed. Recheck closed status and serialize writers/closure under a consistent transaction lock before treating the order as enforced.
- State the account-deletion path is unlocated in the inspected controller/service scope and must be located or explicitly scoped out before the RESTRICT-FK migration. Do not rely on ORM cascade as the purge implementation.

### 4. `BIOMETRIC_BSR05_DISPOSABLE_DB_HARNESS_DESIGN.md`

**§Provisioning and pre-write identity attestation**

- The desired safeguards are appropriately stronger than the current URL guard. Implement them only in a dedicated child-process environment allowlist; do not inherit arbitrary `DATABASE_URL`, `DIRECT_URL`, `NCC_UTILITY_DATABASE_URL`, Prisma shadow URL, `PG*`, Docker host/context overrides, or dotenv configuration. Parent-shell absence checks should be defense in depth, not the sole guarantee.
- Use the exact locally inspected Docker context endpoint and image ID in the run manifest. Require host-forwarded URL to use the attested loopback port; do not permit the generic guard’s `postgres-test` alias for the actual integration connection.
- Clarify that starting a fresh ephemeral PostgreSQL container performs its own internal cluster initialization. The no-write gate should mean no application-issued DDL/DML, migration, fixture, or Prisma write before direct and forwarded identity attestation; it cannot mean PostgreSQL performs no internal bootstrap writes.
- “Schema empty” must be defined precisely: expected system catalogs only, no user tables/types/functions outside an allowlist, and no unexpected Prisma migration state. Specify whether baseline migrations are applied before or after the marker; the same manifest/OID/container checks must guard both.

**§Workflow commands and cleanup**

- The listed `provision`, `attest`, `migrate`, `test`, `teardown` commands are future design commands, not implemented commands. Avoid presenting them as executable until those scripts exist. The initial code-only milestone should test mocked provision/attestation decisions without starting Docker.
- Add a test for the exact URL passed to every child process and Prisma call; reject ambient URL fallback and redacted-log leakage. Keep exact-container teardown and no-prune guarantees.

## Scratch Prisma validation

A temporary copy of the current `backend/prisma/schema.prisma` was created outside the repository, amended with the proposed challenge enum/models, relations, `AuthSession @@unique([id,userId])`, `schemas = ["public", "app_private"]`, and `@@schema("public")` on every existing public model and enum. It was validated with the already-installed local Prisma CLI **6.19.3** using dummy URLs at `127.0.0.1:9`; validation did not connect to a database. The scratch directory was removed afterward.

- **Result with proposed multi-schema declaration but without public schema annotations:** FAIL — Prisma reported every existing model and enum missing `@@schema`.
- **Result after adding public annotations in scratch:** PASS — schema valid; CLI warned that `multiSchema` is deprecated as a preview feature in this version.
- **Scope limitation:** This validates Prisma syntax and relation compatibility only. It does not validate generated SQL, PostgreSQL FK privileges, custom constraints/functions, migration execution, role behavior, or runtime transactions. No actual schema file was changed.

## Current implementation and transaction findings

### Challenge store

- `backend/src/services/verificationChallengeStore.ts` is an in-memory `Map`; it hashes random 32-byte tokens with SHA-256, deletes a challenge on consumption, and prunes expired challenges.
- Its constructor’s `perOperatorLimit` counts `challenge.userId`; in the currently mounted legacy route, `issueVerificationChallenge` binds that field to the authenticated staff operator. It is process-local and cannot enforce cross-instance limits.
- `backend/src/controllers/attendance.controller.ts::issueVerificationChallenge` and `::verifyFaceAttendance` return `BIOMETRIC_AUTOMATION_DISABLED` while the feature flag is off. Existing challenge cleanup is a process-local interval. There is no PostgreSQL challenge store, quota model, or database cleanup worker.
- Thus current behavior is fail-closed at the route gate, but the proposed shared quota/counter behavior is not implemented or runtime-verified.

### Authentication session revocation

- `backend/src/controllers/auth.controller.ts::logout` updates AuthSession and writes audit in a transaction but does not first lock User.
- `revokeMySession` likewise updates AuthSession within its transaction without a User lock.
- `revokeAllMySessions` uses an array transaction for session/OTP/audit updates without an explicit User-before-AuthSession lock.
- `changeMyPassword` updates User then AuthSession in an array transaction; order is closer to the proposed parent-first protocol but is not an explicit lock-and-recheck contract.
- `backend/src/controllers/recovery.controller.ts` claims the recovery challenge, then updates User, then revokes AuthSession rows. This order differs from the proposed operation-wide User → AuthSession hierarchy and must be reconciled before concurrent challenge/session revocation is tested.
- `backend/src/services/sessionPolicy.ts::revokePresentedSession` is compare-and-set on AuthSession only; it is not transaction-aware and does not acquire User first.

### Attendance finalization and manual writes

- `markAttendance` reads session status, eligibility, scope and leave before its transaction. Its write transaction upserts TrainingAttendance, recounts, updates TrainingSession, then writes audit. It does not lock/recheck the TrainingSession before writing. A concurrent close can therefore race with stale pre-transaction state; this is a relevant existing BSR-07 lock-order/concurrency gap, separate from the disabled biometric route.
- `endAttendanceSession` reads the session, attendance and eligibility before its write transaction, computes absent candidates, then upserts attendance rows and updates TrainingSession to CLOSED. It does not acquire an actor/session lock protocol or recheck ACTIVE status under lock in the transaction.
- These real manual paths are not yet compatible with the future lock protocol. Their preservation and regression testing are required; this review made no changes.

### Account deletion and cascade

- Current `AuthSession.user` uses `onDelete: Cascade`; the proposed challenge FKs use `onDelete: Restrict`. A User deletion that cascades to AuthSession will be blocked while challenge rows reference either parent. The proposal correctly requires a same-transaction, controlled purge first, but no matching account-deletion/purge path was located in the inspected auth/admin controller and service search. **NOT VERIFIED** whether another deletion utility exists elsewhere.
- Before migration, locate all user/session/training-session delete paths and make them call an authorized purge routine in the specified transaction order, or prevent those parent deletions until a reviewed alternative is implemented.

## Counter lifecycle and drift assessment

| Transition | Intended counter effect | Atomicity in proposal | Drift/double-decrement risk to resolve/test |
|---|---|---|---|
| Attempt admission | Global and subject token-bucket balances only; no outstanding/retained change | Separate admission transaction | It intentionally remains debited if later issue fails. Correct the §1 atomicity wording. |
| Issue | `globalOutstanding +1`, `subject.outstanding +1`, `retainedCount +1`, and one challenge row | One issue routine transaction | Safe if all writes are inside one transaction and direct DML is denied. Need exact SQL ensuring each guarded update returns one row and rollback happens if insert fails. |
| Time passes / challenge expires | No immediate counter change; expired pending row still counts against outstanding | Deliberately unchanged until cleanup | Must be explicit in API/backpressure docs; expiration alone does not decrement. This is fail-closed but cleanup outage can exhaust capacity. |
| Consume valid pending challenge | `globalOutstanding -1`, `subject.outstanding -1`; retained unchanged; set `consumedAt` once | One consume transaction | Require conditional `consumed_at IS NULL AND expires_at > db_now`, exactly-one-row update, and decrements only after that row claim; enforce nonnegative counters. |
| Consume replay/wrong binding/expired | No counter change; no successful result | Intended no-op/denial | Exact SQL must not decrement when a digest exists but binding fails or a concurrent worker already consumed it. |
| Cleanup old consumed challenge | `retainedCount -1`; outstanding unchanged | Delete and counter update in same cleanup transaction | The same selected/deleted IDs must determine deltas; retries after commit must not decrement twice. |
| Cleanup expired unconsumed challenge | `retainedCount -1`, global and subject outstanding each `-1` | Delete and all counters in one cleanup transaction | A cleanup/consume race is serialized by global quota lock in the intended protocol; prove this with two clients. |
| Purge parent-bound challenges | Retained decrements per row; outstanding decrements only pending rows; quota-row deletion policy | Proposed transaction contract, no implementation | Define missing quota behavior, consumed row handling, subject quota row deletion, and RESTRICT/cascade order in executable SQL. |
| Transaction abort / DB outage | No committed change to challenge row or paired counters | PostgreSQL atomic transaction | No implementation evidence. Ensure API fails closed; never local fallback. |
| Reconciliation | Compare counters to challenge table counts; repair separate and explicit | Offline maintenance | Specify locks/admission stop gate and policy row behavior; report-only default. Test artificial drift on the disposable DB. |

## Disposable harness and database-isolation assessment

**Design quality: directionally strong. Implementation readiness: code-only harness work may proceed. Database execution remains blocked.** The design’s independent engine/container/port/OID/schema/manifest checks are materially stronger than the repository guard.

Current guard evidence (`backend/src/databaseSafety.ts`, `testScriptBootstrap.ts`):

- Requires explicit disposable opt-in and confirmation, rejects many conflicting DATABASE_URL/DIRECT_URL values, and uses a fail-closed mock URL in ordinary tests.
- URL validation checks PostgreSQL protocol, permitted local hostname, and a database name containing `test` or `mock`; it does not verify the database instance or emptiness.
- `testScriptBootstrap.ts` sets test mode and prepares environment at import time when opted in. A future harness must not import this as a way to make a real connection before attestation.
- `backend/src/db.ts` / script clients were not invoked. No DB connection occurred.

Required harness implementation gates before any later DB connection:

1. Build only the harness and pure mocked tests first; no Docker start and no Prisma client construction.
2. Use an allowlisted child-process environment with no `.env` loading and no inherited DB/Docker/PG target overrides.
3. Reject nonlocal Docker context/endpoint, `DOCKER_HOST`, missing preinstalled pinned image, non-loopback host binding, unexpected volume, mismatched container ID/labels/run ID, or unexpected image ID.
4. Compare direct `docker exec` and forwarded connection identity (database name, OID, role, major version, host port/container identity) before application migration/fixture writes.
5. Verify the schema/user-object allowlist and migration state; bind it to the run manifest and a non-secret per-run marker.
6. Re-attest the identical target before migrations, tests, diagnostics, and teardown; remove only the exact harness-owned container and temporary run directory.
7. Keep integration mode unavailable to ordinary `npm test`; no broad test command or environment marker alone may authorize database access.

The harness design does not establish a new database exists, and this review did not create or inspect one. Existing local/development/protected DBs and backups were not accessed.

## Prioritized blockers and corrections

### P0 — Before any schema/migration or PostgreSQL integration execution

1. **Fix the multi-schema proposal:** add public schema annotations to all existing models/enums in the eventual schema diff, settle preview flag handling, rerun scratch `prisma validate`, and inspect generated SQL only on a disposable target later.
2. **Close quota source-of-truth references:** update Migration §M0 and name both quota models/tables consistently in migration, app map, harness acceptance assertions and test matrix. Remove polymorphic decision language.
3. **Resolve missing retention policy data:** define fields/table for consumed retention, expired retention and cleanup row/subject batch sizes; retain exact values as deployment configuration decisions. Add checks and seed/version integrity.
4. **Provide executable SQL:** complete table DDL, constraints, functions, trigger policy, ownership/default privileges, ACL, seed and catalog assertions. Current contracts are not a runnable migration.
5. **Correct least-privilege parent access:** prove `FOR SHARE` privileges; add minimum UPDATE privilege or redesign function role, and provide REFERENCES privilege to the FK-creating role. Verify runtime cannot directly mutate biometric objects or assume owner/migrator roles.
6. **Resolve lock-order integration:** adapt/logout/revoke-all/password reset/recovery and attendance mark/finalize flows to explicit lock-and-recheck transactions or otherwise formally isolate them from challenge operations. Include account/session/training-session deletion and FK cascade behavior.
7. **Specify and run counter-race tests on a disposable target:** concurrent issue admission, concurrent consume, consume-vs-cleanup, cleanup retry, failure rollback, reconciliation, retained-cap exhaustion, missing quota row, and database-unavailable fail-closed behavior.

### P1 — Before harness provisions a container or makes any database connection

1. Implement and pass pure mocked harness safety tests, with the child environment allowlist, exact-target identity checks, no dotenv, no fallback, sanitized logs and exact teardown.
2. Reconcile current generic guard behavior with harness-specific target verification; do not treat `ALLOW_DISPOSABLE_TEST_DB`, DB name, or host name as attestation.
3. Define the precise empty-schema/catalog allowlist, baseline migration and marker order, and exact expected role/OID comparisons.
4. Confirm all test commands call only the dedicated runner and no existing project URL variables are propagated.
5. Obtain separate authorization before actually creating the disposable DB/container and executing migrations/tests.

### P2 — Documentation and operational decisions

1. Remove duplicate attempt-gate prose and reconcile rate accounting wording.
2. Publish one canonical index inventory and explain any optional/performance index.
3. Decide numeric operational values for TTL, per-subject/global caps, token bucket refill/capacity, retained cap, retention, cleanup batch sizes, lock and statement timeouts.
4. Decide whether any staff/operator quota is required after moving from legacy operator-bound challenges to subject-bound self-service challenges.
5. Define reconciliation alerting, maintenance window and explicitly authorized counter repair procedure.

## Working-tree preservation

The working tree already contained numerous modified and untracked project files before this reconciliation. Those were preserved. No application source, Prisma schema, migrations, environment configuration, feature flag, database, container, or Git history was changed. The Prisma scratch file was created under `/tmp` and removed. The only new repository artifact is this report.
