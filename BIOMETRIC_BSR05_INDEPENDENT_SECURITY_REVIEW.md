# AIT NCC — BSR-05 Independent Security Review

**Review type:** Adversarial design review (read-only)  
**Date:** 2026-11-22  
**Scope:** `BIOMETRIC_BSR05_FINAL_DESIGN.md`, prior BSR-05/07/08 design, PostgreSQL readiness report, final security review, process-local challenge code/tests.  
**Execution:** No code/schema edits, tests, database connections, migrations, environment changes, or feature-flag changes.

## Executive decision

The design's core primitive—high-entropy token, digest-only persistence, and one-row conditional consumption—is sound as a basis for shared storage. However, the design is **not ready to implement as written**. It leaves global/resource limits unresolved, makes expiry timestamp selection ambiguous at the boundary, and does not fully serialize attendance-session finalization with the final attendance write. Its operator/session binding is appropriate only for the current staff-operated roster-wide scan; it is insufficient for the later specified 1:1 cadet-initiated verification flow unless a cadet subject binding is added.

**Overall: NO-GO for implementation pending the required design changes below.** This review does not authorize biometric use; attendance remains disabled.

## Evidence reviewed

- `BIOMETRIC_BSR05_FINAL_DESIGN.md`
- `BIOMETRIC_BSR05_BSR08_BSR07_DESIGN.md`
- `BIOMETRIC_POSTGRESQL_TEST_READINESS.md`
- BSR-05/07 findings and remediation addenda in `BIOMETRIC_FINAL_SECURITY_REVIEW.md`
- `backend/src/services/verificationChallengeStore.ts`
- `backend/src/__tests__/verification-challenge-store.test.ts`
- Challenge issue/consume and attendance persistence/finalization paths in `backend/src/controllers/attendance.controller.ts`
- Mocked replay/cross-session/concurrent-use cases in `backend/src/__tests__/biometric-security.test.ts`

## Adversarial scenario results

| Scenario | Design outcome | Independent assessment |
|---|---|---|
| Two workers consume the same token simultaneously | Both address the same row; conditional update and row locking allow one update. | **Sound with implementation conditions.** The `consumedAt IS NULL` conditional write is the correct winner-election primitive. Both requests must use the same database and exact digest/binding. The code must treat zero updated rows as invalid/replay, commit before inference, and must not fall back to the process-local map. The prescribed AuthSession lock also serializes consumes sharing one login session, but the row update remains necessary. Requires two-client PostgreSQL proof. |
| Replay after successful consumption | Consumed row no longer satisfies the condition; after cleanup it is absent. | **Sound.** Replay fails while the consumed row exists and after it is deleted. Do not return token-existence detail to an unbound caller. Existing in-memory unit test confirms single-process replay only; it does not validate PostgreSQL behavior. |
| Token submitted by a different operator | JWT user ID, auth session, operator ID and attendance session are part of binding/conditional update. | **Sound if all values come from authenticated server context.** A wrong operator must not consume the rightful row. A request should get the same generic response as missing/replayed. Current controller checks session/operator after consuming from the map; the DB design should filter all bindings before changing `consumedAt`, so a wrong-context attempt cannot burn the rightful token. |
| Token used for a different cadet | Design intentionally omits cadet ID because current flow is session-roster-wide matching. | **Scope-dependent; unresolved for the requested target architecture.** This is not a subject-bound challenge. In the current staff-operated 1:N flow, server-side roster filtering determines the candidate, but client-controlled descriptors remain a separate BSR-02/06 issue. The later Phase 5/7 requirements call for 1:1 verification and cadet initiation; that flow must bind a subject cadet ID at issuance and consumption, validate `subjectCadetId` against session eligibility, and never let the client choose a different subject. Do not reuse the present schema unchanged for 1:1. |
| Expired token races with cleanup | Logical expiry condition plus cleanup `SKIP LOCKED` is intended to make either consume or cleanup win. | **Mostly sound but boundary semantics are underspecified.** The SQL sketch calls `clock_timestamp()` separately for the `SET` value and `WHERE` predicate. The functions can observe different instants; a challenge may pass the predicate just before expiry but receive a `consumedAt` just after expiry. Also an `UPDATE` may wait on a row lock/cleanup; timestamp evaluation must occur after acquiring the challenge-row lock. Lock the exact bound row first, then capture one DB timestamp and use the same value for expiry comparison and `consumedAt`. Cleanup must select/lock/delete expired rows in one bounded statement or transaction; it must never delete a still-valid row. Add a boundary/race integration test. |
| Two issuances race past quota | Per-operator `User FOR UPDATE` serializes issuance if every writer follows that protocol. | **Per-operator quota can be sound, but limits are incomplete.** Under `READ COMMITTED`, after acquiring the common user-row lock, the subsequent count sees earlier committed issue transactions; the second transaction then sees the first insert. The row lock must be acquired by every issue path and retained through insert/commit. However, a compromised/stolen account can still fill its per-user quota, and many accounts can fill the table. The old implementation also had a 10,000-entry global cap; the final design leaves a global cap “if required” without a transaction design. A global bounded quota and request rate limit are required before multi-instance deployment. |
| Database fails during issuance | No token should be returned; no local fallback. | **Fail-closed behavior is correct but response mapping is not complete.** Current `issueVerificationChallenge` catch returns HTTP 500 for every exception. A future adapter must map unavailable/timeout/serialization exhaustion to sanitized 503 or controlled 429 as appropriate, distinguish expected conflict/expiry from internal errors, and log no token/hash/credentials. If insert commit outcome is unknown, do not return or reconstruct a token; the orphan row expires and pending capacity is temporarily used. |
| Database fails during consumption | Fail closed; no in-memory fallback. | **Security-safe, availability cost accepted.** A failure before commit should leave the challenge unconsumed; an uncertain commit must be treated as spent. Caller needs a fresh challenge. Bound DB connect/statement/lock wait timeouts so outage or lock contention does not tie up the web pool. Manual attendance must not call the challenge store. |
| Backend restarts between issuance and consumption | Persisted row is visible to another instance and survives restart. | **Improvement over current code.** Holds only after migration and all active workers use the DB store. During mixed-version rollout old workers cannot consume DB-issued tokens; drain/feature-off cutover is required. Rollback must not add a local-map fallback for DB-issued tokens. |
| Auth session revoked between issue and consume | Challenge transaction locks/checks AuthSession; revocation and consume serialize. | **Sound for challenge consumption if lock order is correct.** Revocation commits first → consume sees revoked and fails. Consume commits first → challenge is spent while session is active. But inference/attendance write occur after releasing the AuthSession lock. The design must state whether an already-authorized in-flight request may finish after logout. To enforce “no mark after revocation,” the final attendance transaction must recheck the durable session before committing attendance; challenge consumption alone does not guarantee this. |
| Attendance session finalized before challenge consumption | Issue/consume are to recheck session active; final design says lock/read “if” required. | **Not sufficiently enforced.** Challenge consume occurs before the route reads/checks session state. Current controller checks `CLOSED` after consumption, so a session closed before that read fails closed but burns the challenge. More importantly, if closure happens after the controller's status check and before the attendance transaction commits, the transaction does not presently condition its claim on session status. The design needs a mandatory ACTIVE check at the final attendance claim, serialized with finalization, with a shared lock order. The current finalization path reconciles attendance rows before updating the session row; naively locking TrainingSession first in the attendance path can deadlock unless finalization uses the same order. |

## Findings and required design changes

### BSR05-R1 — No global bound for challenge rows or issuance rate (HIGH)

The old process-local implementation had a global pending cap of 10,000 as well as a per-operator cap of 10. The final design preserves only the per-operator pending cap and leaves a global cap optional. An attacker with one authorized account can repeatedly issue/consume or allow expirations; many accounts can create unbounded pending rows and drive connection, index, storage, cleanup, and lock pressure. Per-operator pending count does not bound consumed rows awaiting cleanup or global request rate.

**Required change:** Define a bounded global pending quota with a cross-instance synchronization method (for example, a narrowly scoped PostgreSQL advisory transaction lock plus a count/insert transaction, or a quota-bucket/counter model), retain a per-operator limit, and implement distributed per-operator/session and/or source rate limits before DB-heavy work. Bound request size, DB pool/statement/lock waits, cleanup batch and retry count. Document that global serialization is a throughput tradeoff and load-test it. Do not rely on cleanup alone for admission control.

### BSR05-R2 — Expiration timestamp can straddle the deadline (HIGH)

The SQL sketch separately calls `clock_timestamp()` for `consumedAt` and the expiry predicate. At the deadline, those calls need not return the same instant. Lock waiting also makes it unsafe to take a timestamp before the relevant row lock is acquired.

**Required change:** After locking the exact challenge row (and validating bindings), obtain one PostgreSQL timestamp and use that same captured value for both `expiresAt > now` and `consumedAt = now`. Ensure the row lock is acquired before time capture. A cleanup transaction that obtains the row first may delete only if expired at its own DB-time check; a consume transaction obtaining it first must still fail if its post-lock timestamp is at/after expiry. Test expiry equality and a delayed lock waiter.

### BSR05-R3 — Session and attendance finalization are not protected through the attendance commit (HIGH)

The design locks/checks auth session while consuming a challenge but releases that lock before face comparison and attendance persistence. It checks the attendance session during issue/consume but does not define a mandatory status recheck/lock in the final attendance transaction. A session can close after the controller's read and before the write. A user session can also be revoked after challenge consume but before attendance commit.

**Required change:** Define authorization linearization for the complete mark. The attendance-claim transaction must recheck `AuthSession` live state and `TrainingSession.status='ACTIVE'` at its commit boundary (prefer conditional claim/update or a lock protocol). Coordinate row-lock ordering with session finalization: the existing finalizer updates attendance before its session status, so changing attendance to lock session then attendance without changing finalizer order can deadlock. Add concurrent close-vs-mark and logout-vs-mark tests. If policy intentionally permits already-started requests to finish, record that explicitly and still serialize close-vs-mark so no attendance is written after a closed-state commit.

### BSR05-R4 — Challenge subject semantics conflict with planned 1:1 verification (HIGH / scope blocker)

The design omits a cadet subject ID because the currently inspected code performs staff-operated 1:N roster matching. The later Phase 5/7 specification requires 1:1 verification and allows a cadet to initiate. In that flow, an operator/session-only token is reusable for any person/context in the session and cannot prove the requested subject binding.

**Required change:** Choose and document one flow before schema approval. For the planned 1:1 design, add `subjectCadetId` (or equivalent authenticated subject ID) to the challenge, require it from the authenticated cadet rather than a staff-controlled arbitrary body value, use a composite relation to session eligibility where schema permits, and match only that person's template. Keep roster-wide staff matching a separate contract if retained. A challenge still is not liveness or trusted capture.

### BSR05-R5 — No database-enforced TTL ceiling or token digest format check (MEDIUM)

The SQL checks only `expiresAt > createdAt`; they do not cap duration or validate that `tokenHash` is exactly lowercase hex. A future bug or alternate writer could insert an effectively permanent pending challenge, or malformed values that violate digest assumptions. Current code-generated hashes are correct, but important format/TTL assumptions are only application-level.

**Required change:** Add a check for the accepted digest format and the approved maximum TTL (initially preserve 30 seconds, plus only an explicitly chosen small clock/precision allowance). Keep DB time as authoritative. Validate that Prisma's type and PostgreSQL constraint match (prefer `TEXT` plus a regex/length check over padded `CHAR(64)` if exact digest formatting is part of the invariant).

### BSR05-R6 — Lock, timeout and error policy needs operational details (MEDIUM)

`READ COMMITTED`, row locks, and bounded serialization retries are described, but no `lock_timeout`, statement timeout, transaction timeout, connection pool budget, or cancellation policy is selected. A flood of locked issue/consume calls could occupy the shared backend pool. Issue errors are currently caught as HTTP 500 by the controller, not sanitized 503.

**Required change:** Set bounded DB/lock timeouts for these operations, bound retries, ensure transaction callbacks do not perform slow work, map outage/timeout to sanitized fail-closed service errors, and add metrics without token/PII. No fallback to in-memory storage.

## Missing constraints and transaction details

1. Keep `tokenHash` unique and include both authentication-session and attendance-session bindings in consumption predicates.
2. Preserve the composite `(authSessionId,operatorUserId) -> AuthSession(id,userId)` FK. Verify `AuthSession` still has `@@unique([id,userId])`; keep the FK ownership invariant in SQL even if relation navigation is represented differently in Prisma.
3. Add a max-TTL check and digest syntax/length check; retain time-order checks.
4. Use one consistent lock order for all challenge issue/consume, auth-session revocation, attendance marking and session finalization paths. Document an order table and test both opposing transaction schedules.
5. A User row lock is adequate for per-operator quota only if all issuers lock the same user row and hold it through count+insert. It does not provide a global cap.
6. Cleanup must be bounded, use indexed predicates and `SKIP LOCKED`; deletion eligibility and consume both use post-lock DB time. Cleanup must not make a still-valid challenge unavailable.
7. Preserve the audit/accountability path outside the challenge record if a future policy requires challenge events. Challenge cleanup must not erase attendance audit rows.
8. Explicitly define the semantics of an uncertain commit: never re-accept; require a new challenge. An insert whose commit result is lost may leave a short-lived orphan that consumes quota until expiry.

## Current tests and verification limits

The existing pure unit test checks token issuance, per-operator pending cap, successful consumption, replay rejection, expiry, different-operator quota isolation, and unknown-token behavior. The biometric controller mocks exercise disabled-by-default gating, replay, concurrent reuse in one process, and cross-session rejection. These tests do **not** establish:

- Two separate PostgreSQL connections/worker processes racing the same token.
- PostgreSQL lock-wait and expiry-at-boundary behavior.
- Concurrent DB-backed issuance quota correctness or a global cap.
- Concurrent auth-session revocation/consume ordering.
- Concurrent session closure/attendance write ordering or deadlock freedom.
- DB outage, lock timeout, uncertain commit, cleanup concurrency, restart persistence, or mixed-version cutover.
- Cadet subject binding for the later 1:1 flow.

No tests were run for this review. The current in-memory implementation is single-process atomic because `consume()` performs synchronous `Map.get` + `Map.delete`; it is not evidence for a shared PostgreSQL adapter.

## Critical findings

No demonstrated critical exploit is established by this design-only review while biometric attendance remains disabled. The following are **high-severity blockers before any implementation/activation**:

1. Global challenge/resource/rate bounds are unresolved.
2. Expiry timestamp handling is not atomic at the deadline/lock-wait boundary.
3. Session revocation and session finalization are not guaranteed through the final attendance commit.
4. Challenge subject scope is unresolved for the stated 1:1 cadet flow.

## Remaining risks

- Challenge tokens remain bearer secrets; a token alone says nothing about liveness or descriptor provenance.
- Existing client-controlled descriptor/quality behavior remains a separate high-severity activation blocker.
- Database outage intentionally disables biometric verification, though manual attendance remains available.
- PostgreSQL concurrency, migrations, rollback and deployment topology have not been executed or verified.
- Consent, model licensing, PAD, retention, institutional policy and activation approvals remain separate unresolved gates.

## Required design changes before implementation

1. Choose subject scope: staff 1:N roster match versus cadet 1:1 verification; include `subjectCadetId` for the latter.
2. Specify per-operator, per-session and global quotas/rate limits with cross-instance atomicity and bounded resource use.
3. Replace the separate `clock_timestamp()` calls with post-row-lock, single-timestamp expiry/consume logic; specify the matching cleanup transaction.
4. Define final attendance transaction checks for active auth session and active attendance session, and align row-lock order with session finalization.
5. Add DB format and max-TTL constraints; complete exact Prisma relation validation and SQL migration design.
6. Specify DB statement/lock/pool timeouts, bounded retry policy, sanitized HTTP mapping and no-fallback behavior.
7. Add PostgreSQL integration cases for the listed races on an authorized isolated disposable database; do not run until separately authorized.

## GO / NO-GO

**NO-GO for implementation as written.** The conditional single-use row update is a good core primitive, but the subject-flow mismatch, missing global quota, expiry edge, and uncoordinated final attendance/session-close boundary must be resolved first. **GO for revising the design only.** No application, schema, database, test, or flag changes were made.
