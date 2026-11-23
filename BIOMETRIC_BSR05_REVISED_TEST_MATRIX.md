# BSR-05 Revised PostgreSQL Test Matrix

**Status:** Test design only. No tests, database commands, migrations, or containers were run or created.
**Target:** Future dedicated disposable local PostgreSQL database, never `ncc_local_dev` or any existing environment.
**Precondition:** Separate approval for schema/migration test, exact database identity verification, and the common lock protocol implementation.

## Test fixture and execution rules

- Use synthetic test accounts only: at minimum two cadets, two durable auth sessions for one cadet, one authorized attendance operator for manual/finalization paths, one active training session, and a second session for cross-session checks.
- No actual face image, real biometric template, real cadet record, or production-valid mock result. For persistence/race tests, substitute a non-authorizing deterministic test inference adapter; assert its result cannot bypass feature flag or production authorization.
- Use two separate Prisma clients/processes for store tests. If testing service behavior across instances, run two backend instances against the same disposable database with distinct ports and the same test configuration. `ENABLE_BIOMETRIC_ATTENDANCE` must remain disabled; do not use a test override to turn it on. Exercise the challenge store and lock primitives directly with synthetic fixtures. The mounted attendance API must continue returning its disabled response, and no test may create a biometric attendance record through that API.
- Keep real route-level rate limits enabled. Boundary tests configure limits only in an isolated test harness / test database, never by bypassing limiter calls.
- Each fixture has a unique test-run id. Cleanup deletes only rows bearing that id or the entire labelled ephemeral database/container. A cleanup failure means discard only the disposable target and report the test run invalid.
- Capture HTTP status and sanitized response category; never log token, digest, cookies, image, embedding or personal contact details.

## Contract and authorization

| ID | Scenario | Method | Expected result / evidence |
|---|---|---|---|
| T01 | Cadet self-service contract with empty body | Service/unit contract + disabled API check | Test the future service contract using synthetic identity context: identity derives from verified `userId` and `sid`, never body. The mounted API remains disabled and creates no challenge while the feature flag is off. |
| T02 | Body supplies another `cadetId`/`userId` | API | Request rejected; no row for substituted subject; no target identity disclosed. |
| T03 | Staff role calls proposed cadet self-service route | Contract/API gate | If the route is later mounted, reject staff role with 403 and no quota/challenge mutation. No route is added by this task. Existing staff manual endpoint remains available. |
| T04 | Cadet calls legacy staff roster-wide verification/challenge route | API | Feature-disabled response or role rejection; no roster/template query and no challenge mutation. |
| T05 | Another cadet attempts a valid token | API + DB | Rejected generically before consume; rightful row remains pending and can be used by original binding if not expired. |
| T06 | Same cadet but different `AuthSession` | API + DB | Rejected; no challenge consume. |
| T07 | Correct cadet/session but wrong attendance session or purpose | API + DB | Rejected; no consume and no cross-session data returned. |
| T08 | Missing, malformed, or oversized token | API | Bounded 400/401 response; no expensive DB path for malformed shape; response does not reveal digest presence. |
| T09 | Cadet inactive, ineligible, or not assigned to session | API + DB | Challenge issuance and consumption fail closed without querying other cadets' templates. |
| T10 | Subject has no active compatible template / current consent | API | Denied generically; no 1:N fallback and no template details exposed. |

## Single-use, expiry, and persistence

| ID | Scenario | Method | Expected result / evidence |
|---|---|---|---|
| T11 | Two independent consumers submit one token simultaneously | PostgreSQL, two clients | Exactly one consume transaction updates one row; other gets generic replay/conflict; at most one downstream verification attempt. |
| T12 | Replay after successful consume | API + DB | Rejected; consumedAt unchanged; no second verification or attendance. |
| T13 | Wrong binding attempted, then rightful use | API + DB | Wrong request does not consume; rightful request can consume before expiry. |
| T14 | Expiry equality (`expiresAt == dbNow`) | PostgreSQL | Rejected as expired (`expiresAt > dbNow` required). |
| T15 | Consumer waits on challenge row lock until after expiry | PostgreSQL controlled lock | Post-lock single DB timestamp is used; rejected after lock; no `consumedAt` after expiry. |
| T16 | Cleanup obtains lock on an expired challenge first | PostgreSQL | Cleanup deletes only once expired and retention-eligible; consumer finds no usable token. |
| T17 | Consumer obtains lock before cleanup on a still-valid challenge | PostgreSQL | Consume succeeds if post-lock time is before expiry; cleanup skips locked row; no active token deletion. |
| T18 | Two cleanup workers overlap | PostgreSQL | `SKIP LOCKED` partitions rows; no duplicate errors or deletion of valid challenges; batch stays bounded. |
| T19 | Expired challenge after delayed cleanup | API + DB | Still rejected by logical expiry; cleanup lag does not extend validity. |
| T20 | Restart between issue and consume | Two app processes | Challenge survives process restart and is consumable on another instance until expiry; no Map dependency. |
| T21 | Challenge issued by instance A, consumed by B | Two app instances | Same database binding yields one shared single-use outcome; quotas also shared. |

## Session and attendance concurrency

| ID | Scenario | Method | Expected result / evidence |
|---|---|---|---|
| T22 | Logout/revocation commits before consume begins | PostgreSQL + API | Consume rejected because durable session is revoked; no inference. |
| T23 | Consume holds AuthSession lock before logout | PostgreSQL race | Consume serializes first and spends token while session active; logout then revokes; subsequent final mark must reject. |
| T24 | Logout commits between consume and final attendance mark | End-to-end controlled race | Final mark rechecks session and fails; no attendance row. Challenge remains spent. |
| T25 | Session finalization commits before consume | PostgreSQL + API | Challenge consume rejected for closed session. |
| T26 | Consume serializes before session finalization, finalization wins before mark | Controlled multi-phase race | Challenge is spent; final mark rejected after session closes; no attendance row. |
| T27 | Generic session-scoped attendance write races session close | PostgreSQL two-client, synthetic/manual-only fixture | Same TrainingSession-first lock makes order deterministic: permitted manual mark first then close includes it, or close first then write receives conflict. Do not exercise or enable biometric attendance. |
| T28 | Duplicate manual/biometric attendance claim | PostgreSQL | Unique `(sessionId,cadetId)` constraint plus service response yields exactly one record; duplicate returns conflict/idempotent behavior as specified. |
| T29 | Manual attendance correction races session finalization | PostgreSQL two-client | Shared lock protocol preserves authorized correction rules; deterministic close/correction outcome; no deadlock. |
| T30 | Bulk import/manual multi-cadet operation races another writer | PostgreSQL two-client | Attendance row locks are acquired in sorted cadet-id order; no deadlock; partial/atomic semantics match documented import contract. |
| T31 | Operator's auth session revoked before manual/finalize transaction | PostgreSQL + API | Durable session check rejects the write even if middleware accepted request earlier. |
| T32 | Finalization reconciliation includes a concurrent prior mark | PostgreSQL two-client | If mark commits first, finalizer sees and preserves it; if finalizer commits first, mark fails closed. |

## Shared quotas and abuse limits

| ID | Scenario | Method | Expected result / evidence |
|---|---|---|---|
| T33 | Two same-subject issuance requests race at pending cap | PostgreSQL two-client | Count+insert under subject quota serialization never exceeds configured pending limit. |
| T34 | Many subjects race at global pending cap | Multi-client | Global admission lock prevents aggregate overrun; cap result is consistent across instances. |
| T35 | Same subject races fixed-window rate counter | PostgreSQL two-client | Conditional upsert allows only configured number; excess request gets 429 and no challenge. |
| T36 | Global fixed-window bucket exhaustion across instances | Multi-instance | All instances share counter; no per-process bypass. |
| T37 | Window boundary / clock boundary | PostgreSQL | Window key derives from DB time; boundary behavior documented and deterministic; no bucket reset race. |
| T38 | Quota rejection transaction rollback | PostgreSQL fault injection | No challenge row or partial counter increment if issuance transaction aborts. |
| T39 | Flood with expired but uncleaned rows | PostgreSQL | Logical pending count excludes expired rows; global storage/query resource limits still bounded by rate caps and cleanup. |
| T40 | Quota database outage/lock timeout | API + DB fault injection | Sanitized 503 or known 429; no local fallback and no token success. |

## Failure, constraints, and recovery

| ID | Scenario | Method | Expected result / evidence |
|---|---|---|---|
| T41 | DB unavailable during issuance | Fault injection | No token returned; sanitized service-unavailable; no challenge created in memory. |
| T42 | DB unavailable during consumption | Fault injection | No verification/attendance success; no fallback; client must start a fresh challenge when service returns. |
| T43 | Unknown commit result after issuance | Fault injection | Server does not return raw token; any orphan row expires within TTL and is quota-accounted. |
| T44 | Unknown commit result after consumption | Fault injection | Caller treats token as spent; status is reconciled from DB only; same token is not retried as fresh. |
| T45 | Transaction fails after consume update | PostgreSQL fault injection | Consume transaction rolls back fully; if outcome is known rollback, token may remain pending only while unexpired. |
| T46 | Attendance audit insert fails during final mark | PostgreSQL fault injection | Attendance write rolls back if audit is transaction-critical; no success response. |
| T47 | Invalid digest, negative time span, >30s TTL, consumed-after-expiry inserted directly | PostgreSQL | CHECK constraints reject each invalid row regardless of API path. |
| T48 | Composite AuthSession owner mismatch | PostgreSQL | Composite FK rejects challenge bound to another user's session. |
| T49 | Parent account/session deletion | PostgreSQL | Restrictive FK prevents accidental cascade; explicit approved retention deletion workflow required. |
| T50 | Deadlock injected/observed | PostgreSQL | No unbounded retry; recognized deadlock may retry whole idempotent transaction boundedly; exhausted retry maps to sanitized unavailable/conflict. |
| T51 | Pool exhaustion / statement and lock timeouts | PostgreSQL load/fault test | Request duration bounded; connection released; manual route remains independent of biometric store. |
| T52 | Manual attendance during biometric provider/store outage | API + DB | Authorized manual workflow continues under normal DB health and policy; no biometric token/provider dependency. |
| T53 | Biometric feature flag remains disabled | Startup/API | Challenge/verify API remains disabled; provider stays unwired; no biometric attendance record is created. No test changes the flag. |
| T54 | Cross-operator challenge use / operator-supplied impersonation | API contract + authorization unit | Operator cannot issue or consume the cadet self-service token, cannot submit an alternate subject, and cannot use a cadet challenge through the staff 1:N endpoint. No challenge is consumed and no roster/template query occurs. |

## Acceptance gate

No PostgreSQL-backed challenge implementation is considered verified until all required cases T01–T53 pass in the separately authorized disposable target, the application/database lock order is independently reviewed, and no test touched `ncc_local_dev` or any protected database. Passing this matrix alone does not clear model licensing, consent, trusted capture, PAD, privacy, institutional authorization, or production release gates.
