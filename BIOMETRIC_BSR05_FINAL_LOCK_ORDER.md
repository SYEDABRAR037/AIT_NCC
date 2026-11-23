# BSR-05 Final PostgreSQL Lock Order

**Status:** Target protocol for design review; not implemented or executed. Split-quota and integrity-gate models are represented in the current Prisma schema. This order supersedes earlier single/polymorphic quota wording in this file; PostgreSQL FK/cascade lock behavior still requires disposable integration verification.
**Purpose:** One auditable order across account deletion/cascades, auth-session revocation, challenge operations, attendance writes/finalization, and cleanup.

## 1. Lock order

Transactions acquire only the rows they need, but if they acquire multiple classes they must acquire them in this order:

| Tier | Resource | Exact order / rule |
|---:|---|---|
| 1 | `User` rows | Lock all involved users first, sorted ascending by immutable `User.id`. Challenge issuance/consumption lock the subject; staff manual/finalization lock actor and target users as needed; account deletion locks its subject. |
| 2 | `AuthSession` rows | Lock all involved sessions next, sorted ascending by `AuthSession.id`; verify each `userId` matches the already locked owner. Logout, session revocation, challenge operations and attendance writes use this tier. |
| 3 | `TrainingSession` rows | Lock session rows by ascending id after users/sessions. Session close/finalization and attendance writers lock the target session here. |
| 4 | Integrity gate | Challenge writers take the singleton gate `FOR SHARE`; reconciliation, recovery, and policy maintenance take it `FOR UPDATE`. No later operation may acquire parent rows after this tier. |
| 5 | Split quota rows | Lock `BiometricChallengeGlobalQuota` first, then `BiometricChallengeSubjectQuota` rows sorted by `subjectUserId`. No operator quota exists in the approved self-service flow. |
| 6 | `BiometricVerificationChallenge` rows | Lock exact challenge rows by stable id/digest order only after quota locks. Updates/deletes and counter transitions occur in the same routine transaction. |
| 7 | `TrainingAttendance` rows/unique claims | Sort by `(sessionId,cadetId)`; session row remains locked before attendance claims. |
| 8 | Audit/event inserts | Last in the transaction; no external I/O while any locks are held. |

### Advisory locking

Do not use application advisory locks as the correctness mechanism for final quotas. PostgreSQL does not enforce that every writer takes advisory locks; it is an application convention. Database-owned counter rows and restricted stored procedures are the authoritative control. A transaction advisory lock may be used as an optimization only if it follows the same ordering, is acquired after User/AuthSession/TrainingSession and before quota rows, and no correctness claim depends on it.

## 2. Why `User → AuthSession` is required

The current Prisma model has `AuthSession.user` with `onDelete: Cascade`. Deleting a User can cascade into its AuthSession rows. PostgreSQL also acquires locks for foreign-key validation and referential actions; FK checks use key-share protection on referenced rows, and row deletes conflict with that protection. A service-level ordering does not suppress locks acquired internally by FKs, triggers, or cascades.

The earlier order `AuthSession → User` permits this cycle:

```text
account deletion: holds User → waits for AuthSession cascade
challenge issue:  holds AuthSession → waits for User
```

The final order starts with all involved User rows. For account deletion, the application must not issue a bare ORM cascade while challenges/counters exist. The deletion transaction:

1. Locks the User row `FOR UPDATE`.
2. Locks its AuthSession rows in id order.
3. Locks GLOBAL quota, then the subject quota row.
4. Deletes the user's challenge rows through the reviewed deletion routine; the routine and triggers update counters atomically.
5. Deletes AuthSession rows after challenge FK references are gone.
6. Deletes/resets the subject quota row under the approved retention procedure.
7. Deletes or anonymizes User and commits.

The new challenge FKs use `RESTRICT` so an accidental direct User/AuthSession/TrainingSession deletion fails instead of relying on implicit cascade order. Durable audit rows are separate and are not cascade-deleted by this workflow.

**Race outcome:** if issuance/consume gets the User lock first, deletion waits; the operation commits or rejects, then deletion rechecks and removes its ephemeral challenge state. If deletion gets the User lock first, challenge operations wait; after deletion commits they find no active User/session and fail. This assumes every deletion path follows the protocol and direct cascade deletion is denied to ordinary application paths.

## 3. Stored-routine and trigger boundary

The order above is not safely enforceable by ORM convention alone when counters and challenge rows are mutated through different code paths. Recommended DB boundary:

- Runtime role is not owner of the challenge/quota tables and cannot alter/disable triggers or change quota policy.
- Revoke direct INSERT/UPDATE/DELETE on gate, policy, quota, challenge, and audit/event rows from runtime role.
- Expose narrowly scoped `SECURITY DEFINER` routines for issue, consume, cleanup, reconciliation, recovery, policy lifecycle, and controlled account deletion; pin `search_path`, validate parameters, and grant EXECUTE only to capability roles.
- The routines acquire User/AuthSession/TrainingSession locks, the integrity gate, GLOBAL then sorted SUBJECT quota locks, and challenge rows—in that order. Routines own all counter transitions. Any retained trigger is defense-in-depth only, cannot be an alternate write path, and cannot acquire a lock below the challenge row after that row is held.
- Direct Prisma DML is not an alternative supported write path. The runtime role is execute-only for narrowly scoped routines.

The database cannot verify JWT signatures; it can verify that the supplied authenticated subject/session pair exists, is unrevoked/unexpired, and that relational bindings match. Express remains responsible for JWT authentication, role/scope authorization, and deriving IDs. Stored routines must not be exposed to untrusted clients.

## 4. Per-operation transaction sequences

All transactions are short `READ COMMITTED`, set local `lock_timeout`/`statement_timeout` before waiting, and set isolation before the first query. No provider/inference/network call occurs inside a transaction.

### A. Challenge issuance

```text
authenticate JWT in middleware; derive subjectUserId and authSessionId server-side
reject body target/operator/purpose fields; if biometric flag is off, route remains unavailable
BEGIN READ COMMITTED
  lock User(subject) FOR UPDATE
  lock AuthSession(authSessionId, subject) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  recheck role, account state, auth session expiry/revocation, session ACTIVE/time window,
    and cadet eligibility/consent/enrollment requirements
  call issue routine / insert with quota rows GLOBAL then SUBJECT
  reserve outstanding and retained capacity atomically; consume rate tokens
  persist digest only, bind subject/session/authSession/purpose, expiry=dbNow+TTL
COMMIT
return raw token only after known commit
```

If DB commit outcome is unknown, return no token. The orphan row expires and consumes retained capacity until cleanup. Do not retry through memory.

### B. Challenge consumption

```text
authenticate JWT; derive subjectUserId and authSessionId server-side; hash bounded raw token
BEGIN READ COMMITTED
  lock User(subject) FOR UPDATE
  lock AuthSession(authSessionId, subject) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  lock quota rows GLOBAL then SUBJECT
  lock exact digest challenge FOR UPDATE
  capture dbNow = clock_timestamp() after challenge lock
  verify all bindings, unconsumed state, createdAt <= dbNow < expiresAt,
    auth session live, session ACTIVE, subject eligible
  conditional consumedAt=dbNow update; require exactly one row
  decrement outstanding counters in same transaction
COMMIT
```

Wrong binding, expired, missing or replayed requests do not mutate the challenge and return a generic external response. Inference occurs after commit; an inference failure spends the token and requires a new challenge.

### C. Logout/session revocation

```text
verify JWT and derive owner userId/sid
BEGIN
  lock User(userId) FOR UPDATE
  lock AuthSession(sid,userId) FOR UPDATE
  compare-and-set revokedAt using DB time
  persist logout/revocation audit in the same transaction
COMMIT
```

Bulk revoke-all sorts and locks every target AuthSession after the owner User. If one request must revoke multiple users, lock all Users sorted first, then all sessions sorted.

### D. Attendance write and session finalization

```text
BEGIN
  lock all involved User rows sorted (actor and target cadets when their state must serialize)
  lock actor AuthSession row(s) sorted
  lock TrainingSession row(s) sorted
  recheck auth state, role/scope, session state, eligibility and leave/correction policy
  lock/claim TrainingAttendance rows sorted by cadet id
  write manual attendance/correction OR finalize and close session conditionally
  insert required audit event in same transaction
COMMIT
send notifications only after commit
```

Manual attendance never touches challenge or quota rows. Preserve existing authorized correction/upsert behavior; closed-session corrections, if allowed by policy, are a distinct audited path.

### E. Cleanup

```text
BEGIN READ COMMITTED
  lock GLOBAL quota row first (all challenge state transitions use this row)
  read candidate subject ids without row locks; lock SUBJECT quota rows sorted by scopeId
  reselect candidate challenge rows ORDER BY expiresAt,id FOR UPDATE SKIP LOCKED
  after locks, capture one DB timestamp; recheck expiry and retention
  delete selected rows through cleanup routine; decrement retained/outstanding counters atomically
COMMIT
```

The GLOBAL quota lock prevents issuance/consume/delete challenge state transitions while the subject set is collected. Cleanup starts at the quota tier and never later acquires User/AuthSession/TrainingSession. Account deletion starts at User and proceeds downward. Cleanup that acquires quota then waits for User is forbidden.

## 5. Deadlock prevention and recovery

- Account deletion/cascade vs issue/consume: User is first for both; explicit challenge deletion precedes AuthSession/User deletion; restrictive FKs reject bare cascades.
- Logout vs challenge consume: both lock User then AuthSession; winner is determined by commit order. If revocation commits first, consume fails. If consume commits first, it spends a challenge while session is active; a later final attendance transaction rechecks and can reject after logout.
- Session close vs mark: both lock actor User, AuthSession, then TrainingSession before attendance. Close-first means write gets conflict; write-first means finalizer includes the committed mark.
- Two consumers: same User/AuthSession/TrainingSession locks serialize before the challenge; conditional update remains the final single-use guard.
- Cleanup vs consume: both acquire quota rows before challenge rows; cleanup rechecks expiry after the challenge row is locked. Expiry equality is expired.
- Concurrent multi-cadet updates: all User rows and attendance rows are sorted by stable id. No “read then upsert” bypasses the locked session.
- Database still detects deadlocks from implicit FK/trigger locks, unreviewed routes, or nonconforming direct SQL. Treat `40P01` as an alarm and retry only an explicitly idempotent, definitely aborted transaction with a small bound. Do not claim retries replace correct ordering.
- Lock wait, statement, pool, and transaction durations must be bounded. Exhaustion fails closed for biometric work; manual attendance remains independent of biometric services.

## 6. Source inventory gate

Before implementation, inventory and annotate every code path that:

- deletes/anonymizes `User`, deletes/revokes one or all `AuthSession`s, or changes account status;
- issues/consumes challenge, deletes challenge, changes consent/template state;
- inserts/updates/deletes `TrainingAttendance`, changes `TrainingSession.status`, imports/corrects/manual-marks, or updates counts;
- invokes foreign-key cascades or database triggers touching these relations.

For each path record locks, order, transaction boundary, implicit FK effects, and external I/O. The current `markAttendance`, `bulkImportAttendance`, `verifyFaceAttendance`, and `endAttendanceSession` do not establish the final protocol. No schema/migration GO exists until this inventory and two-client deadlock tests pass on a separately approved disposable PostgreSQL instance.


## Binding lock-order correction — routine-only challenge writes (2026-11-23)

This addendum is authoritative for the challenge/quota boundary and supersedes any earlier text suggesting runtime direct challenge DML. It is a design amendment only.

### Canonical protocol

Any transaction that touches multiple tiers acquires locks in this order:

1. All involved User rows, ascending immutable User.id.
2. All owned AuthSession rows, ascending AuthSession.id.
3. All TrainingSession rows, ascending id.
4. Quota rows, GLOBAL first, then SUBJECT rows ascending scopeId.
5. Challenge rows, ascending id.
6. TrainingAttendance claims, ascending (sessionId,cadetId).
7. Required AuditLog insert last.

Every operation first determines its complete lock set and sorts it. No transaction may acquire a lower-numbered tier after a higher tier. Audit insertion has no later external I/O or database lock acquisition in the same transaction.

Cleanup is the sole intentionally quota-first routine. It locks GLOBAL, discovers/locks bounded SUBJECT rows in sorted order, then challenge rows. It never acquires User, AuthSession, or TrainingSession later. Account deletion starts at User and may wait on GLOBAL; cleanup never waits back on User, so this specific wait has no reverse edge.

### Exact operation sequences

**Issue:** authenticate in Express; derive subject and sid from verified middleware only; reject body target/operator fields. In one transaction set isolation/timeouts first; lock User FOR UPDATE; lock matching AuthSession FOR UPDATE; lock TrainingSession FOR UPDATE; recheck active account/session, role, time window, eligibility and policy prerequisites; invoke DB issue routine, which takes GLOBAL then SUBJECT quota locks, conditionally reserves counters and inserts the digest row; commit; return raw challenge only after known commit. The runtime role cannot call raw INSERT.

**Consume:** derive subject/sid and hash bounded raw token. In one transaction lock User, AuthSession, TrainingSession; recheck live session and eligibility; lock GLOBAL then SUBJECT quota; lock exact challenge row; capture one clock_timestamp after locks; validate digest and every binding, unconsumed state and expiresAt > now; conditional consume and outstanding decrement in same transaction; commit. Inference is outside the transaction. Failed inference spends the challenge.

**Logout/revoke:** lock User then AuthSession; revoke and write required audit in one transaction. Bulk revoke sorts all AuthSession rows. Account deletion cannot delete User before acquiring its session locks.

**Attendance close/manual write:** lock all affected Users sorted; actor AuthSession rows sorted; TrainingSession; attendance keys sorted. Recheck actor authorization, session state and correction rules after locks. Manual attendance write/correction and required audit commit atomically. Closing session uses the same TrainingSession lock. Manual flow never touches biometric challenge/quota tables.

**Account deletion:** lock User; lock its AuthSession rows sorted; lock affected TrainingSession only if operation mutates them; lock GLOBAL then subject quota; call deletion routine to remove challenge children and adjust counters; remove subject quota row only if empty and retention policy allows; remove AuthSessions and then User under declared FK actions. Direct ORM cascade is prohibited for challenge-referenced parent rows.

**TrainingSession deletion:** first lock session in parent tier; lock GLOBAL then affected SUBJECT quota rows; delete challenge children and update counters; then delete session only after references clear. Existing attendance cascade behavior is not a substitute for challenge cleanup.

**Cleanup:** lock GLOBAL; identify eligible subject scopes without locking parent rows; lock quota rows sorted; select bounded challenge rows ordered and FOR UPDATE SKIP LOCKED; capture one DB timestamp after locks; recheck expiry and approved retention; delete and decrement counters atomically. A cleanup batch with too many distinct subjects must be bounded by both row count and subject count to avoid unbounded lock duration.

### Foreign-key and trigger constraints

- AuthSession reference target must have a unique key over (id,userId), even though id alone is currently primary.
- New challenge FKs to User, AuthSession and TrainingSession should be restrictive where controlled child cleanup is mandatory.
- Existing User→AuthSession cascade and TrainingSession→TrainingAttendance cascade remain implicit lock paths. Controlled deletion routines must explicitly remove challenge rows before parent deletion.
- Stored routines and triggers must not acquire User/AuthSession/TrainingSession locks after quota/challenge locks. Every FK validation/referential action in generated SQL must be inspected; a correct application order alone is not proof.
- Runtime cannot directly mutate challenge/quota tables, change trigger state, alter ownership, or set replication role.

### Isolation and retries

Use short READ COMMITTED transactions with lock_timeout, statement_timeout, request deadline and pool wait limit set before lock acquisition. After waiting for a lock, re-read mutable status/authorization in a new statement under the held row lock. Store DB time once after relevant row locks and use it for expiry/consume decisions.

PostgreSQL deadlock detector may abort one participant with 40P01; SERIALIZABLE could additionally produce 40001, though READ COMMITTED is the selected baseline. Retry only a confirmed-aborted whole transaction that is idempotent, with a small configured limit and jitter. Do not retry network loss or an unknown commit. Unknown issuance returns no raw token; unknown consumption is treated as spent. Exhaustion fails closed. A retry policy does not cure an inverted lock graph.

### Required source and PostgreSQL proof

Before schema approval, inventory every User delete/status change, AuthSession revoke/revoke-all, TrainingSession close/delete, manual mark/correction/import, attendance count update, challenge operation and audit path. For each record lock order, transaction boundary, implicit FK effect and mutable authorization recheck.

On an authorized disposable PostgreSQL instance, use two independent connections and deterministic barriers to exercise deletion/revocation/issue/consume/cleanup/session-close/manual-write races. Capture pg_locks and SQLSTATE, assert expected winner/conflict and no unauthorized commit. Test direct parent delete fails while challenge exists, then controlled deletion succeeds and counters match. Repeat deadlock schedules; finite runs provide evidence for tested schedules only.
