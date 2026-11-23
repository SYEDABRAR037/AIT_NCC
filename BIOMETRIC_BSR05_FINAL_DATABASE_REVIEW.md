# BSR-05 Final PostgreSQL Database Security and Feasibility Review

**Review status:** Read-only design review. No source/schema files were changed; no database was contacted; no container, migration, or test was run.

**Recommendation: NO-GO for implementation/migration today.** The final design is plausible, but its counter mutation boundary is inconsistent across documents, lock order is not demonstrated against implicit FK/trigger locks, and policy, retention, privilege, and test-target prerequisites remain unresolved. This is a design finding, not evidence of a live exploit. ENABLE_BIOMETRIC_ATTENDANCE must remain disabled; manual attendance remains independent.

## Scope and evidence inspected

Reviewed the six requested design/security documents, backend/prisma/schema.prisma, backend/package.json, and backend/src/databaseSafety.ts. The package declarations are Prisma 6.x (prisma ^6.19.3 and @prisma/client ^6.4.1); the datasource is PostgreSQL with DATABASE_URL and DIRECT_URL. Current AuthSession has a primary key on id, userId FK to User with onDelete Cascade, and indexes on [userId, expiresAt] and [expiresAt]; it does not declare the proposed compound unique [id,userId]. TrainingSession.status is String; TrainingAttendance has unique [sessionId,cadetId]. There is no PostgreSQL challenge model, routine, trigger, or integration test.

The existing test guard checks URL protocol, local hostname and a database-name substring, explicit opt-in/confirmation, and URL conflicts. It does not attest server/container identity, emptiness, role, or version. The readiness report correctly requires independent identity checks before writes. No environment-file contents were read.

## Findings

### DB-01 — Counter mutation boundary is inconsistent
**Severity: HIGH**

**Evidence:** BIOMETRIC_BSR05_FINAL_ARCHITECTURE.md says the application role may insert/consume/delete challenge rows and a trigger updates counters. BIOMETRIC_BSR05_FINAL_LOCK_ORDER.md recommends execute-only stored routines and denies direct DML. These are different security boundaries.

**Impact:** Direct DML that bypasses intended routines, or a trigger running in an unexpected privilege context, can desynchronize counters or acquire locks in the wrong order. A trigger is not an authenticated API and cannot validate the caller's JWT principal.

**Correction:** Select one authoritative database boundary. Preferred: non-login schema/table owner; runtime API role has no direct INSERT/UPDATE/DELETE on quota or challenge tables and only EXECUTE on narrowly scoped issue, consume, cleanup, and deletion routines. Triggers may provide defense-in-depth for allowed transitions, not an alternate write API. Functions validate relational bindings and permitted state transitions. Runtime must not own tables, alter schema, disable triggers, set replication role, or hold superuser/BYPASSRLS privileges.

**Verification:** Catalog ACL tests as actual API/cleanup roles; prove direct DML is denied and only intended function signatures mutate rows. Review argument binding and trigger call paths. Not verified.

### DB-02 — Counter initialization, scope integrity, and reconciliation are underspecified
**Severity: HIGH**

**Evidence:** The quota model requires one GLOBAL row and SUBJECT rows, but no exact idempotent seed procedure exists. Subject quota rows have no declared User FK; valid scope/scopeId formats and GLOBAL sentinel uniqueness are described generally, not as final constraints. Missing rows/drift are to fail closed, but no fully safe reconciliation procedure is defined.

**Impact:** Missing policy rows block availability; orphan rows leak metadata/storage; concurrent auto-initialization or live reconciliation can drift counters or over-admit.

**Correction:** Migration inserts exactly one GLOBAL policy row transactionally; no runtime auto-init for it. Create SUBJECT rows with INSERT ON CONFLICT DO NOTHING and then lock/read under the global-first protocol. Enforce valid scope/id pairs and bounds in DB. Define outstandingCount as count of unconsumed rows and GLOBAL retainedCount as all challenge rows. Reconcile only with admissions stopped and global gate held: compare, report, perform reviewed repair, recheck, then resume. Never silently reset in request handling. Delete subject rows only through approved account-retention workflow.

**Verification:** Migration seed/idempotency checks; missing/duplicate row denial; counter-vs-table reconciliation after every transition and injected rollback; orphan row cleanup test.

### DB-03 — Atomic counter transitions are feasible but not specified as executable SQL
**Severity: HIGH**

**Evidence:** Global and subject rows could serialize issuance and transitions, but the design does not provide routine definitions, affected-row handling, or trigger SQL. Issuance, consume and cleanup touch counters and challenge records.

**Impact:** Count-then-insert can over-admit. Conditional updates that do not check returned row counts can report success at capacity. Repeated consume/delete could double-decrement or underflow. Global quota row can become a latency/pool bottleneck.

**Correction:** Use one transaction and one authoritative routine. Lock GLOBAL then SUBJECT in deterministic order; refill rate tokens using one DB timestamp; reserve counters with conditional updates that return/check exactly one row; insert or transition/delete the challenge in the same transaction. Enforce nonnegative and upper bounds. Consume is one-way and decrements once. Use DB time. Set bounded lock, statement, pool and request deadlines. READ COMMITTED is plausible only with consistent explicit locks and rechecks. Do not use count-then-insert as an invariant.

**Verification:** Two-client boundary races for issue/consume/delete; exactly cap successes; assertions on each counter transition and rollback; load/lock test of global contention.

### DB-04 — Expiry, cleanup, retained-row cap and physical storage are different controls
**Severity: MEDIUM**

**Evidence:** Expired rows count against outstanding capacity until consumed/deleted; cleanup failure should backpressure. The retained counter bounds rows in one table, not indexes, WAL, backups, audit tables or total disk. Cleanup must lock global, subject rows, then challenge rows.

**Impact:** Cleanup outage should reduce availability, not allow stale token use or exceed row bounds. A wrong lock order can deadlock with consume/delete. Immediate deletion may violate a separate challenge/audit retention requirement. Logical row cap is not a disk quota.

**Correction:** Always reject at expiresAt <= DB time, independent of cleanup. Define separate retention for consumed/expired rows, audit and backups; avoid storing detailed biometric failure data in challenge rows. Cleanup uses bounded deterministic batches, approved lock order, SKIP LOCKED, and rechecks DB time and retention after locks. Never evict live rows or bypass cap. Monitor physical storage, bloat, WAL and backups independently.

**Verification:** Expiry equality, cleanup-consume race, outage/backpressure/recovery, retention cutoff, and capacity-monitoring review.

### DB-05 — Least-privilege routine and role design is incomplete
**Severity: HIGH**

**Evidence:** Documents flag SECURITY DEFINER, search_path and role separation as requiring review; no final role/ACL matrix exists.

**Impact:** SECURITY DEFINER executes with function owner privileges. Unsafe name resolution, writable search_path, PUBLIC execution, powerful owner, dynamic SQL, or caller-controlled arguments can create privilege escalation. If runtime owns tables or can disable triggers, counter invariants are bypassable. Cleanup privileges should not be granted broadly to API.

**Correction:** Separate migration owner, runtime API, cleanup worker, audit reader and break-glass DBA. Use a minimally privileged NOLOGIN object owner, not superuser. Prefer SECURITY INVOKER; where DEFINER is necessary, schema-qualify objects, pin a safe search_path with trusted schemas and pg_temp last, revoke PUBLIC EXECUTE and grant exact signatures in the same migration transaction, validate arguments, and avoid dynamic SQL. Cleanup worker gets EXECUTE on bounded cleanup only, not arbitrary DELETE.

**Verification:** Catalog ACL tests under each role; hostile temp-object/search_path test; prove runtime cannot ALTER/TRUNCATE/disable triggers/change owner/set replication role; assert function owner privileges. Requires PG.

### DB-06 — Lock order is a target protocol, not proof; current cascades matter
**Severity: HIGH**

**Evidence:** Proposed User → AuthSession → TrainingSession → Quota → Challenge → Attendance → Audit ordering is explicit. Existing AuthSession.user and TrainingAttendance relations cascade on parent deletion. New challenge FKs are RESTRICT. Composite AuthSession owner FK needs @@unique([id,userId]); current schema lacks it. PostgreSQL additionally takes implicit locks for FK checks and referential actions. Existing source paths do not all use the proposed protocol.

**Impact:** Bare User.delete can cascade AuthSessions while a challenge FK blocks it. TrainingSession deletion has the same issue for challenge references. Cleanup must not acquire a parent lock after quota. Implicit locks, triggers, batch operations and existing writers can still form cycles despite prose ordering.

**Correction:** Inventory every user/session/attendance writer and delete/cascade path. Route deletion through controlled routines that remove challenge children/counters before parents. Decide FK actions for TrainingSession deletion too. Lock all User IDs sorted, then all AuthSession IDs, then session IDs, etc. Cleanup remains quota-first and never waits for parent rows. Verify actual generated SQL and FK/trigger effects with PG barriers.

**Verification:** Two-client races for account deletion/logout/issue/consume/cleanup/session close/manual write; inspect pg_locks and SQLSTATE; direct cascade must be rejected as designed. No tests were run.

### DB-07 — Prisma handles relational core, not all PostgreSQL enforcement
**Severity: MEDIUM**

**Evidence:** Prisma declarations are v6. Models, enums, relations, compound unique keys, ordinary indexes and FK actions are representable. Prisma v6 docs list procedures, triggers, views and partial indexes as unsupported in Schema Language/Migrate; PostgreSQL CHECK constraints are not represented in Prisma schema/migrate.

**Impact:** Prisma schema alone cannot prove these controls. Subsequent migrate/dev, db push, introspection or migration regeneration may omit/drift manually maintained SQL. The version ranges should be checked against the exact lockfile-resolved CLI/client.

**Correction:** Model tables/relations/ordinary indexes in Prisma. Keep CHECKs, partial indexes, triggers, procedures, ACLs and ownership in reviewed SQL migration history; add catalog assertions and drift checks. Record exact locked Prisma versions and inspect generated SQL. Never assume a schema regeneration preserves custom SQL.

**Verification:** Authorized schema validate/generate, disposable migration diff, catalog checks, drift review. Not run.

### DB-08 — Database identity guard alone is insufficient for integration writes
**Severity: HIGH (test-safety gate)**

**Evidence:** databaseSafety.ts validates local host/database-name substring, explicit opt-in and matching URLs, but not actual server/container identity, schema emptiness, role, or version. Readiness document acknowledges this.

**Impact:** A wrong local DB with a test-like name can pass preliminary checks. This is a safety gap, not evidence that any DB was touched here.

**Correction:** Dedicated harness requires a fresh disposable PostgreSQL target and independently verifies unique container/server identity, current database, role, version, loopback-only binding, empty schema and run-specific marker before first write. Separate mock-only test run from disposable DB run. Never use ncc_local_dev, persistent ncc_postgres_db/ncc_pgdata, protected DBs, production or backups.

**Verification:** Negative preflight tests for wrong identity/role/version/schema/marker and proof first write occurs only after verification. This review made no DB connection.

### DB-09 — Retention and runtime values remain undecided
**Severity: MEDIUM**

**Evidence:** Remaining-decisions register leaves TTL (30 seconds proposed), global/per-subject outstanding caps, global retained cap, token-bucket capacity/refill, cleanup frequency/batch size, challenge/audit/backup retention, timeouts/pool budget and policy version open. Per-operator quota is correctly absent/zero for self-service 1:1.

**Impact:** Without finite values, admission/load/storage behavior cannot be accepted. TTL does not define row deletion or backup erasure.

**Correction:** Approve finite versioned limits and deployment capacity assumptions; reject missing, zero, negative, unlimited or mismatched values. Keep audit and backup retention distinct. Do not invent values in engineering code.

**Verification:** Startup mismatch rejection and boundary/refill/retention tests using approved synthetic values.

## Quota lifecycle assessment

| Lifecycle | Required behavior | Result |
|---|---|---|
| Initialization | Exactly one GLOBAL row seeded by migration; race-safe SUBJECT creation; no runtime global auto-init. | Not precise enough; DB-02. |
| Issuance | Global+subject locks, one DB time, conditional reservation, insert and commit atomically. | Feasible if routine checks affected rows; SQL absent. |
| Concurrent issue | Shared quota row serializes instances; never count then insert. | Feasible; global contention needs load evidence. |
| Consume | Match digest/bindings; one-way conditional consume; decrement once in same transaction. | Feasible if direct DML prohibited. |
| Expiration | Expired token rejected independent of cleanup; expiry alone does not decrement counter. | Fail-closed; cleanup outage can block service. |
| Cleanup | Bounded batch; approved quota/challenge order; recheck expiry/retention; decrement with delete. | Exact SQL unverified. |
| Rollback | Reservation and challenge mutation roll back together. | Needs PG evidence. |
| Reconciliation | Compare table-derived counts only while admissions stopped/global lock held; reviewed repair. | Procedure missing. |
| Hard bounds | Outstanding limits plus retained row cap bound challenge rows. | Requires routine/ACL integrity; does not bound total disk/WAL/backups. |

## Recommended database role matrix

| Role | Minimum access |
|---|---|
| Migration principal/object owner | DDL and routine/trigger setup only; not app credentials. Prefer controlled NOLOGIN owner. |
| Runtime API | Connect and execute narrow issue/consume routines; restricted reads only where needed; no direct challenge/quota DML or DDL. |
| Cleanup worker | Execute bounded cleanup routine only. |
| Audit reader | Read-only role-scoped views/functions over minimized metadata. |
| DBA | Separate monitored break-glass access; repair only under stopped admissions and reviewed procedure. |

Official PostgreSQL guidance notes SECURITY DEFINER executes as owner, search_path can permit object masking, and PUBLIC receives EXECUTE by default unless revoked. See [CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html) and [function security](https://www.postgresql.org/docs/16/perm-functions.html).

## Locking and migration feasibility

The lock order is sensible as a protocol but not proven. PostgreSQL explains row-level deadlocks and recommends consistent acquisition order; FK checks/referential actions introduce locks beyond explicit ORM code. See [explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html), [constraints](https://www.postgresql.org/docs/16/ddl-constraints.html).

Before migration: validate/declare AuthSession @@unique([id,userId]); add proposed tables and ordinary indexes/FKs; hand-author SQL for constraints, partial indexes, functions, triggers, owner/ACLs, and initial global policy row. Challenge FKs use restrictive deletion, so both User and TrainingSession deletion need explicit child cleanup. Migration is additive but mixed binaries are unsafe. Rollback should stop shared challenge operations and retain tables/data; never fall back to process-local Map. Dropping retained evidence requires separate approval.

Prisma v6 explicitly requires custom migrations for unsupported database features: [unsupported features](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features) and [feature matrix](https://www.prisma.io/docs/orm/v6/reference/database-features).

## Retention categories

1. **Challenge validity:** proposed 30-second maximum, subject to approval; DB time is authoritative.
2. **Outstanding count:** includes expired rows until consume/delete; cleanup lag may cause backpressure.
3. **Consumed/expired row retention:** distinct from token validity; duration unresolved.
4. **Failed verification evidence:** avoid detailed biometric/provider payload in challenge rows; minimized audit is separate.
5. **Audit retention/access:** separate approved period and role scope; never raw token/digest/biometric payload.
6. **Backup expiry/restore:** deleting live rows does not erase backups; separately governed.
7. **Physical storage:** row cap is not a disk, WAL, index-bloat or backup cap; monitor separately.

## Test feasibility: every T01–T80

No tests were run. PG means disposable PostgreSQL; MC means at least two DB connections; OP means process/network/operational harness. Every DB run requires independent target identity checks. No test may enable production attendance.

| IDs | Test class | Boundary |
|---|---|---|
| T01 | Unit + mocked API disabled-route | Route absent; only contract unit/no-side-effect behavior until implementation. |
| T02–T04 | Mocked API authorization/disabled gate | Future routes; assert zero roster/template query and mutation. |
| T05–T09 | PG integration authorization/binding | Requires consent/enrollment primitives and synthetic fixtures. |
| T10 | PG integration + authorization | Consent/template lifecycle prerequisite. |
| T11–T19 | PG + MC | Store persistence, expiry, consume, cleanup; deterministic barriers. |
| T20 | PG + OP restart | Two process lifetimes, same disposable database. |
| T21 | PG + MC + OP multi-instance | Shared challenge/quota across backend instances. |
| T22–T23 | PG + MC | Session revocation/consume ordering and final authorization recheck. |
| T24 | PG + MC; actual biometric endpoint deferred | Generic DB claim can run flag-off; actual biometric mark cannot. |
| T25 | PG integration | Closed-session challenge rejection. |
| T26 | PG + MC; endpoint deferred | Same boundary as T24. |
| T27 | PG + MC | Manual session close/write race; flag-off safe. |
| T28 | PG + MC for manual duplicate; biometric half deferred | Do not create biometric attendance. |
| T29 | PG + MC | Manual correction/finalization policy. |
| T30 | PG + MC + OP | Manual import concurrency; preserve per-record partial-success semantics. |
| T31–T34 | PG + MC | Auth-session/finalizer order and cap admission. |
| T35–T37 | Unit + PG + MC | Token math unit tests; atomic refill/debit in PG. |
| T38 | PG transaction test | Reservation/insert rollback, no drift. |
| T39 | PG + OP fault injection | Cleanup outage and cap backpressure/recovery. |
| T40 | Unit/API + PG | Distinguish known quota 429 from DB/timeout 503. |
| T41–T42 | PG + OP fault injection | DB unavailable, no success or memory fallback. |
| T43–T44 | PG + OP network faults | Pre-commit abort vs ambiguous commit. |
| T45 | Unit + PG + OP | Known rollback vs unknown commit handling. |
| T46 | PG audited manual transaction; biometric half deferred | Manual audit rollback can run flag-off. |
| T47–T49 | PG integration | Constraints, FK, deletion, retention decision. |
| T50 | PG + MC + OP fault injection | Deadlock schedules; retry only confirmed 40P01/40001 abort. |
| T51 | PG + OP load/fault | Requires approved timeouts/pool/load envelope. |
| T52 | Mock/API + healthy DB | Provider outage must not block manual attendance; total DB outage not promised. |
| T53 | Unit + mocked API | Disabled route/no mutation, feature flag unchanged. |
| T54 | Unit + mocked API | Future staff denial/anti-impersonation. |
| T55–T56 | PG + MC | Account deletion/issuance; status change/authorization. |
| T57 | Startup/config + PG multi-instance | Policy mismatch blocks issue. |
| T58 | Unit + PG + MC | Token-bucket envelope and concurrency. |
| T59 | PG + OP fault injection | Cleanup outage plus retained cap. |
| T60 | PG + MC | Quota/cleanup order and stable rows. |
| T61 | PG security integration | Direct SQL constraints and routine validation. |
| T62 | PG/service flag-off; actual endpoint deferred | Generic consent/template state race only; no actual biometric endpoint claim. |
| T63 | PG + OP fault injection | Rollback vs post-commit network loss. |
| T64 | PG preflight + OP | Server/container identity and empty schema; gate before any writes. |
| T65 | API + OP multi-version; PG if stateful | Legacy Map path rejected, no fallback, flag off. |
| T66 | Unit/API log capture + integration | No token/digest/biometric payload in logs/traces/responses. |
| T67 | Unit + mocked API | Digest as bearer token rejected generically. |
| T68 | PG + OP performance | Capacity queries, plan/index evidence, bounded latency. |
| T69–T71 | PG + MC | Delete vs logout/consume and FK/key-share behavior. |
| T72 | PG + MC | Concurrent exact cap boundary. |
| T73 | PG + OP fault injection | Cleanup outage/recovery and retained cap. |
| T74 | PG + MC + OP multi-instance | Shared token-bucket admission. |
| T75 | PG + MC + OP fault injection | Deadlock/retry behavior; unknown commit never retried as fresh. |
| T76 | Mocked API + route inspection | Legacy endpoints denied flag-off, no data reads/writes. |
| T77 | PG privilege test | Requires provisioned least-privilege runtime/cleanup roles. |
| T78 | PG + MC + OP multi-instance | Invalid-session request flood and shared attempt bucket. |
| T79 | PG integration | Missing row/counter drift fails closed; no live repair. |
| T80 | PG + MC | Account deletion with multiple sessions/challenges. |

Only T24, T26, biometric portion of T28, and actual endpoint portion of T62 are explicitly activation-dependent in the matrix. They remain deferred; this does not authorize enabling a production flag. T01–T10, T54, and T76 are not API evidence until routes/services exist. T43–T45/T63 need fault injection; mocks cannot prove commit ambiguity. T64 is a prerequisite gate; T77 needs real ACLs. A finite test run supports only the schedules exercised, not universal deadlock absence.

## Exact implementation prerequisites

1. Resolve DB-01 to a single write boundary and approve role/ACL matrix.
2. Specify exact SQL for global initialization, subject row lifecycle, conditional counter transitions, constraints, cleanup and reconciliation.
3. Inventory all User/AuthSession/TrainingSession/Attendance mutation and deletion paths; define controlled deletion for both User and TrainingSession.
4. Approve finite TTL, outstanding/retained caps, token-bucket rate/capacity, cleanup schedule, timeouts/pool budget, policy version, challenge/audit/backup retention, and account deletion behavior. This review does not choose values.
5. Validate Prisma relations and exact lockfile-resolved CLI/client versions; maintain unsupported SQL in migration history.
6. Obtain separate migration and disposable-test authorization. Build a dedicated guarded harness and provision a new uniquely identified loopback-only ephemeral PostgreSQL database with verified identity and empty schema. Do not use any existing NCC database or volume.
7. Execute applicable synthetic-fixture tests from T01–T80, capture lock waits/SQLSTATE/counters/ACLs/rollback/cleanup; leave biometric attendance disabled and manual attendance independent.
8. Review rollback and mixed-version behavior; rollback must stop shared challenge processing without restoring insecure Map fallback.

## References

- [PostgreSQL 16 CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html)
- [PostgreSQL 16 function security](https://www.postgresql.org/docs/16/perm-functions.html)
- [PostgreSQL 16 explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html)
- [PostgreSQL 16 constraints](https://www.postgresql.org/docs/16/ddl-constraints.html)
- [Prisma ORM v6 unsupported database features](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features)
- [Prisma ORM v6 database feature matrix](https://www.prisma.io/docs/orm/v6/reference/database-features)

**Final decision: NO-GO.** Proceed only after the design and approval prerequisites above are closed. This review created only this report and did not change source, schema, migrations, environment, database, feature flags or tests.


## Review update against the 2026-11-23 amendments

The architecture, lock specification, and matrix now contain a binding amendment that post-dates the original review. This section is the current assessment; it supersedes earlier statements that DB-01's counter write boundary was still ambiguous at the document level. The amendment resolves that design contradiction, but does not provide executable SQL or verification. The body above remains evidence about repository state at review time.

### Finding closure status after amendment

| Finding | Severity | Current design disposition | Evidence / remaining verification |
|---|---|---|---|
| DB-01 Counter write boundary | HIGH | **Design corrected:** stored routines are sole mutation boundary; runtime direct challenge/quota DML denied; triggers are defense-in-depth only. | Updated architecture amendment and nine-finding resolution. No routines, grants, or PG proof. |
| DB-02 Initialization/reconciliation | HIGH | **Design corrected:** one migration-seeded GLOBAL row, race-safe subject row creation, constrained scope, stopped reconciliation. | Amendment specifies behavior. Exact schema, FK, SQL and maintenance runbook absent. |
| DB-03 Atomic counters | HIGH | **Design corrected:** conditional reservations, row-count checks, one transaction per challenge/counter transition, one-way consume and atomic cleanup. | Pseudocode now consistent. No executable statements, rollback proof, or multi-client test. |
| DB-04 Expiry/cleanup/storage | MEDIUM | **Design corrected:** validity, outstanding rows, retained rows, audit, backups and physical storage separated. | Cleanup SQL and actual retention/capacity values absent. |
| DB-05 Database permissions | HIGH | **Design corrected:** role separation, NOLOGIN object owner, execute-only runtime, narrowly scoped SECURITY DEFINER only when needed, pinned search_path and explicit ACLs. | Role provisioning and function ACL/catalog tests absent. |
| DB-06 Lock/FK behavior | HIGH | **Design corrected as protocol:** User → AuthSession → TrainingSession → quota → challenge → attendance → audit; cleanup is quota-first and never later locks parents; controlled deletions required. | Source inventory is incomplete; PostgreSQL implicit FK/cascade locks and actual writer races untested. |
| DB-07 Prisma/custom SQL | MEDIUM | **Disposition clarified:** relational core in Prisma; enforcement routines, triggers, CHECKs, partial indexes, ACL/ownership in custom migration SQL. | Exact locked Prisma compatibility, migration, and catalog/drift checks absent. |
| DB-08 Disposable DB identity | HIGH test-safety gate | **Design corrected:** require out-of-band server/container identity, loopback, database/role/version, empty schema and run marker before writes. | Existing databaseSafety guard still does not do this; no dedicated harness exists. |
| DB-09 Values/retention | MEDIUM | **Design corrected:** explicitly requires finite versioned settings and separates validity/row/audit/backup retention. | Actual values, approval, physical capacity budget and load envelope remain open. |

**Critical/high resolution answer:** No Critical finding was assigned. The six High findings have design corrections, but **none is implementation-resolved or verified**. DB-06 and DB-08 remain especially direct blockers because the current source and guard do not yet enforce the new design.

### Quota consistency conclusion

The amended contract is internally coherent if implemented exactly as specified:

- A single issue routine locks quota rows in GLOBAL-then-SUBJECT order, conditionally reserves both outstanding capacity and global retained capacity, checks every affected-row count, inserts the digest-only challenge, and commits in one transaction.
- A consume routine locks the same quota rows before the challenge row, uses one post-lock DB timestamp, conditionally transitions unconsumed to consumed, decrements outstanding counters exactly once, and commits atomically.
- Cleanup and controlled deletion update counters in the same transaction as row deletion. Expiration alone does not mutate counters; expired unconsumed rows keep counting until consume/delete, so cleanup failure causes backpressure rather than cap bypass.
- Counter reconciliation is maintenance-only with admissions stopped and a global gate held; there is no online self-healing.

Conditions where counters can still drift or a cap can be exceeded until implementation is proven:
1. Any direct table DML, trigger bypass, migration/runtime ownership overlap, or alternate legacy writer.
2. Function does not check all RETURNING counts or catches an exception without rolling back the entire operation.
3. Cleanup/update trigger decrements twice or omits the expired-unconsumed decrement.
4. Missing GLOBAL/SUBJECT row is auto-created outside the global lock or limits differ across instances.
5. Account/session deletion bypasses the controlled routine.
6. Reconciliation runs while admissions continue.
7. Physical disk/WAL growth from other data is treated as covered by a row-count cap.

The design prevents these only if the routine-only ACL boundary and controlled deletion paths are actually enforced. No current PostgreSQL implementation provides that evidence.

### Permissions and Prisma conclusion

Least-privilege direction is appropriate: migration identity separate from runtime; NOLOGIN object owner; runtime execute-only; separate cleanup worker with bounded routine execution; role-scoped audit access; monitored DBA. SECURITY INVOKER remains default. SECURITY DEFINER is acceptable only for routines needing controlled elevation, with trusted fixed search_path, fully qualified names, no unsafe dynamic SQL, exact argument checks, PUBLIC execute revoked, and exact grants in the same migration transaction.

The repository's Prisma v6 line can model normal relational objects and compound uniqueness, but the database invariant layer needs hand-authored migration SQL and catalog checks. The compound AuthSession reference requires @@unique([id,userId]). No migration or schema edit was made. Generated migration behavior, function ownership, privileges and introspection drift remain unverified.

### Locking conclusion

The new User-before-AuthSession sequence aligns with the current User → AuthSession cascade direction. Challenge FKs with RESTRICT require child-first controlled deletion for both User and TrainingSession. Cleanup's quota-first exception is safe only because it must never later wait for parent rows; all other overlapping paths follow the parent-first order. FK key-share/referential-action locks are implicit and can still produce cycles if any writer/cascade bypasses the protocol.

Deadlock retry is a recovery rule only: retry the entire operation after a known PostgreSQL 40P01 or 40001 abort, only where idempotent and bounded. No retry after an ambiguous network/commit outcome. Finite race testing cannot prove absence of all deadlocks.

### Test-layer mapping for T01–T80

The controlling case-by-case table is BIOMETRIC_BSR05_FINAL_TEST_MATRIX.md; it lists each ID exactly once with purpose, environment, expected result, and flag-off status. The layer mapping is:

- **Pure unit:** deterministic token validation, token-bucket math, generic response mapping, policy validation, and no-body-identity contract subcases in T01, T08, T35, T37, T40, T45, T53, T54, T57, T58, T66 and T67.
- **Transaction mock:** ordering/error/response unit seams for T01–T04, T08, T40, T45, T52–T54, T65–T67 and T76. These prove service call ordering only; they do not prove PostgreSQL rollback or locks.
- **Single-connection PostgreSQL integration:** constraints, FK bindings, expiration equality, transaction rollback, direct DML denial, identity checks, and routine behavior (among others T09–T10, T14, T19, T25, T38, T47–T49, T61, T64 and T79).
- **Multi-connection PostgreSQL concurrency:** challenges/cleanup, revocation, deletion, quota, session closure, attendance and deadlock schedules in T05–T07, T11–T18, T22–T34, T38–T39, T43–T50, T55–T56, T58–T63 and T69–T80. The exact combinations are stated in each matrix row.
- **Operational/fault tests:** process restart/multi-instance, network ambiguity, database outage, cleanup outage, pool/load behavior, identity attestation, mixed versions, and monitoring in T20–T21, T30, T39–T45, T50–T52, T57, T59, T63–T68 and T73–T78.

Some tests intentionally span layers; for example, T43 uses PostgreSQL plus network-fault operations, and T74 uses PostgreSQL, concurrent clients and separate backend processes. Current required environments in the matrix are authoritative where a case spans more than one class.

**Database requirement:** T05–T80 cases whose environment names PostgreSQL require a newly provisioned, identity-verified disposable target and synthetic fixtures. None can use ncc_local_dev or persistent NCC volumes. The exact environment per case is in the matrix. T64 is a pre-write gate, not a post hoc test.

**Biometric activation:** T24, T26, biometric part of T28, and actual endpoint portion of T62 are deferred. Their generic DB/session/unique-claim state can be tested with attendance disabled. No case requires production activation; no test may change the production feature flag. Until routes/services exist, T01–T10/T54/T76 only test contracts or disabled legacy paths, not a functioning new API.

### Updated exact prerequisites

1. Implement and review the routine-only SQL/ACL boundary; no direct runtime challenge or quota DML.
2. Resolve exact Prisma relation model, global policy seed, subject quota FK/lifecycle, checks, indexes, trigger/routine SQL and maintenance-only reconciliation.
3. Complete source lock inventory and migrate or isolate every relevant User/AuthSession/TrainingSession/Attendance writer and delete path.
4. Decide finite TTL/caps/token-bucket values/timeouts/cleanup and accepted burst/load envelope; approve challenge, audit, account-deletion and backup retention.
5. Add the out-of-band disposable DB identity harness and dedicated integration runner; separate it from mock-only suites.
6. Obtain separate authorization before migration or DB/container/test execution; run PostgreSQL catalog, ACL, rollback, multi-connection and operational tests on the new ephemeral target only.
7. Keep legacy 1:N routes blocked, biometric flag off, manual attendance intact, and no Map fallback during any future cutover.

**Current result remains NO-GO.** Design amendments address the former document-level conflict but do not satisfy implementation or verification prerequisites. No code/schema/database/test/flag operation occurred during this update.
