# BSR-05 Implementation Gate

**Decision: NO-GO for implementation, schema change, migration, or PostgreSQL integration execution.**

This gate follows the nine-finding correction in BIOMETRIC_BSR05_NINE_FINDING_RESOLUTION.md and the case-by-case matrix in BIOMETRIC_BSR05_FINAL_TEST_MATRIX.md. No application/source/schema/environment files were changed, no migration was created, no database/container/test was run, and the biometric feature flag remains untouched. Manual attendance remains independent.

## Critical/high status

- **Critical findings:** None were classified Critical in the final database review.
- **High findings:** DB-01, DB-02, DB-03, DB-05, DB-06 and DB-08 each have a specific design correction in the resolution document. **They are not resolved for implementation** because no executable SQL/routines, roles, identity harness, migration or PostgreSQL evidence exists. Mark all six **DESIGN-CORRECTED / IMPLEMENTATION-OPEN**.
- Therefore, **not every high finding is closed**. They are specified, not implemented or verified. Implementation gate remains NO-GO.

## Finding gate register

| Finding | Design correction | Implementation/verification state | Gate |
|---|---|---|---|
| DB-01 Counter write boundary | Runtime execute-only routines; no direct challenge/quota DML; atomic routine transaction. | No routines, privileges or tests. | OPEN |
| DB-02 Initialization and reconciliation | Migration-seeded GLOBAL row; race-safe subject creation; constrained scope; stopped reconciliation. | No schema, seed, SQL constraints or procedure. | OPEN |
| DB-03 Atomic quota transitions | Conditional returned-row reservations, one-way consume, atomic cleanup and rollback. | No database implementation or race evidence. | OPEN |
| DB-04 Expiry/cleanup/storage distinction | Separate validity, outstanding, retained, audit, backup and physical capacity controls. | Retention/cap values and cleanup SQL unset. | OPEN |
| DB-05 Least privilege | Separate roles, minimal owner, safe function ACL/search_path, bounded cleanup role. | No role provisioning, function definition or ACL verification. | OPEN |
| DB-06 Lock/FK behavior | Canonical lock order; controlled account/session delete; bounded retries only for confirmed abort. | Current writers not migrated; implicit FK lock races untested. | OPEN |
| DB-07 Prisma/custom SQL | Prisma models relational core; raw migration SQL and catalog checks for unsupported controls. | No final schema validation or migration. | OPEN |
| DB-08 DB identity | Out-of-band disposable server/container attestation and empty-schema check before write. | Current guard does not attest identity; enhanced harness absent. | OPEN |
| DB-09 Values/retention | Finite versioned policy; distinct challenge/audit/backup retention and physical monitoring. | Values and responsible approvals unresolved. | OPEN |

## Exact blockers before implementation

1. **Resolve policy values and approvals:** TTL; global and per-subject outstanding caps; global retained-row cap; token-bucket capacities/refill; cleanup frequency/batch; lock, statement, pool and request timeouts; policy version; accepted burst/throughput envelope; challenge-row and audit retention; account deletion/anonymization; backup expiry/restore rules. Do not infer these values.
2. **Approve the schema and migration plan:** finalized Prisma relations/back-relations, AuthSession compound unique target, quota row ownership/lifecycle, exact FK delete actions and indexes.
3. **Write and review exact PostgreSQL SQL:** routine signatures and bodies; constraints; triggers if any; policy seed; counter reconciliation; bounded cleanup; role ownership/ACL; fixed search_path and PUBLIC revoke/grants.
4. **Complete source lock inventory:** every User deletion/status update, AuthSession revoke/revoke-all, TrainingSession close/delete, attendance mark/correction/import/count update, challenge transition, audit write and implicit cascade. Migrate all relevant writers or prove them disjoint.
5. **Add disposable test identity harness:** prove actual new server/container identity, unique run label, loopback binding, database/role/version, empty schema and per-run marker before first write. URL substring and a confirmation phrase alone do not qualify.
6. **Obtain separate authorization** before creating schema/migrations, provisioning a disposable database/container, or executing PostgreSQL tests. No existing DB may be used.
7. **Implement dedicated PostgreSQL suite** and execute applicable T01–T80 cases with synthetic fixtures, independent connections, fault injection, role tests, cleanup, and lock/SQLSTATE evidence. Keep ENABLE_BIOMETRIC_ATTENDANCE disabled.
8. **Review mixed-version and rollback behavior:** old Map routes stay unavailable; no dual-store or fallback; rollback disables shared challenge operations and retains additive state.
9. **Keep biometric release gates separate:** consent, model licensing, PAD/liveness, institutional authorization, face verification and production release are not approved by this database review.

## Next authorized-safe action

The next safe action is a design/approval decision package for quota values, retention, deletion, and role provisioning. Once approved, prepare the exact migration SQL and dedicated harness for review; do not apply it until the database identity and migration authorization gates are satisfied.

## Stop boundary

This deliverable is the end of this task. Do not implement, migrate, connect, test, enable biometric attendance, deploy, or alter Git history under this gate.
