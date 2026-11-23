# BSR-05 Independent Architecture and Transaction Security Review

**Review type:** Adversarial design review; no source/schema changes, DB connections, migrations, containers, or test execution.
**Overall decision:** **NO-GO for implementation or migration.**
**Active-state note:** No active biometric attendance exploit is established by this design review while `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled. That containment does not make the proposed database design ready.

## Executive assessment

The reconciliation improves the architecture by separating a future cadet-self-service 1:1 flow from the current staff-operated roster-wide 1:N route, binding the challenge to a durable session, using digest-only tokens, and rejecting process-local fallback. The specified PostgreSQL row lock and post-lock expiry time are directionally sound.

The design still has important concurrency and operational gaps. Most significantly, its lock hierarchy starts with `AuthSession` and later locks `User`, while the existing `AuthSession.user` relation cascades on user deletion. A concurrent account deletion can hold the user row and wait for the auth-session row while challenge issuance holds the auth-session row and later waits for the user row. That is a deadlock cycle the proposed hierarchy does not prevent. The quota design also bounds pending rows only while all issuers use the same global advisory lock; it does not bound total table growth if cleanup stalls, and fixed-window bucket configuration/retention is not made consistent across instances. Finally, the 54-case matrix has an off-by-one acceptance condition and several cases cannot be run as stated while the attendance flag must stay off and the proposed API does not exist.

## Review 1 — Identity and authorization

### Findings

1. **Subject binding is conceptually sound, implementation is absent.** The proposed 1:1 API derives `subjectCadetId` from authenticated `req.user.id` and uses the durable auth session. The actual mounted challenge and verify routes still authorize staff roles and call the roster-wide flow in `attendance.controller.ts`; the browser modal submits a descriptor and preloads eligible biometrics. A URL `sessionId` is still client-selected and must be checked against session state, cadet eligibility, date/window, consent, and the authenticated cadet before creating or consuming a challenge.
2. **Staff impersonation is prevented only if the new endpoint is distinct.** The current staff endpoint can nominate/scan within the officer's authorized roster. It must not share the new self-service challenge consumer or accept `cadetId` as a target. The legacy roster route must remain disabled or be separately removed/retired before any future biometric route is enabled.
3. **Cross-cadet token use is rejectable, but lookup order matters.** If the application locks a digest row and only afterward discovers a wrong subject, a malicious caller can cause lock contention. It must not consume the rightful row or disclose token existence. The query should constrain lookup by digest and authenticated bindings where possible; if a generic lookup is required to lock the row, keep the same external response and ensure no mutation occurs before every binding check.
4. **Revoked/old JWT behavior depends on durable-session checks at both stages.** Existing middleware rejects sid-less tokens and checks that the JWT `sid` maps to a live `AuthSession`. That check occurs at request start. The proposed transactions correctly call for a final row lock/check, but the lock order with account deletion and all session revocation routes must be fixed first. JWT signature/expiry validation remains middleware responsibility; the store must never accept a token based solely on a supplied `sid`.
5. **Attendance-session binding is required but not sufficient by FK.** `trainingSessionId` FK only proves existence. The service must enforce session `ACTIVE`, time window, purpose, subject eligibility, and relevant consent/enrollment each time. The final attendance write must recheck all mutable authorization inputs. No client target or provider/model metadata should be accepted as an authorization fact.
6. **The legacy route must not become reachable through the new store.** The current roster-wide handler is guarded by `ENABLE_BIOMETRIC_ATTENDANCE`; that guard is presently off, but setting it true would expose the existing client-descriptor 1:N path. The design must require the old route to remain disabled/retired independently of the new route and must not treat a future flag change alone as activation of the new 1:1 system.

### Required correction

Keep separate route/controller contracts for staff manual attendance and cadet 1:1 verification. The latter must derive user and auth-session identity only from authenticated middleware, reject staff roles, reject target identity fields, bind a single attendance session, and query exactly one authorized template. Do not integrate the mock provider or turn on the feature flag as part of BSR-05.

## Review 2 — Transactions, locks, isolation, and deadlocks

### HIGH H1 — Lock hierarchy omits `User`/account deletion ordering

The lock specification orders `AuthSession → TrainingSession → User → Challenge → Attendance`. In the current Prisma schema, `AuthSession.user` has `onDelete: Cascade`. A user-deletion transaction can lock the `User` row and then delete/cascade its `AuthSession` rows. Concurrent challenge issuance can lock `AuthSession` first and then request the `User` lock for eligibility. Schedule:

1. Deletion holds `User(A)` and waits to cascade/delete `AuthSession(S)`.
2. Issuance holds `AuthSession(S)` and waits for `User(A)`.
3. PostgreSQL detects a deadlock and aborts one transaction.

This is not hypothetical with the proposed schema and existing referential action. Account deletion/retention remains an unresolved design concern in the repository. A deadlock abort is safe against unauthorized success, but it contradicts the stated goal of a consistent deadlock-preventing global order and could cause repeated failures.

**Correction:** revise the common hierarchy to acquire all involved `User` rows first (ascending user id), then all `AuthSession` rows (ascending id), then `TrainingSession`, quota/challenge/attendance/audit resources as specified below. Logout/revoke should use the same owner-user-before-session sequence. Account deletion already begins with the user row, so this aligns with the existing cascade direction. Alternatively, remove/replace the cascade in a separately approved schema design and prove deletion ordering. Do not merely suppress or retry deadlocks.

For staff writes involving an operator and one/many cadets, lock all required user rows sorted by id before any auth-session or session row. If the finalizer does not need cadet row locks, it must still define eligibility snapshot semantics. Any operation that later acquires an earlier-tier `User` lock is a protocol violation.

### HIGH H2 — The protocol does not yet prove every writer follows it

The current `markAttendance`, `bulkImportAttendance`, `endAttendanceSession`, biometric verification, and some session counter/update paths use reads outside the write transaction and do not share a lock order. The design identifies several of these but says “inventory every route/service” as a future checklist. A protocol document cannot provide cross-operation serialization until every relevant writer—including logout, single/all-session revocation, user deactivation/deletion, corrections/import, session close, session status updates and cleanup—is inventoried and either migrated or explicitly proven disjoint.

**Correction:** make a lock inventory table a prerequisite: operation, rows locked, exact order, transaction boundary, mutable authorization rechecks, and whether it can wait on a prior lock. Gate migration on a source review demonstrating no inverse acquisition. Manual attendance must remain supported and preserve existing correction semantics.

### MEDIUM M1 — Quota lock order differs between documents / needs sharper transaction semantics

The architecture places advisory locks and quota bucket rows before `AuthSession`; the lock spec says the same, but account/user lock ordering is currently inconsistent with the later user lock. The global lock protects counts only if all issuing code paths and all application instances use the same key, lock mode, namespace, transaction scope, and `READ COMMITTED` behavior. A path that counts without the advisory lock, a legacy instance using the Map, or a process with another quota policy can violate the intended aggregate bound.

`READ COMMITTED` is appropriate for the serialized count-then-insert approach only when the advisory lock is the first DB operation establishing the relevant statement snapshot and the count is a later statement after the lock is acquired. `REPEATABLE READ`/`SERIALIZABLE` can retain an older snapshot after waiting or abort with serialization failures; either enforce `READ COMMITTED` for this operation or specify bounded retry semantics. A transaction-level advisory lock is not a database constraint and cannot protect writes from code that omits it.

**Correction:** centralize issuance behind one service; assert transaction isolation; acquire all quota locks before row locks in every issuer; use one stable documented key derivation; add tests for mismatched/legacy issuers and per-instance config mismatch. Do not claim the quota is DB-enforced solely because a bucket table exists.

### MEDIUM M2 — Candidate expiry-cleanup SQL needs an executable semantics review

The revised cleanup CTE selects candidates using `clock_timestamp()` before acquiring row locks, then captures another timestamp behind a materialized count barrier and rechecks in `DELETE`. The second check is the important one and protects rows that expired while waiting. However, the report has not established by execution that the CTE is materialized/evaluated in the assumed sequence for the pinned PostgreSQL version, that the count barrier waits for all candidate locks to be acquired, or that `LIMIT … FOR UPDATE SKIP LOCKED` behaves as expected under the actual query plan. Cleanup candidates may be skipped while a consumer holds a lock, which is safe, but the one-time barrier needs a disposable two-client proof before implementation approval.

**Correction:** keep cleanup as a dedicated short transaction; select/lock a bounded batch, then obtain one DB timestamp in a dependent statement after locks are held; recheck expiry and retention before delete. Validate with a lock-wait test and inspect the plan on the disposable server. Cleanup must never acquire parent locks after challenge locks.

### Transaction boundary observations

- Challenge consumption commits before inference. This avoids holding DB locks across slow work, but a process crash or inference failure spends the token. That is an availability tradeoff and should be explicit. It does not create duplicate attendance.
- Final attendance is a later transaction. It must recheck durable auth session, session status, subject status/eligibility, consent/template state and duplicate claim. The challenge's consumed status alone is not sufficient authorization.
- Attendance and required audit should commit together. Notifications occur after commit. Do not conflate transient challenge cleanup metadata with durable audit history.
- Unknown commit result: issuance must not return the raw token; consumption must be treated as spent. This is safe but can leave an orphan pending row until expiry and temporarily consume quota.

## Review 3 — Quotas and resource exhaustion

### HIGH H3 — No hard total-storage bound when cleanup stalls

The pending quota counts only unconsumed, unexpired challenges. Consumed and expired rows can accumulate if cleanup is down. Fixed-window rate limits limit writes per configured interval, but an attacker can continue across windows, and cleanup failure has no upper bound on stored rows. The test matrix T39 claims storage remains bounded by rate caps and cleanup; that assertion is false if cleanup is unavailable for long enough.

**Correction:** add an independent storage-pressure/admission control: a hard maximum retained row count/partition policy with a defined fail-closed behavior when exceeded, bounded table retention/partition lifecycle, and monitoring for cleanup lag. The global pending cap is not a total-row cap. Ensure the cap is atomic across instances; do not rely on approximate `COUNT(*)` without a lock or an atomic capacity counter. Test cleanup outage and recovery.

### HIGH H4 — Rate-bucket lifecycle and policy consistency are unresolved

The quota table has `scopeType`, `scopeKey`, `windowStart`, and `issuedCount`, but does not encode window duration/version, policy version, or cleanup semantics. If instances run different caps/window definitions during rolling configuration changes, the more permissive instance can accept more requests than intended. If old buckets are deleted before all issuers have moved to a new window, a counter can be recreated and the effective limit reset. If they are never deleted, the bucket table grows without bound. The unkeyed/hash-key comment has changed across design iterations; rotation semantics for a keyed hash would also risk creating a second bucket identity and bypassing the limit.

**Correction:** make the authoritative quota policy/version identical across instances (prefer database-owned policy or startup config fingerprint agreement), define UTC DB-clock bucket boundaries and exact fixed-window semantics, preserve old-window counters through the maximum active window plus approved retention, and delete only closed windows under a race-safe rule. Define stable subject-key derivation and key rotation behavior. Enforce scope type/key shape and bucket-window/count constraints.

### MEDIUM M3 — Fixed windows permit boundary bursts

A fixed window can allow nearly twice the nominal number of requests around a boundary. This may be acceptable for a prototype, but the design does not state it. A “global protection” claim must specify whether the limit is a fixed-window cap, sliding window, or token bucket. Per-user pending count does not cap request churn after rapid consumption.

**Correction:** explicitly accept and size the fixed-window boundary burst, or select a sliding/token-bucket algorithm with atomic PostgreSQL state. Test just-before/after-boundary bursts. Do not invent numeric limits in code; obtain owner approval.

### MEDIUM M4 — Global advisory lock is a contention/availability target

One global advisory lock serializes every issuance. That is correct for a simple global pending count, but a high request rate can queue web requests and occupy the Prisma pool. `lock_timeout` and request/connection budgets are not yet specified. A malicious authenticated account may repeatedly contend for the global lock even when later rejected.

**Correction:** rate-limit authenticated issuance attempts before expensive roster/session/template work, bound waiting and pool use, monitor saturation, and decide whether to retain one global lock or use a DB counter row/atomic capacity reservation. The global policy must count denied issuance attempts where needed to protect resources. The design should not promise production throughput from this serialized prototype.

### Additional quota integrity notes

- Conditional upsert is atomic per bucket row under PostgreSQL row locking, but its configured limit is application input unless policy is stored authoritatively. Multiple instances with inconsistent configuration can exceed the intended lower cap.
- The global advisory lock makes count-then-insert safe only among compliant issuers. Application-level lock convention is not a declarative database invariant.
- Expired rows excluded from pending count cannot themselves cause pending-quota overrun, but they still consume disk/index and cleanup capacity.
- Separate request-attempt quotas from successful challenge issuance counters. Decide whether invalid session/eligibility attempts increment a protective bucket; otherwise unauthenticated/invalid requests can still load DB lookup paths.
- `scopeKey` is not constrained to a length/format, `windowStart` alignment is not enforced, and `issuedCount` has only a nonnegative check. Add SQL checks or use typed enums/validated policy rows.

## Review 4 — Replay, expiration, restart

### Sound core, with conditions

- 256-bit CSPRNG token plus SHA-256 digest-only storage is a sound bearer-token pattern. Database readers cannot feasibly invert the digest. The application must hash the presented token and never accept a digest directly, log either value, or expose a token-existence distinction.
- Row lock plus conditional `consumedAt IS NULL AND expiresAt > captured_db_time` allows one consumer. It is important that the locked row is validated against subject/session/auth-session/purpose before mutation and that the same timestamp is used for expiry and `consumedAt`.
- Cleanup with `SKIP LOCKED` cannot make expired challenges valid because the consume path independently checks expiry. A valid locked challenge must not be deleted.
- Persisted store survives process restart and instance changes only after all issuers/consumers cut over. Existing Map tokens will be lost on restart and must be invalidated at cutover; no dual store or fallback.

### Remaining replay tests/risks

- No test asserts the raw token is absent from DB rows, logs, traces, error messages and quota buckets.
- No test checks token input normalization/oversize handling or that a submitted 64-hex digest is not treated as the original secret.
- Restart and multi-instance cases are redundant in part; both are useful but must distinguish process restart persistence from simultaneous workers and shared quota enforcement.
- The design should state that wrong-binding attempts do not consume tokens, but can still cause timing/lock contention; rate-limit them.
- Capture data itself needs a separate freshness/replay binding. A one-time challenge does not prove a fresh camera capture, liveness, or descriptor provenance.

## Review 5 — Privacy and retention

The proposed challenge record is relatively minimal: digest, subject id, training-session id, auth-session id, purpose and timestamps. These are still linkable personal/behavioral metadata. Access to the table and quota rows must be restricted to the backend database role; operational staff should not have routine query access. `scopeKey` hashes are pseudonymous, not anonymous.

Technical expiry (30 seconds) is distinct from retention. Expiration controls whether a token is valid. It does not specify how long consumed/expired challenge rows, quota buckets, security audit events, backups, or account-linkable identifiers remain stored. Those retention/deletion periods are unresolved and must not be inferred from the TTL. Restrictive FKs can block account/session deletion until challenge rows are cleaned. Audit logs are separate and should not store raw token/digest or biometric content; their purpose, access, and retention remain institutional decisions.

**Required correction:** explicitly list separate retention schedules/owners for challenge rows, quota buckets, security audit events, and backups; until decided, do not present the cleanup SQL’s `$2` interval as approved. Define deletion/anonymization ordering so cleanup, account deletion and AuthSession cascade cannot deadlock.

## Review 6 — Migration and rollback

### Compatibility

Adding new tables/indexes and an `AuthSession` compound unique index is additive for old binaries at the database level, but it is not sufficient to make mixed-version operation safe. Old binaries continue using process-local challenges; new binaries use PostgreSQL. A token issued by one cannot be consumed by the other, and old workers may still accept their own Map challenges if their route is reachable. The design says to drain old endpoints, but does not specify deployment sequencing or how feature-disabled routes remain denied on every instance.

**Required correction:** migration can be backward-compatible at the schema layer, but application cutover must be coordinated: keep the feature disabled on all instances, drain/stop old challenge routes, deploy new code everywhere, verify no old process remains, then separately authorize any controlled prototype. Do not use dual-read/write or fallback. Existing outstanding Map challenges are invalidated. No deployment is authorized by this review.

### Constraints

CHECK constraints protect row-local digest shape and TTL. The unique digest and composite auth-session FK protect uniqueness and owner identity. They do not prove:

- user role/status, session eligibility or session-active state at commit;
- current consent/revocation or template compatibility;
- only approved service code acquires the global advisory lock;
- a configured quota limit is consistent across instances;
- total storage remains bounded;
- audit/attendance transaction correctness.

Those invariants need transaction/service enforcement, access-control separation, and tests. DB constraints are necessary but insufficient.

### Rollback

Keeping the additive table and disabling issuance is the safest rollback. Dropping table/constraints is destructive and requires a separate data-retention decision. Never restore the process-local store as a fallback for a PostgreSQL-issued token. Rollback must not re-enable the old roster-wide path or change the feature flag. If the old binary is reintroduced, its biometric routes must remain disabled.

The repository database guard currently validates URL protocol, allowed host, a test/mock database-name substring, explicit confirmation and conflicting environment variables. It does not attest the actual PostgreSQL server/container identity, role privileges, container label, or empty schema. This remains an external runbook prerequisite, not evidence of disposable-target identity.

## Review 7 — Review of all 54 planned tests

### Cases with good core intent

- **T11–T19** cover single-use, expiry boundary, lock wait, cleanup overlap and logical expiry. They need real independent DB connections and deterministic barriers; mocks are insufficient.
- **T20–T21** cover restart and cross-instance behavior, but should be reported separately: process restart persistence versus two simultaneously running instances.
- **T22–T32** address logout/session-close races and manual concurrency. Only generic locking and manual cases can run while biometric attendance remains disabled.
- **T33–T40** cover quotas, but must add configuration mismatch, bucket retention races, global storage cap, and fixed-window burst behavior.
- **T41–T51** cover outage and failure behavior. Fault injection must distinguish known rollback from an ambiguous network loss after server commit.
- **T52–T53** correctly assert manual independence and disabled-by-default behavior.
- **T54** is necessary because the new 1:1 subject has no operator; staff must be denied rather than silently substituting a cadet identity.

### Matrix defects and non-runnable claims

1. **Acceptance count is wrong:** the matrix now has T01–T54, but the acceptance gate says all T01–T53. Include T54 or define scoped acceptance groups.
2. **T01–T03 describe a proposed route that does not exist.** They cannot be API integration tests until a separately approved route is implemented. Before that, only unit/contract tests can verify identity derivation; the mounted API should stay disabled.
3. **T24 and T26 require a biometric final-mark path that is not implemented and must remain disabled.** They cannot be proven as end-to-end biometric attendance tests under this task’s safety boundary. Replace them now with a generic session/auth lock primitive test and reserve the actual biometric end-to-end case for a later separately approved phase.
4. **T27–T32 test attendance/manual database writes.** These are valid only after a disposable DB and lock-order refactor; they must not exercise an enabled biometric endpoint. T28’s “manual/biometric” phrasing is not one testable behavior while biometric attendance is disabled; split manual duplicate behavior from future biometric duplicate-claim tests.
5. **T39’s expected claim is untrue as written.** Rate caps plus cleanup do not bound total storage if cleanup fails across windows. Rewrite to assert a hard storage limit causes fail-closed admission, and separately measure cleanup backlog.
6. **T40 conflates quota exhaustion and DB outage.** A DB failure cannot reliably return a known 429. Split into quota cap=429 and timeout/connection failure=503.
7. **T43/T44 “unknown commit result” are hard to inject deterministically.** Use a network proxy/fault harness that drops the client connection after server commit, then assert no raw issuance token is returned and consumption is treated as spent. A mocked Prisma rejection does not prove ambiguous commit semantics.
8. **T45 assertion depends on failure point.** If the transaction is known rolled back, challenge remains pending until expiry. If commit outcome is unknown, it must be treated as spent. Separate those cases; do not combine them.
9. **T50 cannot simply require that an intentionally injected deadlock always maps to 503/409.** Verify a real protocol schedule does not deadlock; separately verify SQLSTATE `40P01` and `40001` handling with bounded retry only for definitely aborted, idempotent work.
10. **T53 cannot prove that “no biometric attendance record is created” using the biometric flow** while feature is off. It can prove route gate behavior and absence of challenge/template/attendance mutations for a disabled request. No flag override is permitted.
11. **No cases assert DB target identity guard behavior against a spoofed URL/name or a non-empty schema.** The existing guard does not attest the actual server/container. Add an independent preflight test before any migration suite.
12. **No case asserts table privileges, raw-token absence in logs, wrong-binding timing/lock-rate protection, quota configuration agreement, subject deactivation/consent revocation races, audit-retention separation, or account deletion versus challenge issuance.** Add cases below.

### Per-case disposition of T01–T54

| Case(s) | Independent disposition |
|---|---|
| T01 | Useful as a service/unit contract until a self-service route exists; mounted API stays disabled. |
| T02–T03 | Not runnable against current routes; future contract tests after implementation. |
| T04 | Runnable only to verify disabled/role gate and zero side effects, not matching. |
| T05–T10 | Valid future authorization tests; T10 is blocked until consent/template lifecycle exists. |
| T11–T19 | Valid PostgreSQL store tests with deterministic barriers; T15–T18 need explicit post-lock time and lock-wait assertions. |
| T20 | Valid restart-persistence test; distinct from T21. |
| T21 | Valid simultaneous multi-instance test; assert shared quota and single-use separately. |
| T22 | Valid after store and transaction implementation. |
| T23 | Must verify serialization plus final-mark recheck; consume does not imply attendance success. |
| T24, T26 | Not runnable as biometric end-to-end cases while flag is off and mark API is absent; replace now with generic lock primitive tests. |
| T25 | Valid after challenge service/session checks exist. |
| T27 | Valid as manual-only session locking; do not exercise biometric path. |
| T28 | Split manual duplicate/correction behavior from future biometric duplicate claim. |
| T29 | Valid manual/finalizer race; preserve existing correction policy. |
| T30 | Valid only after defining import semantics; current handler commits records individually, so assert documented partial success rather than assuming whole-batch atomicity. |
| T31–T32 | Valid future DB races; T32 needs deterministic barriers and explicit snapshot/reconciliation semantics. |
| T33–T34 | Valid after pending limits are chosen and all issuers share the advisory-lock contract. |
| T35–T36 | Valid after fixed-window limits and cross-instance configuration are authoritative. |
| T37 | Necessary but incomplete; include bursts on both sides of the boundary and state the permitted burst envelope. |
| T38 | Valid for a known transaction abort; not an ambiguous-commit test. |
| T39 | Incorrect expected claim; rate caps and cleanup do not hard-bound retained rows during prolonged cleanup failure. Replace with T59. |
| T40 | Split into quota exhaustion (429) and DB failure/timeout (503). |
| T41–T42 | Valid fail-closed tests after the DB adapter exists; assert no local fallback. |
| T43–T44 | Require a fault harness dropping connection around commit; mocked Prisma rejection cannot prove ambiguous outcomes. |
| T45 | Split known rollback from unknown commit; only known rollback may assert challenge remains pending. |
| T46 | Valid only after audit is designated transaction-critical and final mark code exists. |
| T47–T49 | Valid after schema exists; deletion expectations remain blocked on retention policy. |
| T50 | Split real protocol no-deadlock races from SQLSTATE retry mapping; retry only definitely aborted idempotent operations. |
| T51 | Valid after timeouts and pool budgets are selected. |
| T52 | Valid for provider/store outage with PostgreSQL otherwise healthy; cannot promise writes during total DB outage. |
| T53 | Valid route-gate test only; no flag override and no inference that biometric verification works. |
| T54 | Valid future authorization test, but no such route currently exists; staff must be denied by the distinct 1:1 contract. |

### Additional required cases

| ID | Scenario | Required assertion |
|---|---|---|
| T55 | User deletion cascades AuthSession while challenge issuance runs | With corrected `User → AuthSession → TrainingSession` order, no deadlock or challenge for deleted subject; one transaction wins deterministically. |
| T56 | User deactivation/status change races with challenge issuance/final authorization | Authorization uses defined row-lock/snapshot semantics; inactive subject cannot consume/mark. |
| T57 | Two instances start with different quota policy versions/limits | Startup rejects mismatch or authoritative DB policy prevents the permissive instance exceeding cap. |
| T58 | Fixed-window boundary burst | Measured maximum boundary burst matches explicitly approved policy; no claim of strict sliding-window cap. |
| T59 | Cleanup unavailable while expired/consumed volume accumulates | Hard storage cap stops new issuance before capacity exhaustion; API fails closed and manual attendance is unaffected. |
| T60 | Quota-bucket cleanup races active-window upsert | Active bucket cannot be deleted/reset; only closed and retention-eligible bucket is removed. |
| T61 | Invalid scope key, window alignment, negative/oversized counter | Database rejects invalid row shape or service rejects before write; counters cannot be forged by request fields. |
| T62 | Consent revocation/template disable races with challenge consume/final mark | Revocation that linearizes first blocks verification/mark; no attendance after revoked state. Do not activate biometric attendance to run this design-only case. |
| T63 | Connection dropped before vs after commit | Known rollback leaves defined state; ambiguous post-commit outcome returns no token on issue and treats consumed token as spent. |
| T64 | Disposable DB URL points to a different local server with a test-like database name | Preflight fails because server/container identity, role, DB name and emptiness do not all match. |
| T65 | Old and new application binaries run concurrently during cutover | Feature stays disabled and old process cannot issue/consume; no Map fallback or split-store success. |
| T66 | Raw challenge or digest appears in app logs/traces/error responses | Test log capture asserts neither value nor credentials/PII are emitted. |
| T67 | Challenge digest submitted as if it were raw token | Rejected; only hash(raw token) lookup is accepted; external response remains generic. |
| T68 | Global pending-count query under large retained-row volume | Required index/partition/cap keeps query bounded; query plan and latency are measured at expected upper bound. |

## Revised transaction protocol required before approval

Use this corrected order for operations that require the corresponding resources:

```text
Challenge issuance:
  acquire global quota advisory lock, then subject quota advisory lock
  lock/update durable global and subject request/rate bucket rows
  reserve a hard global retained-row capacity slot
  lock all involved User rows (subject; sorted if more than one)
  lock AuthSession rows (subject's exact durable sid; sorted)
  lock TrainingSession rows (sorted)
  enforce pending/storage caps; insert digest challenge; commit

Challenge consume:
  lock User(subject) first
  lock AuthSession(sid, subject) second
  lock TrainingSession third
  lock exact challenge row fourth
  capture one DB timestamp after challenge lock; verify all bindings/state
  conditional single-use update; commit before inference

Final attendance transaction (future gated work only):
  lock involved User rows in stable order
  lock operator/cadet AuthSession rows as applicable in stable order
  lock TrainingSession
  recheck session, user, consent/enrollment and result provenance
  claim unique attendance row; insert required audit; commit

Logout/revocation:
  lock owner User first, then AuthSession row(s), then audit; commit

Finalization/manual/import:
  lock all involved User rows in stable order when eligibility mutation must serialize
  lock actor AuthSession, then TrainingSession, then attendance rows sorted by cadet id, then audit

Cleanup:
  acquire the retained-row capacity lock/counter first
  lock challenge rows with SKIP LOCKED
  obtain one DB timestamp after locks; recheck eligibility for deletion; delete bounded batch
  decrement total-storage capacity in the same transaction as deletion
  do not subsequently acquire User/AuthSession/TrainingSession or earlier-tier locks
```

**Ordering note:** the exact order is advisory locks → quota bucket rows → retained-row capacity row → sorted User rows → sorted AuthSession rows → sorted TrainingSession rows → Challenge → Attendance → Audit. No non-issuance path may acquire quota locks. Cleanup acquires the capacity row before challenge rows and releases both in the same transaction. All code must use `READ COMMITTED` for count-after-advisory-lock logic or use a fully specified serializable/retry design. The recommended simpler rule is `READ COMMITTED`, with advisory locks acquired before the count statement and no earlier transaction query that establishes a stale snapshot.

This revised protocol still requires a full source inventory and tests. It does not prove that Prisma's implicit FK row locks, account deletion, role changes, or existing session revocation helpers follow the order; inspect generated SQL and concurrent behavior on the disposable target.

## Required design corrections

1. Change lock hierarchy to `User(s) → AuthSession(s) → TrainingSession(s) → challenge → attendance → audit`, with quota advisory locks consistently before row locks. Resolve the existing User→AuthSession cascade deadlock.
2. Add total retained-row/storage admission control independent of pending quotas and cleanup; define fail-closed behavior on capacity limit.
3. Define authoritative quota policy version, fixed-window semantics/boundary burst, cross-instance config agreement, bucket retention/cleanup, and subject key derivation/rotation.
4. Rate-limit authenticated attempts before expensive session/template lookups; include rejected attempts where appropriate and bound global advisory-lock wait/pool use.
5. Add indexes for global and subject pending counts, validate partial indexes/query plans, and test upper-bound query latency.
6. Separate API contract/unit tests from tests of routes that do not exist; keep `ENABLE_BIOMETRIC_ATTENDANCE` off in all tests.
7. Replace biometric end-to-end concurrency cases with generic lock-protocol/manual synthetic tests now; reserve actual biometric marking tests for later explicit approval. Correct matrix acceptance to include T54 and add T55–T68.
8. Clarify migration rollout with old binaries drained and biometric endpoints disabled; no dual store/fallback. Preserve manual attendance and do not run migrations under this review.
9. Specify challenge-row, quota-bucket, audit, and backup retention as separate unresolved decisions; don't equate 30-second validity with data retention.
10. Obtain disposable-target identity evidence beyond URL substring/confirmation checks before any future DB connection.

## Critical findings

**No critical active vulnerability was demonstrated while biometric attendance remains disabled.** The design nevertheless has a **HIGH deadlock defect** in its stated global lock hierarchy, plus **HIGH resource-exhaustion and rollout/test-gate gaps** that block implementation.

## Final recommendation

**NO-GO for schema implementation, PostgreSQL integration, or biometric attendance integration.**

**GO only for design revision.** First update the lock hierarchy for user deletion/cascade ordering; define a hard storage cap and authoritative quota policy/retention; resolve DB test-target identity; correct the test matrix’s infeasible cases and acceptance count. Then request a second independent review. Keep manual attendance available and `ENABLE_BIOMETRIC_ATTENDANCE` disabled.

## Review execution record

- Read the six requested BSR-05/readiness/security/provider/progress documents and inspected the current challenge store, attendance routes/controller, authentication-session middleware/logout path, Prisma relations, and database-safety guard.
- No tests were executed. No database was connected, no container was created, no migration or schema/source/feature-flag change was made, and no commit, push, or deployment occurred.
- Only this review document was created; unrelated working-tree changes were preserved.
