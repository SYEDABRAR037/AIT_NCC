# BSR-05 / BSR-08 / BSR-07 Design and Safe Remediation

**Date:** 2026-11-22  
**Scope:** local source review and code-only remediation; no database was contacted.

## Executive summary

- **BSR-05:** The current challenge store is process-local. A PostgreSQL store is a reasonable self-hosted, architecture-compatible target, but requires a new table, indexes, relations, cleanup policy, and a migration. This report specifies the design; no schema or migration is implemented.
- **BSR-08:** Login failure events currently store a stable SHA-256 digest of the submitted identifier and swallow audit write errors. The digest is guessable and unnecessary for institutional accountability. Keep known account ID as the audit target, represent unknown identities generically, omit the submitted identifier and digest, and fail closed with a sanitized 503 when persistence fails.
- **BSR-07:** The existing conditional claim/create and unique `(sessionId,cadetId)` key implement a single-winner approach, while manual upsert intentionally supports correction. A true competing-request integration test requires an isolated disposable PostgreSQL database and is designed here, not run.
- **BSR-04:** Durable `sid` is issued at successful OTP login and required by authenticated middleware. There is no refresh-token endpoint in the inspected auth routes. Existing valid sid-less JWTs will stop authorizing API requests and require a fresh password + OTP login.

## BSR-05 — PostgreSQL challenge-store proposal

### Current behavior and risk

`backend/src/services/verificationChallengeStore.ts` keeps challenge records in one Node process. It stores token digests and binds each challenge to attendance session, operator, and durable auth session; it enforces expiry, one-time consumption, and in-process caps. A request routed to another backend instance cannot see the challenge. A process restart also invalidates pending challenges. This fails closed but is not shared multi-instance persistence.

### Proposed schema (not applied)

Add a dedicated `BiometricVerificationChallenge` model. Proposed columns:

| Field | Purpose |
|---|---|
| `id UUID` primary key | Internal row identity |
| `tokenHash String` unique | SHA-256 digest of a random 256-bit bearer token; never store raw token |
| `trainingSessionId String` | Attendance-session binding; FK to `TrainingSession` |
| `operatorUserId String` | Authenticated operator binding; FK to `User` |
| `authSessionId String` | Durable login-session binding; composite FK to `AuthSession(id,userId)` |
| `createdAt`, `expiresAt` timestamp with timezone | Server-side issue and expiry times |
| `consumedAt DateTime?` | Single-use state |

Required constraints/indexes:

- `UNIQUE(tokenHash)`.
- `AuthSession @@unique([id,userId])` to support a Prisma composite relation; although `id` alone is unique, Prisma requires the referenced field tuple to be unique.
- Composite FK `(authSessionId,operatorUserId) -> AuthSession(id,userId)`; this prevents binding a challenge to another user's durable session.
- FKs to `TrainingSession` and `User`, with deletion behavior chosen explicitly (prefer cascade for challenge rows because challenges are ephemeral; ensure audit/accountability records are independent).
- Indexes on `expiresAt`, `(operatorUserId,expiresAt)`, and `(trainingSessionId,expiresAt)` for bounded cleanup and pending counts.
- `CHECK (expiresAt > createdAt)` and `CHECK (consumedAt IS NULL OR consumedAt >= createdAt)` via manual SQL if Prisma cannot express them.
- Partial unique indexes are not required for single-use because consumption is a conditional update; pending quotas require transactional counting/locking rather than a partial unique index.

Prisma cannot express all PostgreSQL partial indexes or check constraints in schema syntax in a portable way; add those only in a reviewed SQL migration. No active biometric consent model is introduced by this proposal.

### Atomic issue/consume design

**Issue:** Generate at least 32 CSPRNG bytes; give the raw base64url token to the caller once and persist only its SHA-256 digest. In a database transaction, use `SERIALIZABLE` or an explicit `pg_advisory_xact_lock` scoped to operator ID to serialize that operator's pending quota. Verify `(authSessionId,operatorUserId)` is active (`revokedAt IS NULL`, `expiresAt > clock_timestamp()`), verify session/operator eligibility and session is active, expire/delete eligible stale rows in bounded batches, count outstanding unconsumed/unexpired challenges, enforce configured cap, then insert. Use the database clock for comparison. Retry serialization failures only a small bounded number of times; otherwise return a controlled retryable service error.

**Consume:** Hash the presented token. In a short transaction execute one conditional update equivalent to:

```sql
UPDATE "BiometricVerificationChallenge" c
SET "consumedAt" = clock_timestamp()
WHERE c."tokenHash" = $1
  AND c."trainingSessionId" = $2
  AND c."operatorUserId" = $3
  AND c."authSessionId" = $4
  AND c."consumedAt" IS NULL
  AND c."expiresAt" > clock_timestamp()
  AND EXISTS (
    SELECT 1 FROM "AuthSession" s
    WHERE s.id = c."authSessionId" AND s."userId" = c."operatorUserId"
      AND s."revokedAt" IS NULL AND s."expiresAt" > clock_timestamp()
  )
RETURNING c.id;
```

Exactly one returned row wins; zero rows means invalid, wrong binding, expired, revoked, or replayed. Return a generic invalid/expired challenge response so token existence is not disclosed. Commit consumption **before** image/descriptor matching, so a later exception cannot roll it back and permit replay. A new challenge is required after any failed verification.

For revocation races, the auth-session check and challenge consume should use row locks (`SELECT ... FOR UPDATE`) or a transaction that locks the `AuthSession` row before the conditional update. Logout/revocation uses the same row lock/update semantics. The guarantee is linearizable per auth-session row: whichever transaction obtains/commits the lock first determines whether the challenge can be consumed. Keep the consume transaction short; never hold locks while doing inference.

**Cleanup:** A scheduled bounded deletion of old consumed/expired rows; define retention before implementation. Challenge rows contain no face data. Do not silently rely on process-local cleanup for shared rows. Database availability failure must fail closed; do not fall back to an uncoordinated local store in multi-instance mode.

### Risks and approval gates

- A new model and migration are required; this request explicitly prohibits both.
- Pending-challenge quota and cleanup retention need an approved operational setting.
- Multi-instance test requires a disposable PostgreSQL instance and at least two independent DB clients/processes.
- Challenge storage must not become a substitute for consent, liveness, or trusted capture.
- Existing in-memory behavior remains until the migration and cutover are separately approved.

## BSR-08 — login audit and identifier minimization

`auth.controller.ts` currently persists an unsalted digest of each failed login identifier and suppresses all persistence errors with `.catch(() => {})`. Because user identifiers have limited/guessable space, a plain SHA-256 digest does not anonymize them. The event needs to preserve the fact/time/action and, where lookup found an account, an internal user ID for accountability; it does not need the submitted email, phone, regimental number, or their digest.

Safe code-only correction: record `AUTH_LOGIN_FAILED`; set `targetType=AUTHENTICATION`; use the known internal `user.id` as `targetId` for a found account; use a constant generic actor (`UNKNOWN`) and no target for an unmatched identifier; omit details. On audit persistence failure, do not return the ordinary invalid-credentials response: log only a fixed sanitized security-audit failure marker and return a generic 503 for both branches, avoiding account enumeration and avoiding a false claim that the attempt was durably audited. Do not include Prisma error text, submitted identifier, credentials, OTP, or token in the response/log marker. Existing password verification and login rate limits remain unchanged. Failed-login audit persistence remains outside an account/session transaction because no state transition has occurred; successful OTP session creation and its audit stay in their existing transaction.

For attendance event details, keep the actor, attendance record ID (`targetId`), cadet internal ID, session ID, action and timestamp. Remove cadet name and regimental number from free-text details. This retains a stable institutional audit trail while reducing direct identifiers in broad audit-log views. Access/retention policy still needs institutional review.

## BSR-07 — PostgreSQL competing-request integration test design

Do not point this test at an existing development, production, or backup database. Create a separately named disposable PostgreSQL database under a future explicit authorization, use a dedicated test URL, and make the existing test isolation guard reject all other URLs. Do not alter the feature flag for runtime attendance. Test the atomic persistence service/transaction path with synthetic fixture rows and injected deterministic match results, so the dormant biometric route need not be enabled.

1. Create one active synthetic training session, one synthetic eligible cadet, two independent valid challenge fixtures, and no existing attendance row. Do not use real cadet PII or biometric templates.
2. Start two independent Prisma clients/processes. Put a test barrier immediately before the attendance claim transaction so both requests have passed the read/pre-check before either attempts the write.
3. Submit both concurrent claims for the same `(sessionId,cadetId)`.
4. Assert exactly one result is the success result; the other is `409 ALREADY_MARKED`; exactly one row exists, status `PRESENT`; `presentCount=1`; exactly one attendance audit event exists; only the winner schedules any notification.
5. Repeat with a pre-existing `ABSENT` row. Exactly one conditional update may transition it to `PRESENT`; the loser gets conflict.
6. Separately assert manual attendance still uses its existing upsert/correction semantics and can correct `ABSENT` to the requested status, with audit transaction behavior preserved.
7. Clean only fixtures inserted by the test run, in FK-safe order; destroy both clients; drop only the uniquely named disposable database after verifying its exact name and ownership.

Do not treat mocked tests as evidence of PostgreSQL concurrency. Test should be tagged integration and skipped unless its database-isolation guard confirms a dedicated disposable DB. It must never run `migrate reset`, seed real data, or target `ncc_local_dev`.

## BSR-04 — session/JWT compatibility review

Successful login first verifies the password and OTP; `otpAuth.controller.ts` creates `AuthSession` and signs JWT claims with `sid=session.id`. `authenticateToken` now rejects missing `sid`, checks user/session identity, revocation, expiry, and current account state. Logout revokes durable session IDs and clears the cookie; session-list/revoke/revoke-all and password-change paths use durable records. The auth router has no refresh-token endpoint. Password-recovery tokens are a distinct purpose and do not represent authenticated API sessions. Thus newly authenticated paths do not need a migration or token-format change.

Compatibility impact is intentional: any still-valid legacy JWT without `sid` becomes unauthorized at the next protected API request. The user must sign in again with their existing credential and complete OTP; password reset is not required. Browser clients should clear the old token and restart login after 401. There is no refresh endpoint to preserve or update. Do not add a sid-less compatibility exception because it would bypass durable revocation.

## Verification boundary

This design was derived from source inspection and existing mocked tests. It is not a PostgreSQL execution, migration validation, runtime delivery, multi-process test, or institutional privacy approval. Schema, database, migration, and model/feature-flag states remain unchanged.
