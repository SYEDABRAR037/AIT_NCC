# AIT NCC — Biometric Next Development Steps

Prototype development with synthetic identities and mocks may proceed. Real biometric capture, model integration, durable consent migration and attendance activation remain gated. Preserve manual attendance and keep ENABLE_BIOMETRIC_ATTENDANCE disabled.

## Recommended first implementation task

Add model-provider interfaces plus a deterministic synthetic mock provider behind dependency injection, with pure tests proving:

1. Only allowlisted synthetic fixtures can use it.
2. It cannot accept client-supplied match booleans or trusted embeddings.
3. It cannot create/update BiometricTemplate or TrainingAttendance.
4. It is unavailable unless local development/test mode and explicit opt-in are set, and fails startup if selected in production.
5. Existing authentication/authorization/manual attendance behavior is unaffected.
6. Biometric attendance still returns the disabled response when the flag is off.

This is a useful first coding task without model selection, real data, schema changes, DB access or feature activation.

## Development sequence

| Order | Work | Completion evidence |
|---|---|---|
| 1 | Provider interfaces and synthetic mock contract tests. | Tests cover fixture allowlist, no writes, invalid provider results and flag-off behavior. |
| 2 | Revise BSR-05 design for independent findings R1–R6. | 1:1 subject binding; global and subject quotas; distributed rate limit; lock order across auth revocation/session finalization/attendance; expiry/cleanup; bounded errors/retention specified. |
| 3 | Harden disposable DB harness. | Exact target/container identity, loopback binding/port, DB name, role, version and empty state verified before writes. |
| 4 | Challenge-store interface, PostgreSQL adapter and additive migration. | Separate migration authorization and verified disposable DB; two-client concurrency, replay, cleanup, outage and logout/session-close races pass. |
| 5 | Synthetic DEMO_ONLY consent state machine. | Replay, expiry, purpose, revoke, fresh re-grant/re-enrollment and manual attendance independence tested. Persistent version only after DB isolation and schema approval. |
| 6 | Model clearance and evaluation protocol. | Written artifact-specific terms/data rights and authorized privacy review; otherwise remain NO-GO. |
| 7 | Server-side capture, recognition and PAD. | Only after model rights and evaluation authorization; strict versioning, 1:1 scope and fail-closed tests. |
| 8 | Attendance integration and validation. | Explicit approvals and prior technical gates; separate activation review; manual path remains independent. |

## Database isolation guard reviewed

backend/src/databaseSafety.ts disables dotenv in test setup. Without explicit disposable mode it rejects inherited DATABASE_URL/DIRECT_URL except the fixed unreachable localhost:9 sentinel, sets both Prisma URLs to that sentinel, and marks NCC_TEST_DATABASE_ISOLATED=false. backend/src/db.ts uses a Prisma extension that throws on any unmocked database operation in pure mock tests.

Explicit disposable mode requires ALLOW_DISPOSABLE_TEST_DB=true, DISPOSABLE_TEST_DATABASE_URL, the exact acknowledgement phrase, PostgreSQL URL scheme, host in localhost/127.0.0.1/::1/postgres-test, and database path containing test or mock. It rejects conflicting inherited URLs, then sets both Prisma URLs to the explicit URL and marks isolation true. testScriptBootstrap.ts and scriptPrisma.ts provide guarded integration entry points.

The guard does not prove the server is disposable, empty, the right container/role/version, or that postgres-test resolves only to loopback. The acknowledgement is not verification. Future test bootstrap must separately verify container ID/label, loopback-only host port, exact database and role, server major version, and empty baseline. Do not use existing Compose service/volume. Do not run broad npm test in disposable mode; run only a dedicated integration test.

Safe future disposable plan, not executed: provision a newly named local PostgreSQL instance with temporary storage and loopback-only port; unset inherited database URLs; provide the disposable URL through protected local environment; verify identity/empty state before writes; apply reviewed migration only there; run dedicated test; disconnect and remove only that exact temporary instance/storage. Never connect to ncc_local_dev, production, or backups.

## Exact blockers

- BSR-05 shared-store code/migration: six independent review findings remain, including global quota/rate limiting, expiry race, lock ordering, 1:1 subject contract, DB constraints and bounded outage behavior.
- BSR-07 PostgreSQL race: no integration test exists; session-close and attendance-write locks must be reconciled.
- Current test guard is fail-closed but cannot establish disposable DB identity itself.
- Consent database schema and migration are not implemented; no persistent consent demo should be wired to application data before isolation and schema review.
- No model/PAD candidate is cleared; no authorized accuracy or attack evaluation has occurred.
- No real-cadet capture/data and no attendance feature activation.

## Work performed

Created four planning documents only. No code, schema, migration, environment, database or feature flag changed; no tests were run. Existing working-tree changes were left intact.
