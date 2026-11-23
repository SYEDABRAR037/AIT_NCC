# BSR-05 P0.3 Blocker Resolution

**Scope:** design-only resolution of the persistent integrity gate and attendance-window blockers. No SQL, Prisma schema, application source, environment, or feature-flag changes were made. No database or container was accessed.

## Decision

**Historical decision: NOT READY at the time this design report was written.** As of 23 November 2026, its proposed integrity-gate and canonical attendance-window Prisma fields are present in the current schema, and the project-owner register records the required timezone/window rules, including the 12-hour maximum, as approved. These design blockers are therefore addressed at the schema/decision level, but SQL constraints/routines, role grants, policy/recovery audit persistence, application transaction changes, and PostgreSQL verification remain unimplemented. Overall P0.3 implementation readiness remains **NOT READY**.

At the time of this report, both technical blockers had a concrete design but the schema and attendance-window rules were not yet updated/approved. Subsequent work added the gate and canonical window fields to Prisma and recorded the attendance-window rules in the operational register. Database ownership/privilege preconditions still need verification in a disposable PostgreSQL environment; SQL enforcement and runtime behavior remain unimplemented.

## A. Persistent integrity gate

### Proposed Prisma additions

Add the following enums and models in `app_private`. Names and fields below are proposed; they are not present in the current schema.

```prisma
enum BiometricChallengeIntegrityState {
  BLOCKED
  READY

  @@map("biometric_challenge_integrity_state")
  @@schema("app_private")
}

enum BiometricChallengeIntegrityActorKind {
  SYSTEM
  SERVICE
  DATABASE_OPERATOR

  @@map("biometric_challenge_integrity_actor_kind")
  @@schema("app_private")
}

model BiometricChallengeIntegrityGate {
  singletonKey  String                              @id @map("singleton_key")
  state         BiometricChallengeIntegrityState
  reasonCode    String                              @map("reason_code")
  policyVersion String?                             @map("policy_version")
  stateRevision BigInt                              @default(1) @map("state_revision")
  changedAt     DateTime                            @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6) @map("changed_at")
  actorKind     BiometricChallengeIntegrityActorKind @map("actor_kind")
  actorPrincipal String                             @map("actor_principal")
  actorUserId   String?                             @map("actor_user_id")
  auditReference String?                            @map("audit_reference")

  policy BiometricChallengePolicy? @relation(fields: [policyVersion], references: [policyVersion], onDelete: Restrict)
  events BiometricChallengeIntegrityEvent[]

  @@map("biometric_challenge_integrity_gate")
  @@schema("app_private")
}

model BiometricChallengeIntegrityEvent {
  id              BigInt                              @id @default(autoincrement())
  singletonKey    String                              @map("singleton_key")
  stateRevision   BigInt                              @map("state_revision")
  previousState   BiometricChallengeIntegrityState?   @map("previous_state")
  newState        BiometricChallengeIntegrityState    @map("new_state")
  reasonCode      String                              @map("reason_code")
  policyVersion   String?                             @map("policy_version")
  actorKind       BiometricChallengeIntegrityActorKind @map("actor_kind")
  actorPrincipal  String                              @map("actor_principal")
  actorUserId     String?                             @map("actor_user_id")
  auditReference  String?                             @map("audit_reference")
  occurredAt      DateTime                            @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6) @map("occurred_at")

  gate   BiometricChallengeIntegrityGate @relation(fields: [singletonKey], references: [singletonKey], onDelete: Restrict)
  policy BiometricChallengePolicy?       @relation(fields: [policyVersion], references: [policyVersion], onDelete: Restrict)

  @@unique([singletonKey, stateRevision], map: "biometric_challenge_integrity_event_revision_key")
  @@index([occurredAt, id], map: "biometric_challenge_integrity_event_time_idx")
  @@map("biometric_challenge_integrity_event")
  @@schema("app_private")
}
```

Add these exact back-relations on `BiometricChallengePolicy` for gate/event policy references:

```prisma
integrityGate   BiometricChallengeIntegrityGate?
integrityEvents BiometricChallengeIntegrityEvent[]
```

The event's `actorUserId` is intentionally not a foreign key to `public.User`: a historical security event must not prevent account deletion, and account deletion must not cascade-delete the audit history. Human identity is represented by the immutable operator identifier plus database principal and an external audit/ticket reference; the database principal is the authoritative database actor.

### Constraints and initial state

Required custom SQL constraints/triggers for a later migration:

- Gate primary key plus `CHECK (singleton_key = 'GLOBAL')`.
- State is the enum; `state_revision > 0`; nonblank `reason_code` and `actor_principal`.
- `state = 'READY'` requires non-null `policy_version`; the FK is restrictive. `BLOCKED` may have a null policy version so an unconfigured system can be represented safely.
- Event revisions are positive and unique per singleton; initial event has a null previous state; later state events require `previous_state <> new_state`.
- Event rows are append-only; direct UPDATE/DELETE/TRUNCATE is denied and guarded by an immutability trigger. The gate can be changed only through approved routines.
- The gate's `policy_version` must equal the singleton quota's `active_policy_version` before any challenge operation proceeds. This is a cross-table invariant, so enforce it in routines/catalog assertions, not a PostgreSQL `CHECK`.
- Policy rows and event rows are retained according to a separately approved retention rule; do not silently delete them as part of challenge cleanup.

The migration should insert exactly one initial **BLOCKED** gate row with reason `NOT_CONFIGURED`, null policy version, revision 1, and an initial event. This is a safety state, not an operational quota/TTL/retention value. If the row is later missing, all challenge operations fail closed; no routine auto-creates a READY row.

Reason codes should be a stable allowlist, e.g. `NOT_CONFIGURED`, `GLOBAL_QUOTA_MISSING`, `ACTIVE_POLICY_MISSING`, `POLICY_MISMATCH`, `GLOBAL_COUNTER_DRIFT`, `SUBJECT_COUNTER_DRIFT`, `SUBJECT_QUOTA_MISSING`, `OPERATOR_HOLD`, and `RECONCILIATION_PASSED`. Final names should be kept identical across the enum/check, routine results, monitoring and tests.

### Writer, detection and recovery protocol

All challenge issue, consume and cleanup routines must:

1. Acquire their existing higher-level locks first (sorted `User`, `AuthSession`, `TrainingSession` rows when applicable).
2. Lock the singleton integrity gate `FOR SHARE`; require exactly one row, `state='READY'`, a valid policy FK, and matching gate/global policy versions. Missing, blocked, invalid or mismatched state returns a generic unavailable result and performs no challenge/counter mutation.
3. Lock the global quota `FOR UPDATE`, then subject quota rows in ascending subject ID, then challenge rows in the agreed order. Counter changes and challenge transitions remain in the same transaction.
4. Insert any audit event only after state/counter changes and all integrity checks succeed.

Reconciliation is changed from merely report-only to **report plus durable block on detected drift**, with no automatic repair and no automatic restore:

1. Lock gate `FOR UPDATE`, then global quota `FOR UPDATE`. This serializes against every challenge writer because they hold gate `FOR SHARE` before global quota.
2. Compare global/subject counters with challenge-row aggregates, validate policy and singleton state, and detect missing quota rows. Return counts and scope IDs only; never return challenge digests/tokens.
3. On mismatch, update the gate to `BLOCKED`, store a bounded reason code, active policy version if known, database principal (`session_user`), actor kind `SYSTEM`, and database time; increment revision and append one event in the same transaction. If already blocked, do not generate unbounded duplicate transition events.
4. On a clean reconciliation, leave a BLOCKED gate blocked. A clean check is evidence for recovery, not recovery itself.

Authorized recovery is a separate maintenance-only routine:

1. Lock gate `FOR UPDATE`, then global quota `FOR UPDATE`, then subject rows sorted. This waits for in-flight operations and excludes new ones.
2. Re-run the full reconciliation and policy/singleton checks under those locks. If anything is missing or inconsistent, leave BLOCKED and return conflict.
3. Require a named maintenance database principal, an operator identifier where recovery is human-directed, and a nonempty external audit/ticket reference. Record the database principal, actor kind, asserted operator ID, reference, reason `RECONCILIATION_PASSED`, policy version, timestamp and next revision in both gate and event.
4. Set READY only after the clean check and audit insert can commit atomically. If either update or event insert fails, the whole recovery transaction rolls back and remains blocked.

The database can prove `session_user`, state, event order and transaction atomicity. It cannot independently prove that an application-supplied human identifier is truthful. For strong human attribution, recovery must use individually attributable maintenance credentials or an independently verifiable signed/immutable institutional audit reference; this is an operational approval item.

### Lock order and race behavior

Extend the P0 order to:

1. Sorted User rows.
2. Sorted AuthSession rows.
3. Sorted TrainingSession rows.
4. Integrity gate.
5. Global quota.
6. Sorted subject quota rows.
7. Sorted challenge rows.
8. Attendance rows when in the same operation.
9. Audit/event inserts last.

Challenge writers take the gate `FOR SHARE`; reconciliation and recovery take it `FOR UPDATE`. Cleanup starts at the gate and never subsequently locks User/AuthSession/TrainingSession. Account deletion and session finalization must acquire their parent locks before the gate if they need controlled challenge cleanup. They must never lock a quota/challenge and then a parent. Manual attendance that does not touch biometric state remains outside the gate protocol; session close must serialize on the TrainingSession row before it blocks or cleans biometric challenges.

If recovery races with issue/consume/cleanup, one waits at the gate. If a writer has the shared gate lock first, it completes or rolls back before reconciliation/recovery obtains its exclusive lock. If reconciliation gets the exclusive lock first, new operations wait and then observe BLOCKED or READY after commit. Missing gate, failed reconciliation, database outage, lock timeout, invalid state, or audit write failure all deny the biometric operation; none trigger a process-local fallback. Manual attendance remains independent.

### Permissions

- `ncc_biometric_owner`: NOLOGIN, non-superuser, owns app_private tables, sequences, triggers and SECURITY DEFINER routines; runtime/cleanup/maintenance logins cannot `SET ROLE` to it.
- Runtime capability role: execute issue and consume only; no app_private schema usage or direct table/sequence DML; no gate transition or event mutation.
- Cleanup capability role: execute bounded cleanup only; no issue/consume, reconciliation, recovery, direct DML or gate mutation.
- Maintenance capability role: execute report/block reconciliation and separately authorized recovery; no arbitrary table DML, DDL, trigger disable, or owner assumption.
- Migration principal: temporary and distinct from runtime. Public parent-table ownership must be explicitly arranged for the AuthSession composite unique constraint and FK creation. It may grant the function owner only the minimum SELECT and column-level UPDATE privileges needed for `SELECT ... FOR SHARE` on parent rows; runtime receives none of these privileges. Temporary REFERENCES grants must be limited to the referenced columns and revoked after FK creation when feasible.
- Revoke all routine execution from PUBLIC. Use fixed safe `search_path`, fully qualified object references, no dynamic SQL, and explicit function owner. Default privileges must not silently grant future private-table or routine access to runtime roles.
- Runtime must not be member of migration, owner, cleanup, or maintenance roles. For PostgreSQL 16 role membership, explicitly disable member `SET` capability where a login inherits a narrow capability role; test `SET ROLE` denial and effective privileges.

## B. Attendance-window semantics

### What the code and schema actually establish

`TrainingSession` is defined in `backend/prisma/schema.prisma:649-672`:

- `date` and `createdAt` are Prisma `DateTime` without `@db.Date` or `@db.Timestamptz`. For PostgreSQL Prisma's default native mapping is `timestamp(3) without time zone`; they are not SQL `date` columns or timezone-aware timestamps in this schema.
- `timing`, `startTime`, and `endTime` are strings. `timing` is required, `startTime` defaults to `"06:00"`, and `endTime` is nullable. No database format/check constraint defines their content.
- This schema inspection cannot establish the physical type/value representation of an existing database or how historical rows were inserted. No database was queried and no migration history defining these columns was found in the inspected migration directory.

### Creation, update, attendance and display paths

| Path | Observed behavior | Window relevance |
|---|---|---|
| Frontend create form, `frontend/src/components/shells/RoleShellView.tsx:161-169, 5040-5057` | Date input is `type=date`, initialized using `new Date().toISOString().split('T')[0]`. Time is a free-form text input, default `0600 - 0730 hrs`, despite its label saying START TIME. | No validated local timezone or typed start/end interval. |
| Frontend create request, `RoleShellView.tsx:561-571` | POST sends the form plus `startTime: attendanceForm.timing`; therefore the same entire display range is copied to `startTime`. | `startTime` is not reliably a time-of-day value. |
| Eligibility preview, `backend/src/controllers/attendance.controller.ts:120-146` | Requires `date` in `YYYY-MM-DD`, parses it at noon UTC, then filters eligibility by UTC day. | This is a calendar-date convention for eligibility only, not a session time window. |
| Session creation, `attendance.controller.ts:154-210` | Requires activity but does not apply the preview's date validation. Uses `new Date(date)` or current server time, trims free-form `timing` and `startTime`, and stores the supplied `Date`. | Direct API callers can omit/submit invalid date. No start/end instant is constructed. |
| Eligibility and leave checks, `attendance.controller.ts:97-117, 416-430, 1112-1124` | Builds UTC day bounds for muster/leave checks. | These day bounds do not mean attendance is allowed only during that day or during `timing`. |
| Manual mark, `attendance.controller.ts:343-440, 490-521` | Rejects a CLOSED session and validates roles/scope/leave; no current-time versus `date`/`timing` check. Writes manual attendance in its existing transaction. | Manual attendance availability is currently controlled by session state and authorization, not a time interval. Preserve this behavior. |
| Session close, `attendance.controller.ts:1317-1465` | `endAttendanceSession` writes CLOSED and stores a formatted current `endTime` string via `toLocaleTimeString` without an explicit `timeZone`. It uses local `setHours` for leave bounds in this path, unlike UTC bounds in other paths. | `endTime` is a process-locale clock string, not an absolute end timestamp. No canonical window can be recovered from it. |
| Other TrainingSession writes | Controller updates at `attendance.controller.ts:518-521, 1230-1233, 1833-1836, 1913-1926` change counters only. `verifyTestNotif.ts:77-94, 151-155` is a utility fixture that creates a Date and literal strings, then closes by setting status. No general date/time edit route was found in `attendance.routes.ts`. | No production code path normalizes or edits a canonical interval. |
| Face/challenge path | Face verification uses session status and session date for roster/leave logic (`attendance.controller.ts:804-...`, `1018-1027`); endpoints remain feature-flag gated. | Existing biometric code does not parse `timing` into a secure start/end boundary. |

The code has mixed date handling: date-only input is serialized from UTC, the create endpoint parses it as a JavaScript Date, preview uses noon UTC, eligibility uses UTC boundaries, session finalization uses local boundaries, and rendering uses host locale defaults. No explicit server or institutional timezone was found. `toLocaleTimeString` is not a stable storage format. The `timing` range can be entered as arbitrary text and is not normalized. Consequently, historical `date` + `timing` + `startTime` + `endTime` values do **not** support a reliable biometric attendance-window interpretation.

### Proposed canonical representation

Additive, nullable columns on `TrainingSession` (Prisma names shown):

```prisma
attendanceWindowStartAt DateTime? @db.Timestamptz(6) @map("attendance_window_start_at")
attendanceWindowEndAt   DateTime? @db.Timestamptz(6) @map("attendance_window_end_at")
attendanceWindowTimeZoneId String? @db.VarChar(64) @map("attendance_window_time_zone_id")
```

The authoritative interval is the pair of absolute instants, not the legacy display strings. Require API input as RFC 3339 timestamps with an explicit UTC offset; reject timezone-naive input. Normalize and persist as `timestamptz(6)`. Preserve the supplied IANA zone identifier for human display/audit when provided; it is metadata, not an alternate time authority. Do not use the server's default timezone or browser locale as an implicit policy.

Required SQL checks:

```sql
CHECK (
  (attendance_window_start_at IS NULL AND attendance_window_end_at IS NULL)
  OR
  (attendance_window_start_at IS NOT NULL
   AND attendance_window_end_at IS NOT NULL
   AND attendance_window_end_at > attendance_window_start_at)
);
CHECK (
  (attendance_window_start_at IS NULL AND attendance_window_time_zone_id IS NULL)
  OR
  (attendance_window_start_at IS NOT NULL
   AND attendance_window_time_zone_id IS NOT NULL
   AND length(btrim(attendance_window_time_zone_id)) > 0)
);
```

Application validation must check that the timezone identifier is an approved/recognized IANA zone; a normal CHECK constraint cannot safely validate membership in PostgreSQL's timezone catalog. Keep the fields nullable for legacy rows. New session creation must require both instants and the zone ID before any future biometric operation can be considered. Freeze these three fields after creation; session closure changes status and the legacy `endTime` only. The issue and consume routines require `status='ACTIVE'`, non-null window fields, and `db_now >= attendance_window_start_at AND db_now < attendance_window_end_at`. The challenge expiry is capped at `LEAST(db_now + maxChallengeTtl, attendance_window_end_at)`. Recheck under the TrainingSession row lock at both issue and consume.

No automatic data migration is safe. Existing rows get NULL canonical windows and remain ineligible for biometric challenge operations. Do not parse `timing`, copy `startTime`, or interpret historical `endTime` to backfill. Manual attendance continues using current role/session-state workflow and remains available for those rows.

## Compatibility, migration sequencing and acceptance tests

1. First approve and add the gate/event enums and models, their policy back-relations, and canonical TrainingSession window fields to Prisma. Revalidate with the locked Prisma version; do not regenerate or migrate until separately authorized.
2. Separately review an additive migration: create gate/event objects and restrictive FKs; seed only the BLOCKED/NOT_CONFIGURED gate safety row/event; add nullable window columns and consistency checks; do not seed `BiometricChallengePolicy` or global quota operational values.
3. Add routines that fail closed on missing gate, BLOCKED state, missing/mismatched policy/quota, invalid window, inactive session, revoked/expired auth session, and database errors.
4. Keep old rows with null window fields compatible with ordinary/manual attendance. No backfill from ambiguous strings. Legacy process-local challenges remain invalidated at cutover; no Map fallback.
5. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled and biometric routes inaccessible until later approvals. The schema addition alone must not change route behavior.

Acceptance tests (all future; not run):

- Missing gate, duplicate singleton attempt, invalid enum/state, BLOCKED gate, READY without policy, gate/global policy-version mismatch, and missing global quota all fail closed.
- Two issue/consume/cleanup transactions concurrent with reconciliation prove gate lock behavior: reconciliation waits for active shared locks, then blocks on drift; later writers see BLOCKED. Conversely writers wait behind reconciliation and observe its committed state.
- A clean reconciliation never clears BLOCKED; only authorized recovery can do so.
- Recovery with drift, missing quota rows, missing policy, failed event insertion, or unauthorized role never produces READY.
- Successful recovery records unique revision, database principal, actor kind, reason, policy version, timestamp, and external audit reference atomically.
- Direct runtime gate/event mutation, event deletion, recovery invocation, owner/migration role assumption, and cleanup/reconciliation access are denied.
- Initial migration state is BLOCKED with no operational policy/quota values; no challenge can be issued until a separate policy activation procedure and recovery decision.
- Null legacy window, only one endpoint, equal/reversed endpoints, timezone-naive input, out-of-window time, at-start, at-end, closed session, and changing a window after creation are rejected as specified.
- Window instant serialization is invariant across backend host timezone changes.
- Manual attendance for an ACTIVE legacy session with null canonical window works as before; biometric challenge issue remains unavailable.
- Session close racing with challenge issue/consume yields one serialized outcome; no challenge is usable after closure or after the end instant.

## Remaining decisions and implementation gates

1. Approve exact public Prisma schema changes and migration ordering. The current schema does not contain the proposed integrity gate/event or window fields.
2. Select the allowed IANA timezone(s) and define who may create a window, maximum/minimum duration, whether starts in the past are allowed, and any opening/grace period. The proposed authorization interval itself is `[start,end)` with no implicit grace; institutional limits are not invented here.
3. Decide retention for integrity events and the external audit/ticket reference system. Do not let challenge-row retention delete the integrity event history.
4. Specify whether operator identity uses individually attributable DB credentials or a trusted service with a verifiable external audit reference. A caller-supplied actor ID alone is not database proof.
5. Identify/authorize the disposable test database migration owner and public parent-table privileges before the later SQL rehearsal. No existing database was accessed to determine ownership.
6. Implement the app create contract for explicit instants and ensure new rows populate window columns; until that is done, issue/consume remain fail closed. This requires a later, separately scoped source change.

