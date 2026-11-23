# AIT NCC Biometric Final Security Review

**Review type:** Read-only source and test inspection  
**Review date:** 2026-11-22  
**Scope:** Existing biometric enrollment, storage, matching, consent, attendance authorization, audit, and fallback code.  
**Important runtime status:** Automatic biometric attendance remains disabled unless `ENABLE_BIOMETRIC_ATTENDANCE === 'true'`. This review did not change that setting.  
**Execution status:** No tests were run. No database was queried, no migrations were run, no dependencies/models were downloaded, and no application files were modified other than creating this report.

## Executive assessment

The source contains useful security controls: authenticated route middleware, role checks, scoped eligible-cadet queries before biometric template matching, encrypted templates, a client-unattested status that current production matching rejects, single-use session/operator-bound challenges, and a manual attendance path. The current biometric attendance flow is disabled, and browser-created enrollment records are marked `CLIENT_UNATTESTED` and are not matchable by the normal production compatibility check.

The implementation is **not ready to enable**. Registration requires face enrollment and a consent boolean; enrollment and verification still accept client-controlled descriptors; the challenge is not liveness; revocation does not persist a state that blocks later re-enrollment; and there are authorization-session, audit durability, and concurrent duplicate-response concerns described below. No finding should be read as evidence that a live exploit was executed.

## Findings

### BSR-01 — Biometric collection is required to submit cadet registration

**Severity: HIGH**

1. **Affected file and function:** `backend/src/controllers/auth.controller.ts`, `register` (lines 77–92); `frontend/src/components/auth/RegisterModal.tsx` (lines 403–425 and 1005–1013).
2. **Actual behavior:** Registration returns HTTP 400 unless a valid 128-value `faceDescriptor`, `biometricConsent === true`, and a client-supplied `qualityScore` are present. The frontend prevents submission when there is no captured descriptor. The transaction creates the user and biometric template together.
3. **Security/privacy impact:** Cadets cannot complete ordinary registration without providing biometric data and asserting consent. The backend validates a boolean, not an independently recorded consent act. The source does not establish a non-biometric registration alternative, age/guardian consent process, or proof that enrollment is voluntary. This is a material privacy and governance risk, particularly for a cadet population that may include minors; this review does not determine applicable law.
4. **Reproduction scenario:** Submit otherwise valid registration payloads without `faceDescriptor`, with `biometricConsent: false`, or without `qualityScore`; each is rejected. In the UI, try submitting before face capture; the button remains disabled.
5. **Recommended fix:** Make biometric enrollment separate and optional to registration. Add a documented, independently reviewed consent flow, age/guardian handling where required, and a functional non-biometric registration path. Do not rely on a client boolean as the sole consent evidence.
6. **Test needed:** Registration succeeds without face fields; enrollment requires a current consent record; consent withdrawal does not block ordinary account access or manual attendance; age/guardian and non-biometric paths follow approved policy.

### BSR-02 — Client-controlled descriptors and quality claims are accepted at biometric API boundaries

**Severity: HIGH — pre-activation blocker; current matching is fail-closed for these records**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `enrollBiometricTemplate` (lines 1597–1649) and `verifyFaceAttendance` (lines 958–970); `backend/src/services/biometricCrypto.service.ts`, `buildBiometricPayload` and `isBiometricPayloadCompatible` (lines 129–152); `frontend/src/components/attendance/FaceEnrollmentModal.tsx`, `captureFace` / `confirmAndEnroll` (lines 101–163).
2. **Actual behavior:** Enrollment accepts a descriptor and quality score supplied by the browser. `buildBiometricPayload` labels the stored descriptor `CLIENT_UNATTESTED`; production matching only accepts `SERVER_VERIFIED` (or test-only fixture data in a tightly controlled test configuration). Verification accepts a numeric descriptor from the request body and compares it to authorized templates; it does not receive or independently process a camera image. A challenge token is not cryptographically bound to a frame or descriptor.
3. **Security/privacy impact:** The current status check prevents browser-created templates from matching through the production path, which is an important fail-closed safeguard. However, the API still stores caller-controlled biometric data and the verifier’s trust boundary is unsafe if a future change marks templates trusted or enables a different template path without adding server-side capture/inference. A permitted operator could submit crafted values instead of a live camera-derived descriptor. Enrollment quality is also a caller assertion, not a measured server value.
4. **Reproduction scenario:** An authorized in-scope enroller can POST a chosen valid-length vector and a numeric score in range with `biometricConsent: true`; the server encrypts and stores it as `CLIENT_UNATTESTED`. If a trusted compatible template exists and the feature is enabled, an authorized operator can submit a chosen 128-value vector with a valid challenge; no server image inference verifies its origin.
5. **Recommended fix:** Keep biometric attendance disabled. Replace descriptor/score request fields with bounded image capture uploads to a private, authenticated inference service called only by Express. The server must calculate and version descriptors and quality results. Ensure a challenge binds to the server-validated capture/session/operator/cadet context, and never allow a client field to set `SERVER_VERIFIED`.
6. **Test needed:** Tampering with descriptor, quality, capture-status, or consent claims cannot enroll/verify; only server-generated descriptors can be matched; no raw template or embedding is returned to the browser; failure of inference is fail-closed with manual attendance available.

### BSR-03 — Revocation deletes the current template but does not prevent re-enrollment

**Severity: HIGH**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `revokeBiometricConsent` (lines 1684–1710) and `enrollBiometricTemplate` (lines 1597–1661); `frontend/src/components/attendance/FaceEnrollmentModal.tsx` (line 161 passes `replaceExisting: true`).
2. **Actual behavior:** Revocation deletes the active `BiometricTemplate` row and writes a `BIOMETRIC_CONSENT_REVOKED` audit event in the same transaction. It does not set a durable revoked state or consult revocation history during enrollment. Enrollment accepts `biometricConsent: true` from the caller; an existing template may be overwritten when `replaceExisting === true`, and the current UI sends that value.
3. **Security/privacy impact:** After a cadet revokes consent and the template is deleted, an authorized scoped officer can later submit a new enrollment with a client-supplied `true` value. The system has no structured state that requires a new cadet consent event before restoring biometric data. The route checks officer role and cadet scope, but those checks do not establish the cadet’s renewed consent.
4. **Reproduction scenario:** As a cadet, call `DELETE /api/attendance/biometrics/:cadetId`; then have an authorized officer call `POST /api/attendance/biometrics/enroll` for that cadet with `biometricConsent: true`, a valid vector/score, and `replaceExisting: true`. Controller logic permits creating a new template after the previous row was removed, subject to valid runtime configuration.
5. **Recommended fix:** Add a durable consent lifecycle state and require a current, subject-bound consent grant before each initial enrollment or re-enrollment. Make re-enrollment a separately authorized and audited operation; do not have the standard UI always request replacement. Present any required schema change and migration plan for approval before implementation.
6. **Test needed:** Revocation blocks all future enrollment/verification until the cadet completes a new consent grant; a staff-supplied boolean alone cannot reinstate consent; replacement is denied without explicit renewed consent and recorded authorization; deletion/re-enrollment audit history remains intact.

### BSR-04 — Legacy JWTs without session IDs bypass durable session revocation checks

**Severity: MEDIUM**

1. **Affected file and function:** `backend/src/middleware/auth.middleware.ts`, `authenticateToken` (lines 45–60).
2. **Actual behavior:** Tokens with a `sid` are checked against `authSession` for revocation and expiry. Tokens without a `sid` are accepted for compatibility and skip that lookup; the middleware then loads the user and checks account status.
3. **Security/privacy impact:** If a valid legacy token without `sid` remains usable, revoking the account’s durable sessions will not invalidate that token. A holder may continue to access otherwise role-authorized attendance/biometric endpoints until the token itself expires or another account control rejects it.
4. **Reproduction scenario:** Present a still-valid, correctly signed legacy JWT without `sid` after revoking the user’s `AuthSession` rows. `authenticateToken` skips session-state lookup for that token and proceeds to user lookup.
5. **Recommended fix:** Establish an explicit compatibility sunset: reject sid-less tokens after a bounded migration window, or validate every token against revocable server-side session state. Ensure biometric/attendance routes cannot use non-revocable credentials.
6. **Test needed:** A token without `sid` is rejected after the compatibility cutoff; revoking a session invalidates every token associated with it; role/session revocation is enforced on attendance and biometric routes.

### BSR-05 — Verification challenge limits are global and in-memory

**Severity: MEDIUM**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, module-level `verificationChallenges` store and `issueVerificationChallenge` (lines 37–47 and 828–918).
2. **Actual behavior:** Challenges are stored in one process-local `Map`, live for 30 seconds, and are capped at 10,000 entries globally. There is no per-operator or per-session request limit in this controller. At capacity, the endpoint prunes expired tokens and returns HTTP 429 to every caller until capacity is available. Restart clears pending challenges; another backend instance does not know tokens issued by this process.
3. **Security/reliability impact:** A compromised or abusive authorized operator can consume the global challenge capacity and temporarily deny challenge issuance for other operators. Multi-instance routing can cause valid challenges to fail closed when verification reaches a different process. Restarts invalidate active challenges. These are availability/reliability concerns, not a demonstrated authentication bypass.
4. **Reproduction scenario:** With biometric automation enabled and an authorized token, issue many challenges without consuming them until the process reaches the 10,000-entry cap; subsequent challenge requests receive 429. In a multi-process deployment, issue on worker A and verify on worker B; B has no matching in-memory token.
5. **Recommended fix:** Before activation, add per-operator/session rate limits and use a shared atomic, short-lived challenge store (or explicitly require a single process and enforce that deployment constraint). Keep one-time consume semantics and fail closed on store failure.
6. **Test needed:** Per-user throttling cannot exhaust global capacity; atomic consume works across workers; expiry, restart, and store outage fail safely; legitimate operators remain isolated from another actor’s challenge flood.

### BSR-06 — Challenge token does not establish liveness or descriptor authenticity

**Severity: HIGH — activation blocker**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `issueVerificationChallenge` and `verifyFaceAttendance` (lines 843–857, 942–1006); `frontend/src/components/attendance/FaceAttendanceModal.tsx`, client capture and request flow.
2. **Actual behavior:** The challenge is a random bearer value with a 30-second expiry, bound to operator and session, and consumed before further checks. The verifier accepts a client-supplied descriptor. No PAD model, hardware-backed capture, or server-side image/liveness processing is integrated. Source comments explicitly state a nonce cannot prove physical presence against photos, video, or synthetic vectors. Both endpoints reject operation by default while the feature flag is off.
3. **Security/privacy impact:** If the flag is enabled without replacing this design, possession of a valid challenge only proves that the authorized client obtained a token; it does not prove that the submitted descriptor came from a live cadet. That can result in false attendance if a compatible trusted template becomes available. Current browser-enrolled templates are `CLIENT_UNATTESTED` and fail the normal production compatibility check, and the feature is disabled, so this review did not identify a presently functioning spoof path.
4. **Reproduction scenario:** After enabling the feature and arranging a compatible trusted template, an authorized operator obtains a challenge and submits a matching vector in JSON without sending a camera image. The server has no code path to determine whether it came from a person, photo, replay, or synthetic vector.
5. **Recommended fix:** Do not enable the feature until a separately cleared and independently evaluated PAD/capture workflow exists. Perform capture and descriptor generation server-side or through a defensible trusted capture boundary; treat the nonce solely as replay protection. Preserve manual attendance as the fallback.
6. **Test needed:** Print, screen replay, recorded video, mask, generated-image, low-light, and camera-bypass tests; verify a descriptor alone cannot mark attendance; demonstrate attack and bona-fide metrics across representative devices and participants before rollout.

### BSR-07 — Duplicate biometric scans can race past the pre-check and both report success

**Severity: MEDIUM — integrity behavior to resolve before activation**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `verifyFaceAttendance` duplicate check and attendance write (lines 1173–1260); `backend/prisma/schema.prisma`, `TrainingAttendance` unique key (line 647).
2. **Actual behavior:** The controller checks for an existing PRESENT record before starting a transaction. If none exists, it performs an `upsert` inside a transaction. The unique key guarantees at most one row per `(sessionId, cadetId)`, but the second concurrent request can pass the earlier check and then update the row created by the first request; both requests may return success rather than one receiving `ALREADY_MARKED`.
3. **Security/integrity impact:** Duplicate scans may create misleading success/verification responses and repeated post-commit notifications/audit events even though only one attendance row exists. This may confuse operators and overstate how many distinct verification actions occurred.
4. **Reproduction scenario:** Send two simultaneous verify requests using separate valid challenges and matching descriptors for the same cadet/session, with no existing PRESENT record. Both may pass the pre-check before either writes; the unique database constraint prevents duplicate rows but does not make the prior check atomic.
5. **Recommended fix:** Make attendance claiming idempotent at the database boundary and distinguish row creation from update. Only the request that creates/claims the PRESENT state should emit success-side effects; return a duplicate response for a competing request.
6. **Test needed:** Run concurrent verification requests against PostgreSQL with isolated fixtures; assert exactly one first-mark success, one duplicate result, one attendance row, and one notification/audit side effect.

### BSR-08 — Biometric attendance audit logging is best-effort after the attendance commit

**Severity: MEDIUM**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `verifyFaceAttendance` (lines 1284–1294); manual attendance uses similar best-effort logging in `markAttendance` (lines 558–578).
2. **Actual behavior:** Attendance is committed in a transaction. The audit insert then catches/logs its own error and allows the request to return success. The biometric enrollment and revocation audit writes, by contrast, are inside their respective Prisma transactions.
3. **Security/privacy impact:** If the audit store is unavailable or the insert fails, a biometric attendance action may persist without a durable audit record. This weakens traceability and incident review. Verification audit details also include cadet name/regimental number, increasing personal data in audit text.
4. **Reproduction scenario:** Force `prisma.auditLog.create` to reject after the attendance transaction commits; the controller logs the error but returns successful attendance. Existing mocks can exercise this behavior, but no such test was executed in this review.
5. **Recommended fix:** Define whether audit durability is mandatory. If mandatory, write attendance and its audit event in the same database transaction or use a reliable transactional outbox. Minimize audit PII and restrict audit access/retention.
6. **Test needed:** Simulate audit-store failure and assert either the attendance transaction rolls back or a durable retry/outbox record is created; verify logs contain no descriptor, image, or unnecessary direct identifiers.

### BSR-09 — Encryption key operations depend on environment configuration; operational handling is unverified

**Severity: INFORMATIONAL**

1. **Affected file and function:** `backend/src/services/biometricCrypto.service.ts`, `loadBiometricKeyring`, `encryptBiometricPayload`, and `decryptBiometricPayload` (lines 43–61 and 74–113).
2. **Actual behavior:** AES-256-GCM uses a fresh 12-byte nonce and 16-byte authentication tag; the envelope records a key ID; decryption selects a key from `BIOMETRIC_ENCRYPTION_KEYS`. Multiple key IDs can be configured, which supports decrypting older envelopes while a new active key encrypts new ones. The application code itself reads keys from process environment; no KMS integration or operational rotation runbook is present in the inspected code.
3. **Security/privacy impact:** No direct cryptographic defect was established. Security depends on how environment secrets are injected, restricted, backed up, rotated, and removed. Those runtime controls cannot be verified from source alone.
4. **Reproduction scenario:** Not a demonstrated exploit. Code inspection shows missing/invalid key configuration fails closed; operational compromise would require access to the configured key material.
5. **Recommended fix:** Document secret storage/access controls, rotation sequence, old-key retirement, backup recovery, and incident response. Avoid committing keys or logging them. Consider an approved secrets manager/KMS appropriate to the local deployment.
6. **Test needed:** Rotation test with old and new key IDs, old-envelope decryption during transition, new-key encryption, retirement behavior, missing key rejection, tamper/AAD integrity rejection, and operational access review.

### BSR-10 — Deletion from active database storage is implemented; full erasure is unverified

**Severity: INFORMATIONAL — verification limitation**

1. **Affected file and function:** `backend/src/controllers/attendance.controller.ts`, `revokeBiometricConsent` (lines 1701–1710); `backend/prisma/schema.prisma`, `BiometricTemplate` (lines 650–662).
2. **Actual behavior:** Revocation deletes the active template row and creates a revocation audit event transactionally. The model has an optional `photoSnapshot`, and current enrollment sets it to null. User deletion cascades to the template. No source-level workflow here purges database backups, snapshots, exports, replicas, external logs, or historical database copies.
3. **Security/privacy impact:** A successful API response confirms deletion from the active table transaction, not complete erasure from every retained copy. Whether copies exist or how long they persist cannot be established by source inspection.
4. **Reproduction scenario:** Call the revocation endpoint and inspect the active row in a real database; this review did not execute that operation or inspect backups. Backup/snapshot retention would require separate operational inspection.
5. **Recommended fix:** Define and document retention/backup deletion or expiry requirements; include a deletion status that distinguishes active-row deletion from full lifecycle completion. Do not claim full erasure until backup and replica policies are verified.
6. **Test needed:** Isolated database test confirms active template deletion and audit retention; separate operational exercise confirms backup expiry/purge and no copies in exports/logs.

## Controls found in source

These are positive controls observed in code, not claims of runtime verification:

- `backend/src/routes/attendance.routes.ts` applies `authenticateToken` globally and uses `requireRole` for enrollment, verification, revocation, and manual attendance routes.
- `getAuthorizedCadetIds`, `drillInstructorMayAccessTarget`, and `getEligibleCadetsForMuster` apply officer assignment, platoon/session scope, active/approved cadet status, and approved-leave checks. `verifyFaceAttendance` resolves eligible cadet IDs before querying biometric templates.
- `getEligibleBiometrics` removes raw descriptor/quality fields before responding; it returns cadet roster fields and an enrollment boolean.
- `BiometricTemplate.descriptor` is encrypted before persistence. The current format has subject-bound AAD, model/version/format checks, synthetic fixture exclusion, and rejects legacy plaintext envelopes.
- Challenge tokens use 32 random bytes, expire after 30 seconds, are session/operator-bound, and are deleted on first consumption. The existing security test file contains sequential replay, concurrent token-reuse, cross-session, and session-state checks.
- Manual attendance remains available through `PATCH /api/attendance/sessions/:sessionId/mark` with authentication, role, session, eligibility, assignment-scope, and approved-leave checks. `TrainingAttendance` has a unique session/cadet key.
- Revocation is scoped: cadets can revoke only their own template; officers must have the cadet in their authorized scope. Template deletion and revocation audit insertion are in one transaction.

## Existing automated test coverage inspected

Test files reviewed (not executed):

- `backend/src/__tests__/biometric-hardening.test.ts`: AES-256-GCM round-trip, subject binding, missing/invalid key configuration, legacy plaintext rejection, synthetic marker handling, and model compatibility checks.
- `backend/src/__tests__/biometric-security.test.ts`: disabled default, role rejection, challenge issuance/replay/concurrent reuse/session binding, scope-before-match, leave handling, sequential duplicate prevention, manual marking, own-consent revocation and cross-cadet denial, among other mocked controller cases.
- `backend/src/__tests__/attendance-scope.test.ts`: helper-level officer/cadet and drill-instructor scope behavior.

Coverage gaps identified by inspection include: real PostgreSQL concurrency behavior for biometric duplicate attendance; direct registration tests for optional/non-biometric enrollment; revoked-consent re-enrollment denial; legacy sid-less JWT revocation; per-operator challenge exhaustion; audit-write failure semantics; actual expiry boundary; key rotation; backup erasure; and real PAD/recognition accuracy/security. Existing tests use mocks/fixtures in relevant portions and do not prove a production database or runtime deployment behaves identically.

## Cannot be verified without live environment or real-world evaluation

- Whether the running database contains only encrypted, valid, authorized templates; whether any legacy plaintext/synthetic templates remain; and whether revocation/deletion reaches the active database as intended.
- Database isolation/unique-index behavior under concurrent biometric verify requests, transaction rollback behavior, and audit durability against the actual PostgreSQL version/configuration.
- Whether production/local runtime secrets are injected securely, protected from logs/process inspection, backed up appropriately, and rotated without losing decryptability. Secret values were not accessed.
- Whether legacy sid-less tokens remain in circulation and their actual expiry/revocation impact.
- Whether the configured model metadata matches any deployed weights, since no weights were downloaded or validated and no inference service exists in the inspected implementation.
- Whether real cameras, phones, lighting, pose, skin-tone variation, accessibility needs, or spoof attacks produce acceptable false-accept/false-reject rates. No liveness/PAD effectiveness can be inferred from the nonce tests.
- Whether backups, replicas, exports, logs, or retention tooling contain biometric data after active-row deletion.
- Whether institutional consent, guardian/parent requirements, privacy policy, and local legal obligations are satisfied. This requires authorized institutional review, not code inspection.

## Priority order before Phases 3–7

1. **Keep biometric attendance disabled.** Do not enable it based on the current challenge or client-side face-api flow.
2. Resolve **BSR-01 and BSR-03**: make registration non-biometric capable and implement an enforceable consent/revocation lifecycle, including renewed consent before re-enrollment.
3. Resolve **BSR-02 and BSR-06**: move image processing and quality/PAD decisions behind a private trusted boundary; never trust caller-provided descriptors, quality scores, or liveness claims.
4. Resolve the model licensing/provenance gates documented in `BIOMETRIC_MODEL_CLEARANCE/CLEARANCE_TRACKER.md`; do not select or install an uncleared model.
5. Resolve **BSR-04 and BSR-05**: complete session revocation compatibility and make challenge storage/limits safe for the intended deployment topology.
6. Resolve **BSR-07 and BSR-08**: make attendance claiming/side effects atomic and define durable audit behavior before automated marking.
7. Approve a schema/migration plan for durable consent and any required model/attempt metadata before changes; do not run migrations without approval.
8. Complete privacy/legal review, including cadet/minor consent and a meaningful manual alternative.
9. Run isolated automated/database tests, then controlled real-world recognition and PAD evaluations with consented participants. Record results and review false acceptance/rejection risks before any rollout decision.

## Remediation update — BSR-04, BSR-05, BSR-07, BSR-08 (2026-11-22)

This addendum records code changes and test evidence after the original review. The original findings above remain as historical findings; the status below is current for the inspected working tree. No schema or migration was changed, no database was accessed, and `ENABLE_BIOMETRIC_ATTENDANCE` was not changed. The repository does not contain evidenced institutional approval; no consent schema work was performed.

### BSR-04 — Session revocation: code fix implemented; unit/mocked verification passed

- `backend/src/middleware/auth.middleware.ts` now rejects JWTs without a `sid` and requires a matching, unrevoked, unexpired `AuthSession` on every authenticated API request. Existing sid-less tokens require a fresh login; newly issued OTP-login JWTs already include `sid`.
- `backend/src/services/sessionPolicy.ts` now treats missing session ID or user ID as inactive. The existing token format and `AuthSession` schema are unchanged.
- OTP login now commits challenge consumption, session creation, and successful-login audit together. Logout and single-session revocation commit the revocation and audit event together; audit failure no longer reports successful logout/revocation.
- **Remaining verification:** authentication tests used mocks; no active database sessions or revoked-token runtime requests were tested. The compatibility effect is an expected re-login for any client still holding a legacy sid-less token.

### BSR-05 — Challenge storage: code hardening implemented; multi-instance design remains unresolved

- New `backend/src/services/verificationChallengeStore.ts` stores only SHA-256 digests of random 256-bit tokens, bounds pending challenges per operator and globally, expires and atomically consumes tokens in one process, and binds them to attendance session, user, and durable auth session.
- `backend/src/controllers/attendance.controller.ts` uses this store. Restart or worker mismatch rejects a token; it fails closed but may interrupt an otherwise valid attempt. Store state is not shared across workers, so multi-instance availability remains unverified and unresolved.
- A shared atomic store requires a separately approved persistent challenge model/migration or an approved self-hosted shared service. No paid service was introduced. Automatic attendance remains disabled.

### BSR-07 — Concurrent attendance: single-winner application logic implemented; PostgreSQL race remains unverified

- Biometric attendance no longer uses an unconditional upsert for a PRESENT verification. It conditionally claims an existing non-PRESENT row or creates a row under the existing `(sessionId,cadetId)` unique key. A competing request receives `409 ALREADY_MARKED`; a database unique-key race is mapped to a duplicate response.
- The audit event is part of the same transaction, and notifications occur only after the winning transaction commits. Manual attendance retains its existing upsert/correction behavior.
- **Remaining verification:** controller/mocked cases passed, but no PostgreSQL concurrency test was run. The actual unique-index race, isolation behavior, and single-winner result must be confirmed against an authorized disposable database before treating this as database-verified.

### BSR-08 — Audit reliability: critical writes are transactional; mocked failure path passed

- Biometric PRESENT, manual attendance/status update, session finalization, biometric enrollment/revocation, successful OTP login, logout, and session revocation now persist their audit event in the same transaction as the associated state change (enrollment/revocation and bulk session revocation were already transactional in the inspected working tree).
- Attendance finalization delays absent notifications until absent reconciliation, session closure, and its audit record commit. Audit failure aborts the transaction and the request reports failure rather than success.
- A mocked manual-attendance audit-sink failure test confirms the handler returns failure and the mock transaction does not commit. This is not proof of PostgreSQL rollback semantics.
- **Remaining audit gaps:** login-failure audit in `auth.controller.ts` still catches and ignores audit persistence errors; broader recovery/administrative audit paths were not changed in this sprint. Attendance audit detail still includes cadet names/regimental numbers and needs approved access/retention and minimization review. These need a separately scoped review if those events/data are considered security-critical or excessive.

### Verification evidence

Executed locally with the repository's existing fail-closed test guard where applicable; no database connection was made:

| Command | Result |
|---|---|
| `npm run test:biometric` | PASS — biometric hardening checks passed; biometric security suite **33 passed, 0 failed**, including replay, per-operator challenge behavior, a mocked concurrent biometric first-mark race, manual attendance, and mocked audit failure. |
| `NODE_ENV=test PURE_MOCK_TEST=true npx ts-node src/__tests__/session-policy.test.ts` | PASS — valid/revoked/expired/sessionless policy behavior and idempotent revocation helper. |
| `NODE_ENV=test PURE_MOCK_TEST=true npx ts-node src/__tests__/verification-challenge-store.test.ts` | PASS — hashing-backed storage behavior, binding, per-operator cap, expiry, and single-use consume. |
| `NODE_ENV=test PURE_MOCK_TEST=true npx ts-node src/__tests__/security-phase3a.test.ts` | PASS — **26 passed, 0 failed**, including sid-less JWT rejection and revoked/expired session rejection using mocks. |
| `npx tsc --noEmit` (from `backend`) | PASS. |

These results do not test real PostgreSQL concurrency, database rollback/audit atomicity, runtime session revocation, clustered challenge sharing, PAD, or face-recognition behavior. Manual attendance remains available; biometric attendance remains disabled.

## Follow-up remediation — BSR-05 design, BSR-08 login audit, BSR-07 integration plan, BSR-04 compatibility (2026-11-22)

This follow-up supersedes the BSR-08 login-failure gap and direct-identifier detail notes above for the current working tree. It does not advance biometric rollout status. No database was contacted; `schema.prisma`, migrations, feature flags, consent schema, and models were not changed.

### BSR-05 — PostgreSQL challenge store: design prepared; implementation blocked on schema/migration approval

- Added `BIOMETRIC_BSR05_BSR08_BSR07_DESIGN.md` with a PostgreSQL `BiometricVerificationChallenge` model proposal, unique token digest, session/user composite binding, expiry/consumption indexes, required manual SQL checks, atomic issuance and consumption pseudocode, DB-clock use, row-lock/revocation race handling, cleanup, bounded retry behavior, multi-instance operation and failure modes.
- Required changes include a new table, relations/indexes, `AuthSession @@unique([id,userId])` for Prisma composite relation support, and migration SQL. No schema or migration was implemented. The current process-local store remains, so challenges remain worker-local and restart-invalidated.
- Required evidence remains a reviewed migration and concurrency test on a separately authorized disposable PostgreSQL database. No institutional approval is inferred.

### BSR-08 — Login failure audit: identifier minimized and persistence failure surfaced

- `auth.controller.ts` no longer stores a stable hash of the submitted email/regimental/roll identifier. A known account is accountable through its internal user ID and the `AUTH_LOGIN_FAILED` action/time; unknown identifiers use generic `UNKNOWN`, with no target or details.
- Audit persistence errors are no longer swallowed. The code emits a fixed sanitized diagnostic marker and returns a generic `503 Authentication is temporarily unavailable` for both known-account and unknown-account failure paths. It does not expose database/provider error text or the submitted identifier. Password verification and throttles are unchanged. Successful session creation/audit transaction boundaries are unchanged.
- Manual and biometric attendance audit details now retain internal `cadetId`, `sessionId`, status and method, while omitting cadet name and regimental number. Attendance state write and audit remain in the same existing transaction. Institutional review is still needed for audit access and retention.
- `login-failure-audit.test.ts` mocks successful and failed audit persistence; it verifies omitted identifiers/details, generic unknown actor, the failure marker and `AUTH_AUDIT_UNAVAILABLE`. The HTTP controller mapping to 503 was checked in source and typechecked, but not independently exercised by an endpoint-level test in this run.

### BSR-07 — PostgreSQL race test: design prepared; database behavior unverified

- The design report defines a synthetic, isolated PostgreSQL test with two independent clients and a barrier, asserting one success, one 409 conflict, one attendance row, consistent count, one audit event, and winner-only notifications. It includes the existing ABSENT-row race and verifies manual correction remains supported.
- No integration DB was created or accessed, and the test was not run. Existing mocked concurrency tests are not PostgreSQL evidence. Manual attendance upsert/correction code was not changed.

### BSR-04 — JWT compatibility

- Inspection confirmed OTP verification creates `AuthSession` and signs the JWT with its durable `sid`; authenticated middleware requires that session to exist, be unrevoked and unexpired. Logout, session revocation, revoke-all and password change operate on durable session rows. No auth refresh endpoint is mounted; password recovery uses a separate reset-purpose token.
- Existing still-valid sid-less legacy JWTs will receive 401 on protected API requests. Users must sign in again with their existing password and complete OTP; no password reset is required. This is intentional to preserve revocation. No token compatibility exception was added.

### Verification executed

All commands ran from `backend/` with `NODE_ENV=test PURE_MOCK_TEST=true` and the repository's first-import database isolation guard where applicable:

| Command | Result |
|---|---|
| `npx ts-node src/__tests__/login-failure-audit.test.ts` | PASS — audit payload minimization and sanitized persistence failure behavior |
| `npm test` | PASS — all configured test scripts passed: isolation regression (5), database/API safety (12), public routes (7), biometric security (33), phase 3A security (26), OTP fallback, recovery characterization/delivery, password policy and session policy |
| `npx tsc --noEmit` | PASS |

No DB-backed integration tests, migrations, frontend checks, runtime requests, or PostgreSQL transaction tests were run. Protected databases and backups were not accessed. `ENABLE_BIOMETRIC_ATTENDANCE` was not changed; biometric attendance remains disabled.

