# BSR-05 P0.3 SQL Implementation Status

**Result: BLOCKED — no executable migration SQL was created.**

**Superseding status note (23 November 2026):** the original blocker analysis below is historical. The current Prisma schema now contains `BiometricChallengeIntegrityGate`, `BiometricChallengeIntegrityEvent`, and nullable canonical attendance-window fields, and the operational register now records the attendance-window rules as approved. Those changes resolve the schema/decision prerequisites identified in B1 and B2; they do not provide SQL enforcement or PostgreSQL verification. No executable SQL, migration, role grants, recovery/policy-lifecycle audit persistence, or PostgreSQL runtime test has since been completed. The B3 ownership/privilege verification remains open.

The requested P0.3 migration cannot safely implement all canonical transaction and authorization requirements against the current P0.2 Prisma schema. The P0 specification requires behavior that has no persistent representation in the approved model, and it requires an attendance-window check for which the current database has no typed window fields or approved interpretation. Creating a migration anyway would require guessing or adding unreviewed schema objects.

No source, Prisma schema, environment, or feature-flag files were changed in this task. No migration was created or applied. No database, container, or model was accessed.

## Readiness by requirement

| Requirement | Status | Evidence / disposition |
|---|---|---|
| Separate global and per-subject quota tables | PASS — schema shape exists | `BiometricChallengeGlobalQuota` and `BiometricChallengeSubjectQuota` are present in `backend/prisma/schema.prisma`; no polymorphic quota model was added. |
| Challenge and policy schema | PASS — schema shape exists | `BiometricVerificationChallenge`, `BiometricChallengePolicy`, and `BiometricChallengePurpose` are present. |
| Referential ownership | PASS — Prisma representation exists | Subject User, TrainingSession, policy, and composite AuthSession `(id,userId)` relations are represented; deletion actions are restrictive for biometric children. |
| Operational policy remains unconfigured | PASS | Policy values have no defaults and no seed row is proposed. Issue/consume/cleanup must reject missing or invalid active policy and missing global singleton configuration. |
| Digest, timestamp, singleton and numeric checks | NOT IMPLEMENTED | These require reviewed custom SQL constraints. No SQL was written because the blockers below prevent completing the required runtime contract safely. |
| Partial indexes | NOT IMPLEMENTED | P0 requires consumed-retention and pending-subject partial indexes; Prisma cannot encode their predicates. They remain migration SQL work. |
| Atomic issuance / consumption / cleanup | NOT IMPLEMENTED | No executable functions were created. Their transaction behavior depends on resolution of the persistent integrity gate and attendance-window contract. |
| Reconciliation and fail-closed-after-drift | BLOCKED | There is no persisted integrity state in `BiometricChallengeGlobalQuota`, `BiometricChallengeSubjectQuota`, `BiometricVerificationChallenge`, or `BiometricChallengePolicy`. |
| Least-privilege role definitions | BLOCKED FOR EXECUTABLE GRANTS | Role capabilities can be specified, but the migration owner and exact public-table ownership/privileges are unknown. The P0 design itself says the public-table owner has not been inspected. No database was inspected here. |
| PostgreSQL runtime/catalog/ACL tests | NOT RUN | The task prohibited database connections and containers. |

## Blocking findings

### P0.3-B1 — No persistent integrity halt after reconciliation detects drift

The P0 routine contract says reconciliation is report-only, but also says issue, consume, and cleanup must fail closed after a mismatch has been detected until operator review. A report-only routine cannot persist that state. The four current private models have no integrity status, quarantine flag, incident row, or equivalent gate. Rechecking table counts on every hot-path call would contradict the P0 design’s prohibition on `COUNT(*)` quota decisions and would still need a defined concurrency boundary.

**Required correction before SQL:** amend the canonical schema to include a database-enforced integrity gate (or revise the P0 contract to define another enforceable mechanism). Specify who may set/clear it, what event sets it, how all routines check it, and the operator evidence required to clear it. Then update Prisma, exact SQL, migration, ACL and test artifacts consistently. Do not add an unmodeled private table only in SQL; that would create Prisma drift and an undocumented authorization surface.

### P0.3-B2 — Attendance-window predicate is undefined in the canonical schema

The issue/consume design requires the TrainingSession to be within its applicable attendance window. `TrainingSession` currently has `date`, `startTime` and `endTime` as date/string fields, and the canonical private policy has no window parameters. The string time fields do not define timezone, date rollover, grace periods, inclusive boundaries, or behavior when `endTime` is null. Treating `status='ACTIVE'` as an attendance-window check would silently weaken the stated requirement.

**Required correction before SQL:** decide whether the window is derived from typed TrainingSession fields or from a separately approved policy. Define timezone, boundaries, null/end-time semantics, and the exact timestamp used. Update the SQL contract and tests before writing the function predicate. Until then, challenge operations must remain unavailable.

### P0.3-B3 — Ownership and lock privileges cannot yet be asserted

The P0 role plan needs a non-login function/table owner able to perform private-table writes and parent-row `FOR SHARE` locks. The design notes that PostgreSQL row-locking SELECT requires UPDATE privilege on at least one column, and that creating the composite AuthSession unique constraint requires the public table owner or an authorized migration principal. The actual public table owner is unknown because no database may be inspected. Embedding unconditional `ALTER TABLE`, role ownership changes, or parent-table grants in a migration without those preconditions would not be safely executable in every intended target.

**Required correction before applying a migration:** define the disposable target’s owner/migrator arrangement and verify the exact privileges there under the separately authorized PostgreSQL test phase. The migration can then assert required ownership and fail before making changes if preconditions are absent. Do not broaden runtime privileges to work around this.

## Required P0.3 SQL scope after blockers close

The migration must be prepared from the updated canonical schema and must include, at minimum:

1. The four app_private tables and purpose enum, with no operational policy seed.
2. The AuthSession composite unique constraint and restrictive foreign keys to User, AuthSession, TrainingSession and policy.
3. Local checks for canonical SHA-256 lowercase hex, timestamp order/consumption bounds, singleton key `GLOBAL`, nonempty version, lowercase 64-character policy hash, positive limits/capacities/refill values, nonnegative retention durations, bounded counters/balances, and finite numeric values.
4. Custom cross-row/policy checks in routines or triggers where ordinary CHECK constraints cannot reference another row. Do not claim a CHECK can enforce active-policy limits across tables.
5. The exact P0 partial indexes:

   ```sql
   CREATE INDEX biometric_challenge_consumed_retention_idx
     ON app_private.biometric_verification_challenge (consumed_at, id)
     WHERE consumed_at IS NOT NULL;

   CREATE INDEX biometric_challenge_subject_pending_idx
     ON app_private.biometric_verification_challenge (subject_user_id, expires_at, id)
     WHERE consumed_at IS NULL;
   ```

6. Immutable policy and challenge-binding/one-way-consumption triggers; no trigger-side quota mutation.
7. Security-definer issue, consume, bounded cleanup and report-only reconciliation functions with fixed safe `search_path`, schema-qualified references, generic external results, and atomic counter writes in the same function statement.
8. A persistent integrity gate check in every writer/cleanup function once B1 is resolved.
9. Explicit capability roles: migration principal, non-login object/function owner, runtime issue/consume capability, cleanup capability, and maintenance/reconciliation capability. No runtime direct DML, DDL, owner membership, or execution of cleanup/reconciliation/repair.
10. Catalog assertions for exact relation targets/actions, constraints, indexes/predicates, owners, `SECURITY DEFINER`, function `search_path`, PUBLIC revocation, and grants.
11. No seed rows. A separately authorized disposable test fixture may supply clearly named synthetic values only after target identity is independently verified. Missing or invalid policy/singleton/gate must fail closed.

No standalone attempt-admission routine should be executable: token refill/debit, quota reservations, and challenge insertion must remain atomic in the issuance function. Consumption and cleanup must serialize through the global quota row and decrement counters only for rows actually transitioned/deleted in the same transaction. Runtime role-negative tests must prove direct INSERT/UPDATE/DELETE/TRUNCATE and role escalation fail.

## Test status and next safe action

**PostgreSQL runtime tests: NOT RUN.** No SQL parser/catalog validation was attempted because the migration has not been authored and no disposable PostgreSQL target was created.

After B1 and B2 are resolved, the next implementation step is to amend the Prisma model and P0 SQL contract, then author the unapplied migration and role bootstrap artifacts. Validate syntax and catalog expectations only against the separately approved disposable PostgreSQL target. Until then, keep biometric challenge routes inaccessible, `ENABLE_BIOMETRIC_ATTENDANCE` disabled, and manual attendance unchanged.

## Validation and safety record

- Reviewed the four requested P0 artifacts and current Prisma schema definitions.
- Confirmed current schema names and relation fields statically; no generated client or source code changed.
- No database connection, migration command, `db push`, container, seed, or test execution occurred.
- No operational TTL, quota, refill rate, retention period, cleanup limit, or timeout was invented.
- No polymorphic quota design was introduced.

