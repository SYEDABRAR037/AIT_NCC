# BSR-05 Revised T01–T80 Test Matrix

**Status:** Design only; no tests executed. Every DB test must use a separately authorized, identity-verified, empty disposable PostgreSQL target with synthetic fixtures. Never target ncc_local_dev, persistent NCC PostgreSQL volumes, production, protected databases, or backups. No test changes the production feature flag. “Flag off” means ENABLE_BIOMETRIC_ATTENDANCE remains false and no biometric attendance row is created.

| ID | Exact purpose | Required environment | Expected result | Attendance flag off? |
|---|---|---|---|---|
| T01 | Ensure self-service contract derives subject and sid only from verified context; empty request body accepted by service contract. | Pure unit; mocked disabled API | Context identity used, no body identity required; current mounted route remains disabled and performs no write. | Yes |
| T02 | Reject request body containing another cadetId/userId. | Mocked API now; PG after route | 4xx; no target row mutation or identity disclosure. | Yes |
| T03 | Reject staff role from cadet self-service route. | Mocked API now; PG after route | 403; no quota/challenge mutation; staff manual route remains available. | Yes |
| T04 | Reject cadet access to legacy staff roster-wide verification/challenge endpoints. | Mocked API | Disabled/denied; no roster/template lookup or challenge mutation. | Yes |
| T05 | Attempt to consume valid challenge as another cadet. | Disposable PG + two clients/API | Generic rejection; challenge remains pending for rightful binding until expiry. | Yes |
| T06 | Attempt same user's challenge from a different durable AuthSession. | Disposable PG + API | Rejected without consuming challenge. | Yes |
| T07 | Use correct cadet/session but wrong attendance session or purpose. | Disposable PG + API | Rejected; no consume and no cross-session data. | Yes |
| T08 | Send missing, malformed, oversized, or digest-shaped token input. | Unit + mocked API | Bounded 4xx; malformed input rejected before expensive DB path; no digest/token existence leak. | Yes |
| T09 | Issue/consume as inactive, ineligible, or unassigned cadet. | Disposable PG + API | Fail closed; no other cadet template lookup. | Yes |
| T10 | Challenge for subject with no current consent or compatible active template. | Disposable PG + API | Generic denial; no 1:N fallback or template details. | Yes |
| T11 | Two consumers race on one challenge. | Disposable PG, two independent clients, barrier | Exactly one conditional consume; other conflict/replay; at most one verification attempt. | Yes |
| T12 | Replay token after successful consumption. | Disposable PG + API | Rejected; consumed timestamp unchanged; no second verification/attendance. | Yes |
| T13 | Wrong binding attempt followed by rightful use. | Disposable PG + API | Wrong request does not consume; rightful request can consume if still valid. | Yes |
| T14 | Challenge at exact expiry equality. | Disposable PG with controlled DB time | Rejected because expiry must be strictly greater than captured DB time. | Yes |
| T15 | Consumer blocks on row lock until after expiry. | Disposable PG, two clients with lock barrier | Post-lock DB time decides; rejected and not consumed after expiry. | Yes |
| T16 | Cleanup locks an expired, retention-eligible challenge first. | Disposable PG, cleanup/consumer connections | Cleanup deletes once and updates counters once; consumer cannot use it. | Yes |
| T17 | Consumer locks valid challenge before cleanup. | Disposable PG, two clients | Consume succeeds if captured DB time < expiry; cleanup skips locked row. | Yes |
| T18 | Two cleanup workers overlap. | Disposable PG, two cleanup clients | Bounded SKIP LOCKED batches do not double-delete, underflow counters, or delete live rows. | Yes |
| T19 | Delayed cleanup leaves an expired row present. | Disposable PG + API | Logical expiry still rejects token; cleanup delay never extends validity. | Yes |
| T20 | Restart backend between issue and consume. | Disposable PG + two process lifetimes | Challenge persists and is consumable by new process until expiry; no Map fallback. | Yes |
| T21 | Issue on instance A, consume on instance B. | Disposable PG, two backend instances and clients | Shared DB enforces binding, one-time use and shared quota. | Yes |
| T22 | Logout/revocation commits before consume begins. | Disposable PG + two clients/API | Durable session check denies consume; no inference call. | Yes |
| T23 | Consume acquires AuthSession lock before logout. | Disposable PG + two clients/barrier | Consume serializes and spends token while session valid; logout then revokes; later final mark denies. | Yes |
| T24 | Logout commits after challenge consume but before final biometric attendance mark. | Disposable PG + controlled service race; biometric endpoint later | Final transaction rechecks sid and denies; no attendance row. Actual biometric endpoint assertion deferred. | Yes for generic DB state test; actual endpoint deferred |
| T25 | Finalize/close training session before challenge consume. | Disposable PG + API/service | Consume denied because session is closed. | Yes |
| T26 | Consume wins, then training session closes before final mark. | Disposable PG + controlled service race; biometric endpoint later | Challenge spent; final mark denied; no attendance row. Actual biometric endpoint assertion deferred. | Yes for generic DB state test; actual endpoint deferred |
| T27 | Manual attendance write races session close. | Disposable PG, two clients | Same TrainingSession lock yields deterministic order: mark included if first, conflict if close first. | Yes |
| T28 | Duplicate attendance claim on manual path; separately characterize future biometric claim. | Disposable PG, two clients | Manual path: one unique row and documented conflict/idempotency. Biometric half deferred. | Yes for manual path; biometric half deferred |
| T29 | Manual correction races session finalization. | Disposable PG, two clients | Current authorized correction policy preserved; deterministic outcome, no duplicate or deadlock. | Yes |
| T30 | Bulk manual import races another attendance writer. | Disposable PG, two clients | Keys locked sorted; no deadlock; current per-record partial-success contract preserved. | Yes |
| T31 | Revoke operator AuthSession before manual write/finalization transaction. | Disposable PG + API/service | Durable-session recheck denies operation even if entry middleware had accepted request. | Yes |
| T32 | Finalizer races a concurrent manual mark. | Disposable PG, two clients | Mark-first is included; close-first rejects mark; counts/reconciliation consistent. | Yes |
| T33 | Same-subject concurrent challenge issue at outstanding cap. | Disposable PG, two clients | Successful reservations never exceed approved subject cap; excess gets controlled limit response. | Yes |
| T34 | Multiple subjects race at global outstanding cap. | Disposable PG, multiple clients/instances | Global cap is never exceeded; outcomes shared across instances. | Yes |
| T35 | Same-subject requests race on token-bucket debit. | Unit math plus disposable PG two clients | Only approved burst/refill envelope admitted; excess denied, no challenge. | Yes |
| T36 | Global token bucket race across backend instances. | Disposable PG, two instances/connections | Shared global bucket; no per-process bypass. | Yes |
| T37 | Token bucket refill boundary and DB clock behavior. | Unit injected clock plus disposable PG | DB time controls refill; no client-clock reset or inconsistent boundary. | Yes |
| T38 | Abort issue transaction after quota reservation. | Disposable PG transaction fault injection | No challenge and no partial counter increment after known rollback. | Yes |
| T39 | Flood with expired but uncleaned challenge rows. | Disposable PG + API/load harness | Expired tokens denied; outstanding/retained caps bound rows; requests backpressure at cap. | Yes |
| T40 | Distinguish quota exhaustion from DB outage/lock timeout. | Unit/API mocks plus disposable PG fault injection | Known cap returns controlled 429/capacity category; unavailable DB/timeout returns sanitized 503; no fallback. | Yes |
| T41 | Database unavailable during issue. | Disposable PG fault injection | No token returned, no in-memory challenge created, sanitized unavailable. | Yes |
| T42 | Database unavailable during consume. | Disposable PG fault injection | No verification/attendance success; no fallback; caller starts a new challenge after recovery. | Yes |
| T43 | Network loss makes issue commit outcome unknown. | Disposable PG + network fault proxy | Raw token never returned; any committed orphan is digest-only and quota-accounted until cleanup. | Yes |
| T44 | Network loss makes consume commit outcome unknown. | Disposable PG + network fault proxy | Caller treats challenge as spent; same token is not retried as fresh. | Yes |
| T45 | Known transaction rollback after consume update. | Disposable PG fault injection | Full transaction rollback; row/counter unchanged; token usable only if still unexpired. | Yes |
| T46 | Required audit insert fails during manual attendance final mark. | Disposable PG, manual path | Attendance and audit roll back together; no success response. Biometric route deferred. | Yes |
| T47 | Direct SQL attempts invalid digest, negative interval, TTL above hard maximum, or consume at/after expiry. | Disposable PG | Database constraints/routines reject each invalid state regardless of API. | Yes |
| T48 | Challenge references AuthSession owned by a different user. | Disposable PG | Composite owner FK/routine rejects cross-owner binding. | Yes |
| T49 | Delete parent User/AuthSession/TrainingSession while challenge exists. | Disposable PG | Restrictive FK blocks uncontrolled deletion; controlled deletion removes child/counters first. | Yes |
| T50 | Deadlock/serialization abort behavior. | Disposable PG, two clients, fault schedule | No unbounded retry; only confirmed 40P01/40001 whole transaction retried boundedly if idempotent. | Yes |
| T51 | Pool saturation and lock/statement timeout bounds. | Disposable PG load/fault harness | Request duration and connection occupancy bounded; resources released. | Yes |
| T52 | Provider/challenge-store unavailable while DB remains healthy; manual attendance submitted. | Mocked provider + healthy disposable/manual test DB | Authorized manual attendance continues and has no biometric dependency. | Yes |
| T53 | Feature-disabled endpoint behavior. | Mocked API/startup; no DB needed | Challenge/verify remains disabled; no provider call or biometric attendance mutation. | Yes |
| T54 | Operator attempts cross-operator use or submits impersonated cadet identity. | Unit + mocked API; PG after route | Denied; no challenge consumed and no roster/template query. Self-service schema has no operator binding. | Yes |
| T55 | Account deletion races challenge issuance. | Disposable PG, two clients | One serializes first; deletion-first prevents issue, issue-first is followed by controlled child cleanup; no orphan challenge. | Yes |
| T56 | User deactivation/status change races authorization. | Disposable PG, two clients | Authorization rechecks locked status and fails closed if deactivation wins. | Yes |
| T57 | Instances start with different quota policy versions. | Startup/config test + disposable PG, two instances | Mismatched instance refuses challenge service; no instance-local override. | Yes |
| T58 | Token-bucket burst envelope at and around configured capacity. | Unit plus disposable PG | Approved burst boundary accepted exactly; next excess request denied. | Yes |
| T59 | Cleanup outage with global retained cap reached. | Disposable PG + cleanup fault harness | New issue backpressured; table cannot grow past configured cap; recovery decrements counters correctly. | Yes |
| T60 | Cleanup and quota-row ordering under overlapping issue/delete. | Disposable PG, two clients | No inverse locks; counter state consistent after both commit/abort schedules. | Yes |
| T61 | Validate scope, counter, time, digest and policy constraints through direct SQL. | Disposable PG security test | Invalid direct writes rejected; runtime direct DML separately denied. | Yes |
| T62 | Consent/template revocation races generic authorization state. | Disposable PG/service test; no biometric endpoint | Generic service cannot authorize stale/revoked state. Actual endpoint assertion deferred until later phase. | Yes for generic state; endpoint deferred |
| T63 | Distinguish pre-commit abort from post-commit connection drop. | Disposable PG + network fault proxy | Known abort follows rollback; ambiguous commit fails closed and is not retried as a fresh operation. | Yes |
| T64 | Verify disposable DB target identity before any write. | Dedicated PostgreSQL preflight/operations harness | Wrong server/container, role, database, version, nonempty schema or missing marker aborts before fixture write. | Yes |
| T65 | Mixed-version deployment/legacy Map route behavior. | Two local test processes + mocked API; disposable DB if stateful | Old endpoint remains denied; no cross-store fallback or dual write. | Yes |
| T66 | Ensure logs/traces/HTTP responses omit raw token, digest and biometric payload. | Unit/API log capture; integration for DB traces | No secret or biometric payload appears in any captured output. | Yes |
| T67 | Submit stored SHA-256 digest as if it were raw challenge token. | Unit + mocked API | Rejected generically; digest is not accepted as bearer credential. | Yes |
| T68 | Capacity query/index plan at retained-row cap. | Disposable PG + performance harness | Query remains bounded and within approved latency budget; no full-table hot-path count. | Yes |
| T69 | Account deletion races logout/session revocation. | Disposable PG, two clients | User-before-AuthSession ordering; deterministic state and no deadlock in tested schedule. | Yes |
| T70 | Account deletion races challenge consume. | Disposable PG, two clients | Delete-first denies consume; consume-first is followed by ordered cleanup; no post-delete challenge. | Yes |
| T71 | Test FK key-share/cascade lock behavior. | Disposable PG, two clients, pg_locks inspection | Direct delete rejected by restrictive challenge FK; controlled child-first deletion succeeds. | Yes |
| T72 | Simultaneous outstanding and retained-cap boundary admission. | Disposable PG, many clients | Exactly cap reservations succeed; no row/counter exceeds cap. | Yes |
| T73 | Cleanup outage and recovery at retained cap. | Disposable PG + cleanup fault harness | No growth past cap; after cleanup resumes, counter decrements and issue admission recovers. | Yes |
| T74 | Concurrent token-bucket admission from multiple app instances. | Disposable PG + multiple instances | Shared DB time/counters yield approved envelope; no local fallback. | Yes |
| T75 | Deadlock retry and unknown commit handling. | Disposable PG + fault injection | Confirmed abort may retry boundedly; unknown commit is never retried as fresh. | Yes |
| T76 | Legacy route rejection for roster-wide challenge, verify and eligible biometrics. | Mocked API/route inspection; no DB required | Disabled/denied with zero template/challenge/attendance reads or writes. | Yes |
| T77 | Runtime role cannot bypass routines. | Disposable PG with provisioned test roles | Direct quota DML, challenge DML, ALTER, trigger disable and replication-role change denied; intended routine succeeds. | Yes |
| T78 | Authenticated invalid-session-id request flood across instances. | Disposable PG + multiple instances/load harness | Attempt bucket charges requests before expensive lookup; no unbounded quota/challenge rows. | Yes |
| T79 | Missing quota row or counter drift. | Disposable PG | Routine fails closed, sanitized alert emitted, no token issued and no live repair. | Yes |
| T80 | Delete account with multiple AuthSessions and challenges. | Disposable PG, two clients | Sorted locks; child challenges/counters removed under approved policy; no FK failure/deadlock in tested schedules. | Yes |

## Execution boundaries

- All cases above can keep the production attendance flag disabled. T24, T26, biometric half of T28, and actual endpoint portion of T62 are deferred until a later separately authorized non-production biometric phase; their generic transaction/state assertions remain testable flag-off.
- Until proposed routes/services exist, T01–T10, T54 and T76 test only unit contracts or current disabled legacy behavior; they cannot be claimed as new-route API passes.
- T41–T45 and T63 require a fault-injection harness; mocks alone do not prove commit ambiguity.
- T64 is a prerequisite guard, not ordinary coverage. T77 requires actual isolated DB roles. T68/T51 require approved latency and load budgets.
- No test changes the feature flag, marks biometric attendance, uses real cadet biometric data, or weakens rate limits. Test fixtures use approved synthetic IDs and limits isolated to the disposable DB.
- PostgreSQL race tests evidence only the schedules and version exercised; they do not mathematically prove deadlock absence.
