# BSR-05 P0.3 Prisma Update

> **Status note (23 November 2026):** the “Decisions intentionally left unconfigured” section below records the state at the time of the original schema-only task. It is superseded by `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`, which now records project-level approval of those operational rules and values. The approval does not mean SQL enforcement, policy activation, or PostgreSQL verification is complete.

## Result

Implemented the Prisma representation for the integrity gate, append-only transition events, and canonical attendance-window fields. The schema is structurally valid with Prisma 6.19.3. This is schema-only: no migration or SQL routine was created or applied, and no runtime behavior changed.

## File changed

- `backend/prisma/schema.prisma`

The file was already modified before this task for P0.1/P0.2 and other existing workspace work. Those changes were preserved; this task added only the fields/enums/models described below.

## Added schema definitions

### Integrity enums

- `BiometricChallengeIntegrityState`: `BLOCKED`, `READY`; mapped to `app_private.biometric_challenge_integrity_state`.
- `BiometricChallengeIntegrityActorKind`: `SYSTEM`, `SERVICE`, `DATABASE_OPERATOR`; mapped to `app_private.biometric_challenge_integrity_actor_kind`.

Both enums use `@@schema("app_private")`.

### `BiometricChallengeIntegrityGate`

Fields: `singletonKey` (primary key), required `state`, required `reasonCode`, optional `policyVersion`, `stateRevision` (default 1), `changedAt` (`clock_timestamp()` database default, timestamptz(6)), required `actorKind`, required `actorPrincipal`, optional `actorUserId`, and optional `auditReference`.

Relations: optional restrictive relation to `BiometricChallengePolicy`, plus the event collection. The model maps to `app_private.biometric_challenge_integrity_gate`.

The state has **no default**. The initial migration proposal seeds the singleton as BLOCKED/NOT_CONFIGURED, but a Prisma model default cannot be trusted to establish that safety state. Missing gate rows must be denied by every future database routine.

### `BiometricChallengeIntegrityEvent`

Fields: autoincrementing `BigInt` ID, `singletonKey`, `stateRevision`, optional `previousState`, required `newState`, `reasonCode`, optional `policyVersion`, `actorKind`, `actorPrincipal`, optional `actorUserId`, optional `auditReference`, and `occurredAt` (`clock_timestamp()` database default, timestamptz(6)).

Relations: restrictive relation to the gate and optional restrictive relation to policy. It has a unique `(singletonKey, stateRevision)` constraint and an `(occurredAt, id)` index, and maps to `app_private.biometric_challenge_integrity_event`.

The event’s actor ID intentionally has no FK to `User`; this avoids making historical audit retention block account deletion or cascade with account deletion. P0.3 must define sequence ownership/privileges and append-only enforcement.

### `BiometricChallengePolicy` back-relations

- `integrityGate BiometricChallengeIntegrityGate[]`
- `integrityEvents BiometricChallengeIntegrityEvent[]`

The blocker-resolution proposal showed the first back-relation as optional one-to-one. Prisma 6.19.3 rejected that form because `policyVersion` is not unique on the gate model. The list back-relation is the valid Prisma representation; the later SQL singleton-key CHECK will enforce at most one actual gate row.

### `TrainingSession` attendance-window fields

- `attendanceWindowStartAt DateTime? @db.Timestamptz(6) @map("attendance_window_start_at")`
- `attendanceWindowEndAt DateTime? @db.Timestamptz(6) @map("attendance_window_end_at")`
- `attendanceWindowTimeZoneId String? @db.VarChar(64) @map("attendance_window_time_zone_id")`

All three are nullable. No timezone, window, limit, or legacy value is assigned. Existing `date`, `timing`, `startTime`, and `endTime` fields were left unchanged. Existing sessions therefore remain without invented absolute windows.

## Constraints reserved for P0.3 SQL

Prisma cannot express these required invariants by itself:

- `singleton_key = 'GLOBAL'` and exactly-one-row checks (a primary key only prevents duplicate keys; it cannot require a row or prohibit other key values).
- `READY` requires non-null `policy_version`; nonblank reason/principal; positive gate revision; actor/audit-reference conditional requirements.
- Event transition rules, including initial-event and previous/new-state consistency, positive revisions, and append-only UPDATE/DELETE/TRUNCATE prevention.
- Gate `policy_version` must match the global quota’s active policy version.
- The initial BLOCKED/NOT_CONFIGURED gate row and corresponding first event.
- Attendance-window endpoint pairing, `end > start`, and zone-ID pairing/nonblank checks.
- Freezing attendance-window fields after session creation.
- Cross-table quota/policy constraints and routine-only state mutation.

Until those SQL constraints, permissions, and fail-closed routines exist, the schema model alone does not authorize treating the gate as READY. Runtime code is unchanged and must not use these models yet.

## Decisions intentionally left unconfigured

- IANA timezone allowlist/default and who selects the zone.
- Minimum/maximum attendance-window duration, whether past starts are allowed, or any grace period.
- Integrity-event retention duration and backup treatment.
- Recovery identity model and external audit-reference authority.
- Operational biometric policy values and global quota singleton configuration.

The proposed interval semantics remain absolute instants with strict `[start,end)` checks; no grace period is implied. Application creation/update code must later submit and validate explicit offset-bearing instants and a zone ID. This task did not change that code.

## Validation performed

- Resolved Prisma CLI / Client: **6.19.3 / 6.19.3**.
- `prisma format`: **passed** after correcting the policy back-relation. The formatter reflowed many unrelated pre-existing declarations; that formatting-only churn was reverted and the additive schema changes were retained.
- `prisma validate`: **passed** on the final schema from `/tmp`, with dummy unreachable database URLs and no dotenv loading.
- `backend` TypeScript check (`tsc --noEmit`): **passed** against the existing generated client; Prisma Client was not regenerated.
- `git diff --check`: **passed**.
- Database, migration, `db push`, container, seed, model, and application test operations: **not run**.

