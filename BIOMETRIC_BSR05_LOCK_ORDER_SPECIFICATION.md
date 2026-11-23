# BSR-05 PostgreSQL Lock-Order Specification

**Status:** Proposed protocol; not implemented or tested.
**Applies to:** Future subject-bound challenge issuance/consumption, authentication-session revocation, attendance-session finalization, attendance writes, and challenge cleanup.
**Invariant:** A challenge cannot authorize a mark unless its durable authentication session and attendance session are valid at the transaction that consumes/records it. Manual attendance remains independent of biometric challenge storage.

## 1. Global lock hierarchy

Every transaction that acquires more than one lock must acquire locks in this order and must never acquire a higher-priority lock after a lower-priority lock:

| Tier | Lock resource | Ordering within tier |
|---:|---|---|
| 0a | Transaction advisory quota lock: global | Always first for challenge issuance only. Fixed namespaced key, identical on every backend instance. |
| 0b | Transaction advisory quota lock: subject | After global; stable keyed subject key. For multiple subjects, sort keys numerically and acquire ascending. |
| 0c | `BiometricChallengeQuotaBucket` rows | Global bucket before subject bucket; within tier sort `(scopeType, scopeKey, windowStart)`. Issuance only. |
| 1 | `AuthSession` rows | Sort by primary key. For a single request, lock exact authenticated `sid` and verify matching `userId`; logout/revocation uses the same row. |
| 2 | `TrainingSession` rows | Sort by primary key. Lock exact session before any challenge or attendance row. |
| 3 | Subject `User` rows, if locked for eligibility | Sort by user id. Keep this tier only if eligibility can change concurrently and must be serialized. |
| 4 | `BiometricVerificationChallenge` rows | Sort by challenge id. Exact digest lookup for consumption; cleanup locks only challenge rows and acquires no earlier-tier locks afterward. |
| 5 | `TrainingAttendance` rows / unique attendance claim | Sort by `(sessionId,cadetId)`. For multi-cadet correction/import, sort cadet ids and acquire all claims in that order. |
| 6 | Transactional `AuditLog` rows/inserts | Last. Never call external notification, inference, email, or network services while locks are held. |

Advisory quota locks are transaction-scoped. The global-then-subject hierarchy is mandatory; two issuance transactions cannot acquire the subject key first and global key second. Quota bucket rows are acquired/upserted in the same deterministic order. Other transaction types do not acquire quota locks. This prevents a cycle in which a consume/finalization transaction holds `AuthSession` or `TrainingSession` and waits for a quota lock held by issuance.

### Isolation and lock lifetime

- Use short `READ COMMITTED` transactions plus explicit row/advisory locks and conditional writes. `SERIALIZABLE` is not required for correctness if every writer follows this protocol, though it may be evaluated later with bounded retry behavior.
- `SELECT ... FOR UPDATE` / `FOR NO KEY UPDATE` locks must be taken inside the Prisma transaction using reviewed parameterized SQL where Prisma APIs cannot express the needed lock.
- Set bounded `lock_timeout`, `statement_timeout`, and transaction/request deadlines. Values must be selected from measured local pool constraints before implementation.
- Do not hold database locks across face inference, camera upload processing, provider calls, notifications, or other slow work.
- A failed transaction releases all locks. Retry only recognized deadlock/serialization errors with a small bounded count, and only when the complete operation is safe to retry.

## 2. Transaction protocols

### A. Logout/session revocation

```text
verify presented JWT; derive userId and sid
BEGIN
  SELECT AuthSession WHERE id=sid AND userId=userId FOR UPDATE
  if absent/already revoked: idempotent no-op
  set revokedAt = database timestamp only if still NULL
  insert required logout audit event (no token/cookie)
COMMIT
clear client cookie after successful or idempotent server result
```

If audit persistence is required for logout correctness and fails, roll back revocation and return a controlled failure; do not silently clear the only usable session while reporting success. Existing implementation uses an `updateMany` compare-and-set plus audit transaction but does not explicitly lock in the common protocol. Refactor only with regression tests and preserve idempotency.

### B. Challenge issuance

```text
derive subjectUserId and authSessionId from verified request context
validate role=CADET; ignore/reject any caller-supplied subject/operator
BEGIN READ COMMITTED
  advisory lock GLOBAL_QUOTA
  advisory lock SUBJECT_QUOTA(subjectUserId)
  atomically reserve/increment global then subject quota buckets
  lock AuthSession(authSessionId, subjectUserId) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  lock subject User FOR SHARE/UPDATE only if required for concurrent eligibility state
  dbNow := clock_timestamp() once after these locks
  assert auth session unrevoked and expiresAt > dbNow
  assert training session ACTIVE and in allowed time window
  assert subject is eligible, has required current consent/enrollment (when implemented)
  assert pending subject/global caps using indexed rows
  insert challenge with server purpose, owner bindings, digest, dbNow, dbNow+30 seconds
COMMIT
return raw random token once only after confirmed commit
```

If quota fails, abort before inserting a challenge. Rate bucket updates roll back with issuance. An ambiguous commit returns sanitized unavailable and no token; an orphan challenge expires and is cleaned later. No process-local fallback.

### C. Challenge consumption (authorization phase)

```text
derive subject and authSessionId from the authenticated request; hash token
BEGIN READ COMMITTED
  lock AuthSession(authSessionId, subjectUserId) FOR UPDATE
  lock TrainingSession(sessionId) FOR UPDATE
  lock subject User if eligibility needs serialization
  find exact challenge digest and lock it FOR UPDATE
  dbNow := clock_timestamp() once after challenge row lock
  validate owner, auth session, training session, purpose, pending state, and dbNow < expiresAt
  revalidate session active, auth session active/unexpired, user eligible, consent/enrollment current
  conditional update consumedAt=dbNow WHERE consumedAt IS NULL AND expiresAt>dbNow
  require exactly one affected row
COMMIT
```

Wrong binding is rejected before `consumedAt` changes, so a cross-cadet attempt cannot burn the rightful challenge. Missing, expired, wrong-bound and replayed tokens have indistinguishable external responses. Internal audit may record a coarse reason with no token or biometric payload.

The challenge is consumed before inference. Inference executes outside a database transaction. Failed match/PAD consumes the challenge; the cadet must start a fresh attempt subject to the normal rate policy.

### D. Final biometric attendance write

This is a future phase, not enabled by this design. It must be a distinct transaction after successful trusted inference:

```text
BEGIN READ COMMITTED
  lock authenticated AuthSession row
  lock TrainingSession row
  lock subject User row if needed
  recheck auth session unrevoked and unexpired
  recheck TrainingSession.status='ACTIVE' and allowed window
  recheck cadet eligibility, current consent, active template/model and verified result provenance
  claim unique TrainingAttendance(sessionId,cadetId)
  insert security audit event in the same transaction
COMMIT
```

If logout or session close commits after challenge consume but before this transaction, the final mark is rejected and no attendance is written. This leaves the challenge spent. The design intentionally chooses security over reusing a token after inference.

### E. Manual attendance mark/correction/import

Manual attendance never touches challenge/quota rows. To serialize manual writes with finalization:

```text
derive authenticated staff session
BEGIN
  lock AuthSession row
  lock TrainingSession row
  verify staff role/scope and allowed correction policy
  verify session state permits this exact manual operation
  lock/claim TrainingAttendance rows in sorted cadet-id order
  persist manual status, actor and audit together
COMMIT
```

Existing corrections after close, if any are an approved existing behavior, must be represented as a separate audited correction capability and must not reopen the session or bypass role scope. Do not blanket-disable valid manual correction behavior while implementing the shared lock.

### F. Session finalization

```text
derive authenticated staff session
BEGIN
  lock AuthSession row
  lock TrainingSession row
  verify actor may finalize and session is ACTIVE
  compute/reconcile the final expected attendance using a consistent snapshot and approved leave rules
  lock/claim attendance rows in sorted cadet-id order
  write absent/excused records and set session CLOSED with conditional status check
  write finalization audit in same transaction
COMMIT
trigger notifications only after commit
```

The current `endAttendanceSession` performs reads/reconciliation before the transaction, upserts attendance records, then updates the `TrainingSession`; it must be reorganized so the session row is locked before reconciliation writes and the closure status is conditional. Notifications stay outside the transaction.

### G. Challenge cleanup

```text
BEGIN
  select up to B expired/retention-eligible challenge rows
    ORDER BY expiresAt,id FOR UPDATE SKIP LOCKED
  for each locked row, obtain one database timestamp after its lock
  delete only when expiresAt <= that timestamp and approved retention is satisfied
COMMIT
```

Cleanup acquires no quota, auth-session, training-session, user, attendance, or audit locks after taking challenge locks. It cannot cycle with consume because it never waits upward in the hierarchy. Logical expiry is enforced at consumption even if cleanup stalls. Choose B only after query/pool behavior is measured; no batch size or retention duration is an institutional fact in this specification.

## 3. Race outcomes / linearization points

| Race | Winner rule | Losing request behavior |
|---|---|---|
| Logout vs challenge consume | Both lock the same `AuthSession`. If logout commits first, consume observes revoked state and fails. If consume commits first, the challenge is consumed while session was active. | Generic unauthorized/invalid challenge as appropriate; no inference/attendance after revocation. |
| Logout vs final mark | Both lock `AuthSession`. Whichever transaction commits first is the linearization order. A completed logout before final mark means no attendance write. | Final mark returns unauthorized/session-expired; challenge remains spent. |
| Session close vs challenge consume | Both lock `TrainingSession`. Closure first means consume rejects. Consume first may spend token, but final mark rechecks status and can still reject if closure wins later. | Conflict/closed-session response; no attendance write. |
| Session close vs final attendance mark | Both lock `TrainingSession` before attendance. Mark first commits and finalizer includes it; finalizer first closes and mark fails. | 409 closed/conflict. |
| Two challenge consumers | Same parent locks serialize requests for a user/session; challenge-row conditional update is final winner election. Exactly one consumes. | Other receives generic conflict/invalid response. |
| Cleanup vs consume | Both lock challenge. Consumer succeeds only if post-lock DB time is strictly before expiry. Cleanup deletes only if post-lock time is at/after expiry and retention allows. | Expired request fails; active token is not removed. |
| Two quota issuers | Global advisory lock serializes global admission; subject lock serializes per-subject admission. Bucket conditional upsert enforces rate limit. | 429 with generic retry guidance, no challenge row. |

### Deadlocks this protocol prevents

- **Finalizer vs mark inversion:** old finalizer writes attendance before session status while mark can read session then write attendance. New common order takes `TrainingSession` before `TrainingAttendance` in both paths.
- **Logout vs biometric write:** both acquire `AuthSession` before any training-session/attendance locks. A mark never holds `TrainingSession` while waiting for auth-session revocation.
- **Quota vs attendance cycle:** quota locks/bucket rows are taken only at transaction start by issuance; consume/finalizer never acquire quota after parent rows.
- **Cleanup vs consume:** cleanup locks challenge only and never later requests a parent row; other paths acquire parents before challenge.
- **Bulk row-order inversion:** import/correction/finalization acquire attendance rows in the same sorted `(sessionId,cadetId)` order.

Any existing writer that locks an attendance row, then a session row, or acquires `AuthSession` after a `TrainingSession` is a protocol violation and must be identified before migration/integration. If a valid current correction flow cannot follow this order, design an explicit exception with an independent deadlock proof and race tests; do not silently omit it.

## 4. Failure and operational behavior

- PostgreSQL outage, missing schema, bounded lock/statement timeout, or retry exhaustion fails closed for biometric issuance/consumption/final marking. Never fall back to local `Map` state.
- Manual attendance does not call the challenge store and remains available subject to its ordinary database availability and authorization.
- Return 503 for challenge service availability failure; 429 for quota exhaustion; 401/403 for expired/revoked auth or authorization; 409 for session closure or duplicate attendance; generic invalid/replayed token response without exposing whether a digest exists.
- Unknown commit outcome for issue: do not return token. Unknown consume/final-mark outcome: treat challenge as spent and query authoritative state only under a fresh authenticated request; never retry the same token as if guaranteed unused.
- Metrics may include operation category, latency, database error class and quota category. Never include raw token, digest, image, descriptor, score, session cookie, or unnecessary personal identifiers.

## 5. Required adoption checklist

Before any PostgreSQL integration test or migration:

1. Inventory every route/service writing `TrainingAttendance` or changing `TrainingSession.status`; migrate all relevant writers to the same lock order.
2. Add a durable self-service cadet challenge/verification API contract without exposing the existing roster 1:N route to cadets.
3. Confirm authorization middleware exposes durable `sid` and `userId` consistently to all affected handlers.
4. Define eligibility snapshot semantics and lock the `User` row only if required; avoid acquiring it in a conflicting order elsewhere.
5. Select quota scopes, caps, windows, cleanup batch and retention, lock/statement timeouts, and retry/error mapping.
6. Implement and pass multi-client PostgreSQL tests in a newly identity-verified disposable database; no current development DB.
7. Keep biometric feature disabled and provider unconnected until separate phases/gates approve them.
