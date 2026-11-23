# BSR-05 Remaining Decisions — Technical Recommendation Review

> **Historical recommendation report (23 November 2026):** this document predates the project-owner approvals recorded in `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`. Its candidate values and “UNDECIDED / approval required” labels are not current approval status. Use the decision register for approved values; this report remains useful for its technical rationale and acceptance-test ideas. It does not evidence implementation or PostgreSQL verification.

**Purpose:** Technical recommendations for project-owner review. This document is not an approval, implementation authorization, migration plan, or evidence that any recommendation is active.

**Safety state:** `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled. No database was accessed, no container was started, and no source, schema, SQL, migration, feature flag, or operational-decision register was changed. Manual attendance remains independent.

## Executive recommendation

| Item | Recommendation (not approved) | Repository-evidence status | Owner approval still required |
|---|---|---|---|
| Token-bucket scope | Charge both one global bucket and one subject bucket on each valid challenge issuance; no operator bucket for the approved self-service flow. Candidate settings: capacity 5 and refill 1 token/60 seconds at both scopes. | Schema has global and subject buckets; exact scope is unresolved in the register. | Yes: approve scope and confirm the same values apply at both levels. |
| Retained challenge-row cap | Candidate hard cap: 10,000 total retained challenge rows, separate from 1,000 outstanding globally and 3 per subject. | `retainedLimit` and `retainedCount` exist in the proposed schema; no measured database storage budget exists. | Yes: approve after disposable-database size/load measurement. |
| Cleanup | At most 500 rows and 100 subjects per transaction, every 5 minutes; alert on 15-minute lag, critical at 60 minutes; never delete early; deny new issuance at the retained cap. | Current code prunes its local map every 60 seconds; no shared cleanup worker exists. Schema has `cleanupBatchLimit` and `cleanupSubjectLimit`. | Yes: approve limits, cadence, and alert behavior. |
| Timeout budgets | Challenge transaction 8 seconds; issuance/consumption route 12 seconds; cleanup transaction/operation 15/20 seconds; reconciliation transaction/operation 25/30 seconds; DB lock wait 2 seconds. Keep approved statement 5 seconds and idle-in-transaction 10 seconds. | No explicit database timeout configuration or Prisma transaction options found in application transaction calls. | Yes: approve new values and verify under load. |
| Recovery identity verification | Two distinct, allowlisted senior NCC administrators; each uses a live durable session plus fresh password and purpose-bound OTP step-up; each proof valid for **5 minutes**; the recovery proposal expires **15 minutes** after successful reconciliation; one-use independent approval bound to the same gate revision/evidence. | Durable sessions and login OTP exist, but there is no step-up recovery proof, designated approver allowlist, or recovery approval store. | Yes: approve assurance method, expiry values, and eligible identity provisioning. |
| Policy-activation audit | Append-only proposal/approval/activation events with policy hashes, both administrators, durable-session references, reason/change reference, gate revision, DB timestamps, outcome, and reconciliation evidence. Recommend indefinite retention, no runtime DML. | Policy rows and integrity-gate events exist in Prisma; no policy lifecycle audit entity exists. Decision 3’s indefinite retention covers gate transitions, not explicitly policy lifecycle events. | Yes: approve exact audit schema and retention. |

**Separate remaining Decision 5 blocker:** maximum attendance-window duration remains **UNDECIDED**. The register also contains a stale sentence in its configuration section saying minimum duration and past-start handling remain unresolved; the Decision 5 row and readiness summary say the positive interval and late-start rule are approved. This report does not edit the register.

## Repository evidence and current behavior

- The current challenge store is `backend/src/services/verificationChallengeStore.ts:21-73`: a process-local `Map`, 30-second default TTL, per-operator default 10, global default 10,000, SHA-256 digest keys, and synchronous one-process consumption. The attendance controller configures these values at `backend/src/controllers/attendance.controller.ts:24-36` and prunes every 60 seconds. These are legacy implementation limits, not shared PostgreSQL policy.
- The current challenge issuance path is in `attendance.controller.ts` around lines 845-885. It is officer-oriented, binds `req.user.id` as the challenge owner, and is not the proposed cadet-self-service 1:1 contract. It must not be enabled as a substitute for the redesigned route.
- `AuthSession` at `backend/prisma/schema.prisma:213-227` stores user, expiry, revocation, and creation time, with a composite `(id,userId)` uniqueness constraint. `authenticateToken` at `backend/src/middleware/auth.middleware.ts:45-64` verifies a signed JWT, requires `sid`, and checks the durable session is unrevoked and unexpired. Login creates a durable session after login OTP verification in `otpAuth.controller.ts:259-268`.
- The authentication schema does not record a step-up time, authentication assurance, MFA method, or a designated recovery-approver assignment. The existing `ADMIN_ANO` role is an application role, not evidence that the account is a designated integrity-recovery approver.
- `TrainingSession` at `backend/prisma/schema.prisma:649-669` has legacy string `timing`, `startTime`, and `endTime`, plus nullable canonical `timestamptz` attendance-window fields. The canonical fields are not populated by current session creation. The controller accepts multiple attendance-start roles and immediately creates an `ACTIVE` session (`attendance.controller.ts:161-177,193-219`).
- The proposed schema already has `BiometricChallengePolicy` values for global/subject buckets, retained-row limit, cleanup row/subject limits, and retentions (`schema.prisma:847-870`); quota counters are separate global and subject models (`873-899`). The challenge binds a subject, training session, durable auth session, policy, purpose, and expiry (`901-923`). Integrity gate/event models exist at `928-965`, but no policy proposal/approval/activation event model is present.
- `ProcessLocalRateLimitStore` is explicitly process-local (`backend/src/services/rateLimitStore.ts:1-35`). It does not provide cross-instance quota enforcement.
- `backend/src/runtimeConfig.ts` validates PostgreSQL URL shape, secrets, and port; it does not configure database operation deadlines. The Prisma transaction calls located in controllers do not pass explicit `$transaction` timeout options. `backend/src/server.ts:164-168` has a 10-second forced shutdown timeout, which is unrelated to a database transaction budget. SMTP timeouts are also unrelated and should not be reused.

## 1. Token-bucket scope

### Recommendation (not approval)

For the approved cadet-self-service 1:1 flow, enforce **both a global bucket and a per-subject bucket** in the same PostgreSQL transaction. Use the explicitly provided candidate values at both scopes: **capacity 5 tokens; refill 1 token per 60 seconds**. Do not add a per-operator bucket: the approved flow has no operator-owned challenge. Staff-assisted issuance stays unavailable unless separately designed and approved.

Each eligible issuance atomically refills both balances from one database timestamp, verifies both balances, decrements one token from each, and reserves outstanding/retained capacity. Failure at either scope rolls back both charges and the challenge insert. A successfully issued challenge spends its attempt token even if the client never consumes it or later inference fails; otherwise failed/abandoned attempts could evade rate control. A transaction rollback caused by an internal database failure does not charge either bucket.

### Evidence, trade-offs, dependencies

The Prisma policy already has separate global and subject capacity/refill fields. The global bucket limits aggregate database work and protects against a distributed population generating challenges faster than the service can sustain. The subject bucket limits one cadet and is fairer than global-only throttling. Both are cross-instance only when the bucket row updates and challenge insert are atomic in PostgreSQL. Global-only would let one subject consume the whole allowance; subject-only has no aggregate ceiling when many subjects act at once. Operator scope conflicts with the recorded no-operator-quota decision and the intended self-service identity binding.

Implementation dependency: the future issue routine must lock the global quota, then the single subject quota, under the agreed User → AuthSession → TrainingSession → quota lock order. Do not maintain a process-local fallback. The current route's `userId` is an officer/operator and cannot simply be reinterpreted as the cadet subject.

### Acceptance tests

1. Two concurrent issuances cannot overspend the global or subject balance.
2. Exhausting either bucket rejects issue and changes neither the other balance nor challenge/quota counters.
3. Two subjects compete: one subject can exhaust its own bucket without exhausting another subject's bucket, subject to the global ceiling.
4. Restarting or adding a second API instance does not reset balances.
5. DB rollback restores both token balances; a committed issuance spends both exactly once.
6. Legacy staff challenge endpoints remain unavailable and cannot create operator-bound challenges.

**Decision status:** scope is **UNDECIDED** in the approval register; values are recorded, but applying them at both levels is only this recommendation.

## 2. Maximum retained challenge rows

### Recommendation (not approval)

Use a database-enforced `retainedLimit` candidate of **10,000 total rows** in `BiometricVerificationChallenge`. This is a separate limit from **1,000 outstanding globally** and **3 outstanding per subject**. Retained count includes outstanding and terminal-but-not-yet-purged challenge metadata.

The 10,000 candidate is derived from the proposed global bucket, not copied from the old in-memory Map: capacity 5 plus at most one token per minute gives approximately **1,445 issuances per 24 hours** at a continuously full bucket. 10,000 rows is roughly 6.9 days of that maximum issue rate if cleanup stops. The 24-hour consumed/expired retention adds a bounded normal working set; the row cap is the hard stop if cleanup or traffic assumptions fail.

### Enforcement and trade-offs

- On insert, under the global quota row lock, atomically increment `retainedCount` and refuse if it would exceed `retainedLimit`. Separately increment global and subject outstanding counters only for unconsumed challenges.
- On consumption, decrement outstanding counters once; do not decrement retained count.
- On eligible retention deletion, decrement retained count once; if the row is still unconsumed, also decrement outstanding counters once. Expiration alone never decrements either counter.
- Cleanup failure therefore cannot cause unbounded challenge-table growth or prematurely free capacity. At the hard cap, return a controlled unavailable/limit response and issue no new challenge. Do not delete unexpired challenges or apply an emergency cap increase.
- This cap covers challenge records only. It does not bound subject quota rows, policy history, or append-only audit events; those need separate lifecycle/storage monitoring.

No repository evidence gives the disposable database's storage budget, row/index size, or expected synthetic load. The candidate requires a PostgreSQL test measuring relation/index bytes at the cap and confirming disk headroom. Because its safety depends on a global issuance bucket, do not activate this cap if only per-subject token buckets are adopted.

### Acceptance tests

1. Concurrent inserts at `retainedLimit - 1` permit exactly one row and reject the next.
2. Consuming a challenge releases outstanding capacity but not retained capacity.
3. Cleanup of an expired-unconsumed challenge decrements retained and outstanding once; a consumed challenge decrements retained only.
4. Failed cleanup and transaction rollback leave all counters unchanged.
5. A duplicate cleanup/retry cannot double-decrement.
6. Synthetic load reaches the cap without exceeding it; database relation and index size are measured and alert thresholds tested.

**Decision status:** retained-row value remains **UNDECIDED** and needs project-owner approval after disposable-database measurement.

## 3. Cleanup policy

### Recommendation (not approval)

| Setting | Candidate recommendation |
|---|---:|
| Maximum challenge rows per cleanup transaction | **500 rows** (already recorded as approved) |
| Maximum distinct subject quota rows locked/processed per transaction | **100 subjects** |
| Worker cadence | **Every 5 minutes** |
| Warning backlog age | **15 minutes** |
| Critical backlog age | **60 minutes** |

Treat the approved 24-hour consumed/expired retention as a **minimum retention period**: a consumed row is eligible after `consumedAt + 24h`; an unconsumed expired row after `expiresAt + 24h`. Delayed cleanup may retain longer; it must never purge earlier to recover quota.

### Transaction and failure behavior

Use one bounded database routine per batch. Acquire the global quota lock, select/lock subject quota rows in sorted subject-ID order (at most 100), then lock eligible challenge rows by stable ID, respecting the established order. Recheck `consumedAt`, expiry, and retention eligibility after locks. Use `SKIP LOCKED` only after required quota locks are acquired; perform row deletes and counter decrements in one transaction. Do not delete subject quota rows as part of challenge cleanup: deleting a bucket row could reset that subject's rate limit.

If the worker falls behind, process successive bounded batches; never increase batch sizes dynamically. Emit lag/age, eligible-row count, retained-count, and last-success metrics. Alert at 15 minutes and escalate at 60 minutes. If a batch fails, roll it back entirely and retry on the next scheduled run with bounded backoff; do not change counters outside the delete transaction and do not switch to an in-memory cleanup path. At the retained cap, challenge issuance fails closed. Existing unexpired challenges remain governed by their own expiry/session checks.

The 100-subject cap limits lock fan-out while permitting up to 500 rows to be removed when several rows belong to each subject. It must be implemented so a batch never locks a 101st subject or deletes rows whose subject counter was not locked. A cleanup worker lease/advisory lock may prevent duplicate work, but row locks and atomic counters—not the lease—provide correctness.

### Acceptance tests

1. Worker never deletes a row before the 24-hour terminal retention boundary.
2. A 500-row/100-subject maximum is enforced under concurrent workers.
3. Two cleanup workers produce no duplicate count decrement or lost rows.
4. Consumption racing cleanup has one valid winner; an already consumed challenge is not treated as outstanding by cleanup.
5. Cleanup outage increases backlog/retained count but cannot exceed the hard cap; issuance is rejected at the cap.
6. Subject quota rows and token balances are not reset by cleanup.
7. Lag alerts fire at configured age thresholds and recover after backlog drains.

**Decision status:** row count is recorded; subject count, cadence, and alert thresholds remain **UNDECIDED** pending approval and concurrency tests.

## 4. Additional timeout budgets

### Recommendation (not approval)

| Layer / operation | Candidate maximum | Evidence or relationship |
|---|---:|---|
| PostgreSQL lock wait | **2 seconds** | Already approved in the register. Applied per lock wait; a timeout aborts the transaction. |
| PostgreSQL statement | **5 seconds** | Already approved. Per SQL statement, not a total transaction limit. |
| Idle-in-transaction | **10 seconds** | Already approved. Detects an open transaction idle between statements; does not cap an actively running transaction. |
| Prisma connection/transaction acquisition (`maxWait`) | **1 second** | New recommendation. Bounds waiting for a pool connection before transaction work starts. |
| Challenge issue transaction | **8 seconds** | New recommendation. Explicit Prisma interactive-transaction timeout; all DB work must finish or roll back. |
| Challenge issue end-to-end handler | **12 seconds** | New recommendation. Includes auth middleware DB checks and issue transaction; return no success if deadline expires. |
| Challenge consume transaction | **8 seconds** | New recommendation. Exact single-use consume and counter updates are one transaction. |
| Challenge consume end-to-end handler | **12 seconds** | New recommendation. Includes auth middleware and consume; no local retry/fallback on timeout. |
| Cleanup transaction | **15 seconds** | New recommendation for the bounded 500-row/100-subject operation; statement and lock caps still apply. |
| Cleanup job operation deadline | **20 seconds** | New recommendation, leaving a bounded margin to report failure/rollback before next five-minute cadence. |
| Reconciliation transaction | **25 seconds** | New recommendation; gate must be BLOCKED during reconciliation. Timeout leaves it BLOCKED. |
| Reconciliation job deadline | **30 seconds** | New recommendation. If a single SQL statement exceeds the already approved 5-second statement cap, reconciliation fails closed rather than silently raising the cap. |

These budgets are intentionally layered: pool acquisition is outside the transaction; transaction time bounds a multi-statement unit; statement timeout limits each query; lock timeout limits lock waiting; idle timeout catches an abandoned open transaction; handler/job deadline bounds the caller-facing operation. A shorter inner budget can fail first. The outer deadline must never return success while a transaction outcome is unknown; issue returns no bearer token on unknown commit, and consume treats the challenge as spent if commit outcome is unknown.

Existing configuration validates `DATABASE_URL` shape but sets none of these database settings. SMTP and AI request timeouts and the server's 10-second shutdown watchdog are unrelated. No global HTTP request timeout was found. Implement with explicit PostgreSQL `SET LOCAL` values and explicit Prisma transaction options after checking resolved Prisma semantics, plus an outer cancellation/deadline that actually cancels DB work. Avoid holding a transaction during inference, network I/O, or user interaction.

### Acceptance tests

1. A blocked row lock fails around 2 seconds; no partial transaction commit occurs.
2. A query exceeding 5 seconds is canceled; transaction timeout remains bounded at 8 seconds.
3. Delayed pool acquisition fails at 1 second and does not begin a partial transaction.
4. Issue/consume handler deadlines return sanitized unavailable responses and do not emit an uncommitted token/result.
5. Cleanup and reconciliation timeouts roll back their batch; gate stays BLOCKED on failed reconciliation.
6. Idle transaction is terminated at 10 seconds while a continuously active transaction is bounded by its own transaction deadline.
7. Timing tests assert tolerances appropriate for CI scheduling, not exact wall-clock equality.

**Decision status:** lock, statement and idle values are recorded; new transaction/handler/job/acquisition budgets remain **UNDECIDED** and require owner approval and disposable-database timing evidence.

## 5. Recovery identity verification

### Recommendation (not approval)

The approved two-person rule should require **two different, individually designated senior NCC administrator identities**, not merely two sessions or two accounts with the ordinary `ADMIN_ANO` role.

1. A recovery approver must have an explicit, separately governed recovery-approver assignment. `ADMIN_ANO` is necessary for administrative workflow but is not sufficient to restore the gate.
2. Each person signs in through the existing password-plus-login-OTP flow and uses their own durable `AuthSession`. At proposal and approval time, recheck the current user status/role and query `AuthSession` for the exact `(id,userId)`, `revokedAt IS NULL`, and `expiresAt > database_now()` under lock. Do not trust a JWT role snapshot or caller-supplied user/session IDs.
3. Require fresh step-up authentication for each human: current password plus a new OTP bound to `BIOMETRIC_RECOVERY`, the proposal ID, gate revision, and reconciliation evidence digest. Store only one-way proof/challenge state, never the OTP. One-time use, short expiry, rate limit, and atomic consume are required. The proposer cannot approve their own proposal; approval binds to the exact policy/gate revision and hash.
4. After both independent confirmations, an authorized maintenance capability activates recovery in one transaction: recheck both distinct approver identities and active sessions, reconciliation success, current BLOCKED revision, no intervening state change, and audit insertion; then atomically transition the gate and append its event. Any stale session, duplicate/replay, mismatch, or audit failure leaves the gate BLOCKED.
5. No API served by the ordinary runtime role can invoke recovery or write the gate state directly. Use a separate narrowly granted maintenance capability and audit every proposal, denial, approval, and restoration.

### Evidence, trade-offs, dependencies

The current middleware validates durable sessions, and login uses a password/OTP path before creating `AuthSession`. However, there is no step-up claim, recovery-purpose OTP, allowlist for designated recovery administrators, or independently authenticated activation mechanism. Thus repository evidence does **not** establish that email OTP is an acceptable assurance method for recovering a security gate or that email accounts are sufficiently independent. A compromised mailbox/account could defeat recovery. An ordinary `ADMIN_ANO` role must not be treated as adequate proof.

Proposed schema work likely needs a recovery proposal/approval entity with proposal ID, gate revision, reconciliation digest, two distinct approver IDs/session IDs, step-up challenge digest/expiry/consumption, reason/reference, and immutable event history. Approval proof/session references need a deliberate account-deletion strategy; do not cascade-delete indefinite recovery audit evidence. A separate allowlist/assignment requires an owner and provisioning/removal process. Database functions must deny the runtime role direct gate/policy mutation and activation execution.

**Cannot safely decide from repository evidence:** whether password + email OTP is sufficient, whether a hardware-backed/passkey factor is required, who assigns eligible administrators, and how emergency access works. Mark recovery identity assurance **UNDECIDED** until the project owner selects the assurance level and authorized principals.

Concrete expiry candidates: each step-up proof expires after **5 minutes**; the complete proposal expires **15 minutes after successful reconciliation**. These values are recommendations, not repository-supported or approved. Expiry requires fresh authentication and a new reconciliation-bound proposal.

### Acceptance tests

1. Same person cannot satisfy both approvals even with two sessions; same ID is rejected.
2. Two ordinary `ADMIN_ANO` accounts without recovery assignment are rejected.
3. Inactive/revoked/expired durable sessions, stale role/status, and missing step-up are rejected.
4. Proposer/approver proofs bind to the exact gate revision, policy hash, and reconciliation digest; changing any value invalidates approval.
5. Replayed or expired proof cannot be consumed twice; concurrent approval has exactly one winner.
6. Audit persistence failure leaves the gate BLOCKED.
7. Runtime DB role cannot directly update gate/policy or execute recovery activation; only the maintenance capability can.

**Decision status:** recovery assurance and designated-principal mechanism remain **UNDECIDED**; two-person rule itself remains approved.

## 6. Policy-activation audit

### Recommendation (not approval)

Use append-only lifecycle events separate from ordinary `AuditLog` and separate from integrity-gate transition events. The current `BiometricChallengeIntegrityEvent` captures gate revisions/transitions but does not encode a full two-person policy lifecycle. Recommended immutable event kinds: `PROPOSED`, `APPROVED`, `REJECTED`, `ACTIVATED`, `ACTIVATION_FAILED`, and `SUPERSEDED`.

Each event should contain:

- Opaque event ID, proposal/change ID, event kind, database-generated `occurred_at`, result/reason code, and correlation ID.
- Proposed policy version, SHA-256 config hash, and a reference to the immutable policy row; on activation, old active version/hash and new version/hash.
- Proposer's stable user ID, durable auth-session ID, verified role/eligibility snapshot, and proposal time.
- Approver's distinct stable user ID, durable auth-session ID, verified role/eligibility snapshot, and approval time; record the exact hash approved.
- Activation principal/actor and activation time; maintenance capability identity; the gate's prior/new revision and state.
- Human reason and change/incident reference; reconciliation run ID and result/digest; activation outcome and sanitized failure code.
- Step-up method and verification timestamp/assurance level, but never passwords, OTP values, JWTs, cookies, raw challenge tokens, secrets, face data, or authentication response bodies.

Store canonical policy content once in the immutable policy version row and reference it by version/hash rather than duplicating secret-bearing configuration in audit. Database timestamps are authoritative. Each transition is a separate append-only event; an approval event must be tied to one exact proposed hash, and an activation must fail if that hash differs or the gate revision changed.

### Retention and access recommendation

Recommend **indefinite retention** for policy proposal/approval/activation events, matching the high-accountability treatment of gate transitions. This is a recommendation only: Decision 3 explicitly approves indefinite retention of integrity-gate transition events, but does not expressly approve policy lifecycle events. The project owner must approve this separate scope. Access should be limited to a read-only security/audit role and designated maintenance reviewers; runtime gets no direct SELECT/INSERT/UPDATE/DELETE on audit or policy tables. A narrowly scoped database function appends events. No update/delete, table ownership, trigger disablement, `SET ROLE`, or DDL privilege for runtime. Policy history is immutable; policy activation requires two-person approval through the maintenance capability.

To preserve attribution through account deletion, audit actor IDs should not be cascade-deleted with `User`/`AuthSession`. Use stable ID snapshots or restrictive references with a separately approved account deletion/anonymization path. Do not store email/name snapshots unless the institution approves the added personal-data retention.

### Acceptance tests

1. Proposal, approval, activation, rejection and failed activation each create the expected immutable event with DB time and matching policy hash.
2. Approver must differ from proposer; policy hash and gate revision must match at activation.
3. Runtime direct DML, delete/update, policy activation, ownership change, role escalation, and function execution outside grants are denied.
4. Activation + gate transition + audit event are atomic; audit insert failure rolls back restoration and leaves BLOCKED.
5. Event history remains queryable after policy supersession and follows the separately approved account deletion/retention behavior.
6. Logs and audit rows contain no OTP, JWT, cookie, secret, raw challenge token, embedding, or face image.

**Decision status:** exact event fields and separate policy-event retention remain **UNDECIDED**; two-person policy approval and audited controlled activation remain approved.

## Owner-approval list and implementation gate

Project-owner approval is still required for:

1. Global + per-subject token-bucket scope, and whether the recorded capacity/refill values apply to both buckets.
2. Candidate retained challenge hard cap of 10,000 rows, after measuring disposable PostgreSQL row/index/storage use.
3. Cleanup subject cap of 100, 5-minute cadence, 15/60-minute lag alerts, and fail-closed/cap behavior.
4. New timeout values: 1-second pool acquisition; 8-second challenge transaction; 12-second issue/consume handler; 15/20-second cleanup transaction/job; 25/30-second reconciliation transaction/job. Existing approved 2-second lock, 5-second statement, and 10-second idle-in-transaction values are not reopened.
5. Recovery step-up assurance, designated approver provisioning, 5-minute proof expiry, 15-minute proposal expiry, and emergency process; ordinary `ADMIN_ANO` role alone is insufficient.
6. Policy-audit fields and indefinite retention recommendation.
7. Separately, Decision 5 maximum attendance-window duration (deferred and an activation blocker).

**Recommendation:** Design the shared store around a global plus subject token bucket and fail-closed database-enforced caps, but do not create executable SQL until the project owner resolves these items, confirms the contradictory/stale Decision 5 sentence in the source register, and authorizes the implementation and disposable PostgreSQL verification phase. No recommendation in this report changes the source-of-truth register's status.
