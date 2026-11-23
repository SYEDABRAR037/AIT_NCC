# BSR-05 Remaining Decisions and Finding Closure Register

**Status:** Design register; no approval inferred. “Correction designed” is not “implemented” or “verified.”
**Current gate:** **NO-GO** for schema/code implementation, migration, or biometric attendance integration.

## 1. Independent-review finding disposition

| Original finding | Correction in final design | Evidence supporting correction | Remaining risk | Verification method / owner |
|---|---|---|---|---|
| Identity 1 — subject binding exists only in proposal; current flow is staff 1:N | New contract binds self-service 1:1 to middleware-derived cadet and durable session; exact single-template lookup; client target rejected. | Current routes/controllers and `FaceAttendanceModal` were inspected; final architecture identifies the separate routes and current 1:N code. | Route/service are not implemented. Current browser descriptor path remains a high activation blocker. | API authorization review + service tests; backend owner and security reviewer. Keep old route disabled. |
| Identity 2 — staff impersonation risk | No operator field or staff permission in self-service purpose; per-operator outstanding challenges are structurally zero. A staff flow would need a separately approved contract. | Proposed enum contains only `ATTENDANCE_1_TO_1`; body cannot select cadet/operator. | Existing staff roster path remains mounted but disabled by current feature gate; a future flag-only activation would expose it. | Route test proves staff rejection/zero side effects; separately prove legacy route remains gated. |
| Identity 3 — wrong binding can lock/burn challenge | Validate server-derived bindings before state mutation; generic external errors; no consume on mismatch; rate-limit wrong-binding attempts. | Revised consume transaction conditions by subject/session/auth session/purpose and updates only after validation. | Lookup timing and lock contention remain possible; external error uniformity unverified. | Cross-cadet/session/operator attempts with timing/rate observations and log review. |
| Identity 4 — old/revoked JWT race | Recheck durable AuthSession under lock at consumption and final mark; sid-less JWT continues rejected; logout serializes on owner then session. | Existing middleware/session policy and logout controller inspected; BSR-04 current review states sid-less rejection and durable sid use. | New database transaction path does not exist; existing routes have only request-entry middleware checks. | Two-connection logout-vs-consume/final-write test; auth owner. |
| Identity 5 — session FK does not prove session validity/eligibility | Recheck ACTIVE/time window, subject eligibility and current consent/enrollment in transaction; final write repeats mutable checks. | Final architecture separates relational existence from application invariants. | Consent schema, enrollment lifecycle, and API remain pending. | Wrong-session, closed-session, status/leave and revocation race tests after prerequisites. |
| Identity 6 — legacy 1:N route could be re-enabled by feature flag | Explicitly isolate/retire old descriptor/roster path; never interpret flag change alone as activation of 1:1 architecture. | Current route and handler inspect; old flow returns disabled response today. | No route isolation code is implemented. | Static route inventory + API test while feature flag remains false; later release review. |
| HIGH H1 — AuthSession-before-User deadlock against User→AuthSession cascade | Final hierarchy starts User(s) sorted, then AuthSession(s), then session/quota/challenge; controlled account deletion explicitly removes challenge children before AuthSession/User deletion; FKs restrict accidental cascades. | Existing `AuthSession.user onDelete: Cascade` inspected. PostgreSQL docs/source describe row lock conflicts, FK key-share checks and cascades. | Internal FK/trigger lock order is not proven by prose; deletion path source may be absent and no live PG test was run. | Inspect generated SQL/triggers; run deletion-vs-issue, deletion-vs-consume and FK cascade races on authorized disposable PostgreSQL. |
| HIGH H2 — not every writer follows one protocol | Final lock spec requires inventory of all attendance, finalization, import/correction, session revoke, status/delete paths and one canonical order. | Current `markAttendance`, `bulkImportAttendance`, `verifyFaceAttendance`, `endAttendanceSession`, logout and schema were inspected; current code is not compliant. | Large application refactor remains; old flow uses reads outside final writes. | Complete lock inventory and two-client concurrency/deadlock suite before migration; backend owner. |
| MEDIUM M1 — advisory locks are conventions; isolation/config uncertainty | Database-owned quota rows/stored routines are authoritative; use `READ COMMITTED`, one policy version, global-first quota-row ordering; no count-only guarantee. | Official PostgreSQL isolation/advisory lock docs; final architecture specifies authoritative counter state. | Stored routines, permissions and startup policy agreement are design only. | DB role/trigger tests; concurrent issuance across app instances; startup mismatch rejection. |
| MEDIUM M2 — cleanup SQL evaluation and lock timing unproven | Cleanup becomes bounded routine with quota rows first, deterministic subject ordering, then challenge locks and one post-lock DB timestamp; expiry independently enforced on consume. | `clock_timestamp()` post-lock semantics are specified in final design. | Exact PostgreSQL query/trigger semantics, SKIP LOCKED behavior, and deadlock freedom unverified. | PG16 query/lock test plus EXPLAIN and deliberate lock-wait barriers. |
| HIGH H3 — no hard retained-row cap | Global retained counter/max is reserved atomically in DB routine/trigger; cleanup failure reaches finite cap and stops new issuance. | Final schema concept includes `retainedCount/retainedLimit` and fail-closed behavior. | No counter model/trigger exists; counter drift, DB role bypass, disk usage outside challenge table remain risks. | Direct DML denial, trigger bypass resistance, cap exhaustion, cleanup outage/recovery and counter reconciliation tests. |
| HIGH H4 — quota bucket policy/retention inconsistent | Replace per-window buckets with one token-bucket row per GLOBAL and SUBJECT; DB policy version/limits authoritative; bounded row count. | Algorithm comparison and single-row-per-scope concept in final architecture. | Exact finite values, retention/deletion behavior and account-key lifecycle are not approved. | Two instances with mismatched config must fail startup; token-bucket race/window/refill tests; deletion cleanup test. |
| MEDIUM M3 — fixed-window boundary burst | Recommend token bucket with explicit capacity/refill rate, plus separate outstanding/retained counters. | Comparative table documents burst/concurrency/cost trade-offs. | Token bucket has burst up to configured capacity; values not chosen. | Approved boundary/burst envelope and near-refill tests. |
| MEDIUM M4 — global lock contention/pool exhaustion | Use short DB routines, one authoritative global quota row, bounded lock/pool/request timeouts; no external I/O; fail closed. | Final lock and outage design identifies single-row contention. | Global row serializes quota operations; no capacity/load data. | Contention load test and pool saturation metrics on disposable environment. |
| Replay/expiry — digest, lock wait, cleanup boundary | 256-bit random token, digest-only storage; exact conditional consume; DB clock captured after locks; cleanup cannot make expired token valid. | Final architecture and lock spec state the same timestamp and single-use rule. | Token logging/input handling and cleanup SQL untested. | DB direct checks, raw-token absence log capture, expiry equality and two-client races. |
| Privacy — linkable challenge/quota metadata and retention conflation | Store minimum IDs/digest/timestamps; no biometric material; technical expiry distinct from challenge, quota, audit and backup retention. | Final design separates the data categories and calls out linkability. | Institutional retention, account deletion/anonymization, backup policy and DB access roles undecided. | Institutional decision record, privilege review, deletion and restore exercise. |
| Migration/rollback — mixed old/new workers and unsafe fallback | Additive schema only after approval; all old routes disabled/drained; invalidate Map tokens; no dual-store or fallback; rollback stops issue/consume and retains tables. | Final architecture and lock spec define cutover boundary. | No migration exists; no deployment topology or database identity attestation. | Disposable DB migration compatibility, mixed-version denial test, restore/rollback rehearsal; separate approval. |
| Test matrix — count, impossible cases, missing scenarios | New matrix categorizes disabled-route/service tests, DB tests, concurrency, and later activation-only tests; added deletion, storage, quota, FK, legacy route cases. | Final test matrix includes tests by verification layer and feature-flag constraint. | Tests remain plans. Actual biometric end-to-end tests cannot run while feature is disabled. | Execute only authorized suites; no test may turn on production attendance. |

## 2. Quota and storage decisions (values intentionally blank)

The following values must be set by the deployment owner and reviewed before code/schema work. This register does not choose values.

| Setting | Required decision | Safe configuration rule |
|---|---|---|
| Challenge TTL | Approve whether current 30 seconds remains appropriate. | Finite positive value; hard DB maximum; DB clock authoritative. |
| Global outstanding cap | Max unconsumed challenge rows across all users. | Finite positive DB-owned value; exact cap check in transactional routine. |
| Per-subject outstanding cap | Max unconsumed rows for one cadet across auth sessions. | Finite positive DB-owned value. |
| Per-operator outstanding cap | New self-service flow has no operator and therefore cap is 0. | Do not add staff-issued rows to this model. Separate reviewed operator purpose if later needed. |
| Global retained-row cap | Max total challenge rows, consumed plus pending, before fail-closed backpressure. | Finite; must account for row/index overhead and operational headroom. |
| Global token-bucket capacity/refill | Aggregate request/challenge burst and sustained rate. | Finite and identical through DB policy; no instance-local override. |
| Per-subject token-bucket capacity/refill | Per-cadet burst and sustained rate. | Finite; one subject row; account deletion removes it only through approved workflow. |
| Cleanup frequency/batch | Operational target for reclaiming expired/retained rows. | Bounded and observable; correctness does not depend on cleanup. |
| Challenge-row retention | How long consumed/expired rows remain after they are no longer valid. | Separate from TTL; authorized privacy/security decision. |
| Audit retention/access | Purpose, authorized roles, retention and minimization. | Separate audit store/policy; never raw token/digest/biometric payload. |
| Backup expiry/restoration | Backup retention and restored-data access controls. | Separate institutional/operational approval; TTL does not erase backups. |
| Timeouts/pool budget | Lock, statement, transaction, connection-pool wait and retry limits. | Measured finite values; startup rejects invalid configuration. |
| Policy version | How all instances prove same quota algorithm/values. | DB-authoritative immutable version or startup fingerprint equality; mismatch blocks issuance. |

## 3. Institutional and engineering decisions still open

### Institutional/privacy decisions

- Authorized purpose for biometric processing, and whether attendance is permitted at all.
- Consent language, policy version/hash, age/guardian requirements, assent/objection policy.
- Challenge/audit/biometric retention and deletion; account deletion/anonymization; backup expiry/restoration.
- Authorized roles/data access and meaningful manual alternative.

### Engineering/operations decisions

- Final finite limits and token bucket capacity/refill; acceptable burst envelope.
- Account deletion transaction and its permitted FK behavior; no direct ORM cascade until reviewed.
- Exact stored routine/trigger grants, function owner and `search_path`; direct table permissions.
- Whether the single global quota row's contention is acceptable or a later sharded design is needed.
- `READ COMMITTED` enforcement, lock/statement/pool timeouts, retryable SQLSTATE policy.
- Disposable PostgreSQL test-target identity beyond URL substring and confirmation token.
- Migration approval and coordinated no-mixed-Map cutover/rollback procedure.

## 4. GO / NO-GO

**NO-GO for implementation or migration now.** The architecture corrects prior design-level high findings, but the correction is not proven until a lock inventory, reviewed stored routines/permissions, finite quota/retention values, disposable DB identity controls, and PostgreSQL concurrency evidence exist. It is **GO for another design review** after these documents are reviewed. No institutional approval is implied.
