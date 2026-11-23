# BSR-05 Nine-Finding Resolution

**Status:** Design correction only. No source/schema files, migrations, database, containers, tests or feature flags were changed. The corrections below resolve the nine findings at specification level only; no correction is implemented or PostgreSQL-verified.

**Result:** A single proposed write boundary, quota lifecycle, role model and lock protocol is now defined. Implementation remains **NO-GO** pending the gates in BIOMETRIC_BSR05_IMPLEMENTATION_GATE.md.

## DB-01 — Conflicting counter write boundary
**Original finding:** Architecture allowed direct challenge DML with trigger counter maintenance; lock specification denied direct DML and required stored routines.

**Problem:** Multiple write paths make limits depend on caller discipline. Triggers firing after challenge-row operations can acquire quota locks in a reverse order. A trigger cannot validate an HTTP JWT identity.

**Correction:** One authoritative boundary: narrow PostgreSQL routines. Runtime API gets no direct INSERT/UPDATE/DELETE on quota or challenge tables. It executes issue, consume, and request-attempt gate functions. Cleanup and account deletion use distinct bounded routines. Triggers are defense-in-depth for legal transitions only and must not introduce locks below a challenge lock. Every routine validates all IDs, bindings, states, time windows, and limits.

**Transaction pseudocode:** begin; lock all required parent rows in canonical order; lock GLOBAL quota, then SUBJECT quota; conditionally increment counters only where count < limit and require exactly one returned row; insert challenge with digest and DB time; commit. Any failed condition raises and the entire transaction rolls back. Never count then insert.

**Prisma/PostgreSQL:** Models describe rows and ordinary relations; functions, checks, trigger functions, ACLs and partial indexes are handwritten SQL migrations. Application uses transaction-scoped function calls, not Prisma model writes for these rows.

**Permissions:** Runtime gets execute-only access to exact function signatures; cleanup gets only cleanup execution. No direct table writes or object ownership.

**Reproducible verification:** As runtime role, direct DML must fail; two independent clients race at the cap and exactly the configured number succeed; fault after reservation must leave neither row nor counter increment.

**Uncertainty:** Function SQL and Prisma driver integration remain unimplemented.

## DB-02 — Initialization, scope integrity and reconciliation
**Original finding:** GLOBAL/SUBJECT row creation, scope constraints and reconciliation were not fully specified.

**Problem:** Missing or duplicate policy state, orphan subject rows, or live counter repair can break availability or allow over-admission.

**Correction:** Migration transaction seeds exactly one GLOBAL row; runtime never creates or repairs it. Startup fails closed if missing, invalid, duplicated, or policy-version-mismatched. Under GLOBAL lock, subject creation uses INSERT ... ON CONFLICT DO NOTHING followed by locked read. Subject key is internal User ID only. Enforce allowed scope/key combinations and positive finite limits with SQL checks. Prefer FK from SUBJECT quota row to User; if relation shape cannot be safely modeled, issue and deletion routines validate the subject and handle orphan cleanup explicitly. Subject rows use a fixed zero/not-applicable retained-counter convention; GLOBAL alone tracks retained rows.

**Reconciliation:** Stop admissions using a DB gate; lock GLOBAL; compare counters to challenge-table counts; emit sanitized mismatch evidence; require reviewed repair; re-read and verify before re-opening. Never repair in request handling. Remove orphan subject quota rows only through controlled maintenance/deletion.

**SQL shape:** CHECK scope GLOBAL implies scope_id='GLOBAL'; SUBJECT implies scope_id<>'GLOBAL'; CHECK counters between zero and their limits; CHECK subject retained_count and retained_limit are zero; unique composite primary key prevents duplicate scope row. Exact schema depends on Prisma relation validation.

**Permissions:** Only migration/maintenance owner seeds policy and repairs. Runtime cannot alter limits/counters except through routines.

**Verification:** Missing GLOBAL row fails closed; duplicate sentinel and invalid values are rejected; concurrent subject initialization creates one row; drift is detected without automatic repair.

**Uncertainty:** Exact User relation/back-relation and legal treatment of orphan quota rows require final schema review.

## DB-03 — Atomic quota operations and rollback
**Original finding:** Counter-row idea lacked executable atomic transition semantics.

**Problem:** Count-then-insert races; unchecked conditional updates can produce false success; repeated consume/delete may decrement twice.

**Correction:** All issue/consume/delete transitions happen in one routine transaction. Lock GLOBAL then SUBJECT rows sorted by subject id. Use conditional UPDATE ... WHERE count < limit RETURNING; require one result. Then insert. Consume uses a conditional one-way update requiring unconsumed, correct digest/bindings, and unexpired DB time; then decrements outstanding once. Delete decrements retained and, if still pending, outstanding once. Counters, challenge state and row insertion/deletion commit or roll back together. No two-phase reservation unless separately designed with a durable idempotent reservation state.

**Rate limit:** Token bucket in DB using one DB timestamp, separate from outstanding/retained counts. Gate debits global and subject tokens before expensive lookup; challenge issue later rechecks auth/session state. If that later transaction fails, the authenticated attempt token remains spent by design. No local fallback.

**Permissions:** Same execute-only routines. No app-side bucket or direct DML.

**Verification:** Multi-connection cap races, double-consume, overlapping delete, failure injected after each write, and row-derived counter reconciliation.

**Uncertainty:** Global row contention and latency/pool envelope are unmeasured.

## DB-04 — Expiry, cleanup and storage limits
**Original finding:** Expiration, cleanup, retained-row cap and physical storage were conflated.

**Problem:** TTL determines validity, not deletion. Expired rows may occupy outstanding capacity until cleanup. Row count does not cap WAL, indexes, backups or total database disk.

**Correction:** Keep independent controls: expiresAt <= DB time always rejects; outstanding includes unconsumed rows until consumed/deleted; global retained count bounds all challenge rows; cap exhaustion returns sanitized capacity-unavailable and never evicts live rows. Cleanup deletes only expired/consumed rows after approved retention. Audit and backup retention are separate. Physical database/WAL/index/bloat capacity has independent monitoring.

**Cleanup transaction:** lock GLOBAL; identify candidate SUBJECT scopes; lock those rows sorted; lock a bounded challenge batch by expiry/id using SKIP LOCKED; only after locks capture one clock_timestamp; recheck expiry and retention; delete and decrement counters atomically. Cleanup must never wait on User/AuthSession/TrainingSession after acquiring quota locks. Account deletion uses parent-first order then quota and deletes children.

**Prisma/PostgreSQL:** Partial indexes and routines are custom SQL. Retention intervals and cleanup batch/frequency need approved values.

**Verification:** exact expiry boundary, delayed cleanup rejection, cleanup/consume race, concurrent cleanup workers, outage backpressure/recovery, capacity alert test.

**Uncertainty:** Retention and physical capacity budgets remain unset.

## DB-05 — Least-privilege database access
**Original finding:** Role ownership, function grants and SECURITY DEFINER handling were incomplete.

**Problem:** Definer functions run with owner privileges. Unsafe search_path, PUBLIC execute, powerful owner, caller-controlled SQL, or runtime table ownership may defeat controls.

**Correction / role matrix:**
- Migration principal: deployment-only DDL, never app credential.
- Object owner: NOLOGIN, minimal privileges, not superuser.
- Runtime API: connect, narrowly scoped reads, EXECUTE issue/consume/attempt-gate; no challenge/quota DML, DDL, trigger control, ownership, replication role, BYPASSRLS or superuser.
- Cleanup worker: separate identity if feasible; EXECUTE bounded cleanup only.
- Audit reader: role-scoped read-only view/function.
- DBA: monitored break-glass.

Use SECURITY INVOKER by default. Use SECURITY DEFINER only where controlled elevation is required. Such function sets a trusted fixed search_path with pg_temp last; schema-qualifies all objects; avoids dynamic SQL; validates all arguments; revokes PUBLIC EXECUTE and grants exact signatures in the same transaction. Owner is NOLOGIN and not superuser.

**SQL ACL shape:** in one transaction, revoke all function privileges from PUBLIC; revoke direct DML on challenge/quota tables from runtime; grant exact execute signatures to runtime and cleanup roles. Exact names/signatures must match migration.

**Verification:** catalog ACL tests for each role; direct DML/ALTER/TRUNCATE/trigger-disable/replication-role attempts denied; hostile temp object cannot affect routine; cross-subject parameters rejected.

**Uncertainty:** Local/runtime role provisioning and separate cleanup credential support have not been inspected.

## DB-06 — Lock order, FK interactions and deletion
**Original finding:** Account deletion order conflicted with session locks; implicit FK locks were not proven.

**Problem:** Existing AuthSession.user and TrainingAttendance relations cascade. New challenge relations RESTRICT. Bare ORM cascades cannot update challenge counters first. FK checks and referential actions create implicit locks, so explicit order alone is not proof.

**Correction:** Canonical order for overlapping operations:
1. All involved User rows, sorted by immutable ID.
2. All AuthSession rows, sorted by ID.
3. All TrainingSession rows, sorted by ID.
4. Quota rows: GLOBAL, then SUBJECT by scope ID.
5. Challenge rows sorted by ID/digest.
6. TrainingAttendance claims sorted by session/cadet.
7. Audit insert last.

Cleanup is an intentional quota-first exception and must never later acquire parent rows. All writers/deletes must be inventoried and either conform or be proven disjoint. Bare User or TrainingSession delete is denied for challenge-referenced rows; controlled routines lock parents, lock quota rows, remove challenges/counters, then remove parent. AuthSession compound owner FK requires @@unique([id,userId]). Session deletion policy must be explicitly handled too.

**Operation pseudocode:**
- Issue: authenticate in middleware; derive user/sid; lock User, matching AuthSession, TrainingSession; recheck roles/status/window/eligibility/consent; lock GLOBAL+SUBJECT quota; atomic quota reservation+challenge insert; commit.
- Consume: derive identity from auth context; lock User/AuthSession/TrainingSession; recheck session; lock quota; lock exact challenge; capture one DB time; validate binding/expiry/state; conditional consume+decrement; commit; inference occurs after commit.
- Logout: lock User then AuthSession; set revokedAt and required audit in same transaction.
- Attendance/manual/finalize: lock involved Users sorted, actor AuthSessions, TrainingSession, unique attendance claims sorted; recheck current authorization; write/correct/finalize and required audit atomically.
- Account deletion: lock User, sessions sorted; lock GLOBAL+SUBJECT quota; delete challenge children/counters; remove subject quota row only when empty and permitted; delete sessions/user in controlled order.
- Cleanup: quota-first bounded path; never acquire parent locks after quota.

**FK/lock verification:** PostgreSQL acquires implicit locks for FK validation/referential actions. Inspect generated SQL and actual waits in disposable PG. New AuthSession composite reference needs a matching unique target even though id alone is PK.

**Deadlock policy:** Set finite local lock_timeout and statement_timeout; no I/O/inference inside transactions. Consistent order is prevention. Retry full transaction only after a confirmed 40P01 or 40001 abort, only if operation is idempotent, with small bounded retries and jitter. Never retry ambiguous commit as fresh. Unknown issue commit returns no token; unknown consume commit treats token as spent. Exhaustion fails closed with sanitized response.

**Verification:** two-connection barriers for deletion/logout/issue/consume/cleanup/close/manual write, capture pg_locks and SQLSTATE; test direct cascade rejection.

**Uncertainty:** Existing attendance/session writers do not yet follow this order; implicit FK behavior awaits PG evidence.

## DB-07 — Prisma/PostgreSQL division
**Original finding:** Prisma cannot represent all required database enforcement.

**Problem:** Schema-only operations may omit or drift custom database objects.

**Correction:** Prisma expresses tables, enums, fields, relations, compound uniques, ordinary indexes and referential actions. Hand-authored migration SQL owns CHECK constraints, partial indexes, stored routines, triggers, ACLs and object ownership. Preserve SQL in migration history; inspect generated SQL; assert catalog state after migration; document introspection warnings. Pin/record lockfile-resolved CLI and client versions. Do not use db push as this feature's migration path.

**Verification:** approved schema validation/generation, disposable migration, catalog assertions, post-change drift review. None run.

**Uncertainty:** Exact compound relation compatibility not validated.

## DB-08 — Disposable database identity
**Original finding:** Current guard cannot prove actual server identity or emptiness.

**Problem:** Local hostname/name substring and confirmation are not attestation.

**Correction:** Dedicated harness must verify unique disposable container/server ID and run label out of band, loopback binding, actual current_database/current_user/server major, empty schema and run-specific marker before first write. Never source repo env files. Separate mock-only suite from DB opt-in suite. Never use ncc_local_dev, persistent ncc_postgres_db/ncc_pgdata, protected DBs, production or backups. No broad npm test with DB opt-in.

**Verification:** negative tests for wrong host/name/role/version/container/schema/marker; first write must be impossible before all assertions.

**Uncertainty:** The harness/identity verifier is not implemented; test-target authorization is outstanding.

## DB-09 — Values, retention and capacity
**Original finding:** TTL, quotas, cleanup, retention, timeouts and policy version remain unset.

**Problem:** Without finite values, admission, availability and storage envelope cannot be accepted.

**Correction:** Require one versioned policy for finite positive TTL, global/subject outstanding caps, global retained cap, global/subject token-bucket capacity/refill, cleanup batch/frequency, lock/statement/pool/request deadlines and accepted burst/load envelope. Missing, zero, negative, unlimited, or mismatched values block startup/issuance. Self-service operator quota is absent/not applicable (zero). Separate challenge validity, row retention, audit retention and backup expiry. Monitor physical disk/WAL/index/bloat independently.

**Verification:** startup rejects invalid/mismatched policy; tests use approved values; cleanup outage and capacity monitoring are exercised.

**Uncertainty:** Values require operational/security/privacy owners; this review selects none.

## Design-level disposition

| Finding | Correction specified? | Implemented/verified? |
|---|---|---|
| DB-01 | Yes: routine-only write boundary. | No |
| DB-02 | Yes: migration seed, scope constraints, stopped reconciliation. | No |
| DB-03 | Yes: conditional atomic quota transitions. | No |
| DB-04 | Yes: expiry, retention, cleanup, storage separated. | No |
| DB-05 | Yes: role matrix and safe function rules. | No |
| DB-06 | Yes: canonical locks, controlled deletion, retries. | No |
| DB-07 | Yes: Prisma/custom SQL boundary. | No |
| DB-08 | Yes: out-of-band disposable DB identity gate. | No |
| DB-09 | Yes: finite versioned limits/retention. | No |

This closes the design ambiguity, not the implementation gate. Exact SQL, runtime roles, finite policy values, test harness, migration and concurrency evidence remain.
